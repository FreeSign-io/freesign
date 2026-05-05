import { PDF } from '@libpdf/core';
import { DocumentDataType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { extractPdfPlaceholders } from '@documenso/lib/server-only/pdf/auto-place-fields';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { deleteS3File } from '@documenso/lib/universal/upload/server-actions';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateEnvelopeFromKeysRequestSchema,
  ZCreateEnvelopeFromKeysResponseSchema,
} from './create-envelope-from-keys.types';

export const createEnvelopeFromKeysRoute = authenticatedProcedure
  .input(ZCreateEnvelopeFromKeysRequestSchema)
  .output(ZCreateEnvelopeFromKeysResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { payload, uploadedFiles } = input;
    const userId = ctx.user.id;
    const teamId = ctx.teamId;

    const { remaining, maximumEnvelopeItemCount } = await getServerLimits({
      userId,
      teamId,
    });

    if (remaining.documents <= 0) {
      throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
        message: 'You have reached your document limit for this month.',
        statusCode: 400,
      });
    }

    if (uploadedFiles.length > maximumEnvelopeItemCount) {
      throw new AppError('ENVELOPE_ITEM_LIMIT_EXCEEDED', {
        message: `You cannot upload more than ${maximumEnvelopeItemCount} envelope items per envelope`,
        statusCode: 400,
      });
    }

    // Each presigned URL is keyed under `<userId>/...`. Reject anyone trying
    // to attach a key that wasn't issued to them.
    const userKeyPrefix = `${userId}/`;
    if (uploadedFiles.some((f) => !f.key.startsWith(userKeyPrefix))) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Uploaded file does not belong to this user.',
        statusCode: 403,
      });
    }

    // Validate each uploaded blob is a real PDF and capture page count + placeholders.
    // Done sequentially to keep memory bounded (one large PDF at a time).
    const validatedItems: Array<{
      title: string;
      key: string;
      placeholders: Awaited<ReturnType<typeof extractPdfPlaceholders>>['placeholders'];
    }> = [];

    for (const file of uploadedFiles) {
      let buffer: Uint8Array;
      try {
        buffer = await getFileServerSide({
          type: DocumentDataType.S3_PATH,
          data: file.key,
        });
      } catch (err) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'Uploaded file not found in storage.',
          statusCode: 400,
        });
      }

      // Defence in depth: the presigned URL constrains Content-Length, but
      // also re-check on the server.
      if (buffer.byteLength !== file.fileSize) {
        await deleteS3File(file.key).catch(() => undefined);
        throw new AppError('INVALID_DOCUMENT_FILE', {
          message: 'Uploaded file size does not match declared size.',
          statusCode: 400,
        });
      }

      let pdf;
      try {
        pdf = await PDF.load(buffer);
      } catch {
        await deleteS3File(file.key).catch(() => undefined);
        throw new AppError('INVALID_DOCUMENT_FILE', {
          message: 'Not a valid PDF.',
          statusCode: 400,
        });
      }

      if (pdf.isEncrypted) {
        await deleteS3File(file.key).catch(() => undefined);
        throw new AppError('INVALID_DOCUMENT_FILE', {
          message: 'Encrypted PDFs are not supported.',
          statusCode: 400,
        });
      }

      const { placeholders } = await extractPdfPlaceholders(Buffer.from(buffer));

      validatedItems.push({
        title: file.fileName,
        key: file.key,
        placeholders,
      });
    }

    // Persist DocumentData for each validated upload, marked pending normalization.
    const envelopeItems = await Promise.all(
      validatedItems.map(async (item) => {
        const documentData = await createDocumentData({
          type: DocumentDataType.S3_PATH,
          data: item.key,
        });

        // Set the row's normalizationStatus to pending. createDocumentData
        // doesn't expose that field; flip it directly. (Default in the schema
        // is `complete` to keep legacy uploads unaffected.)
        await prisma.documentData.update({
          where: { id: documentData.id },
          data: { normalizationStatus: 'pending' },
        });

        return {
          title: item.title,
          documentDataId: documentData.id,
          placeholders: item.placeholders,
        };
      }),
    );

    const recipientsToCreate = payload.recipients?.map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      signingOrder: recipient.signingOrder,
      accessAuth: recipient.accessAuth,
      actionAuth: recipient.actionAuth,
      fields: recipient.fields?.map((field) => {
        let documentDataId: string | undefined;

        if (typeof field.identifier === 'string') {
          documentDataId = envelopeItems.find(
            (item) => item.title === field.identifier,
          )?.documentDataId;
        }
        if (typeof field.identifier === 'number') {
          documentDataId = envelopeItems.at(field.identifier)?.documentDataId;
        }
        if (field.identifier === undefined) {
          documentDataId = envelopeItems.at(0)?.documentDataId;
        }

        if (!documentDataId) {
          throw new AppError(AppErrorCode.NOT_FOUND, {
            message: 'Document data not found',
          });
        }

        return { ...field, documentDataId };
      }),
    }));

    const envelope = await createEnvelope({
      userId,
      teamId,
      internalVersion: 2,
      data: {
        type: payload.type,
        title: payload.title,
        externalId: payload.externalId,
        formValues: payload.formValues,
        visibility: payload.visibility,
        globalAccessAuth: payload.globalAccessAuth,
        globalActionAuth: payload.globalActionAuth,
        recipients: recipientsToCreate,
        folderId: payload.folderId,
        envelopeItems,
        delegatedDocumentOwner: payload.delegatedDocumentOwner,
      },
      attachments: payload.attachments,
      meta: payload.meta,
      requestMetadata: ctx.metadata,
    });

    // Fire-and-forget: enqueue normalization for each envelope item.
    await Promise.all(
      envelopeItems.map(async (item) =>
        jobs
          .triggerJob({
            name: 'internal.normalize-pdf',
            payload: { documentDataId: item.documentDataId },
          })
          .catch((err) => {
            ctx.logger.error({ err }, 'Failed to enqueue normalize-pdf');
          }),
      ),
    );

    return {
      id: envelope.id,
      normalizationPending: true,
    };
  });

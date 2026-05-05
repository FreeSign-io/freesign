import { DocumentDataType } from '@prisma/client';
import path from 'node:path';

import { prisma } from '@documenso/prisma';

import { AppError } from '../../../errors/app-error';
import { normalizePdf } from '../../../server-only/pdf/normalize-pdf';
import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { deleteS3File, uploadS3File } from '../../../universal/upload/server-actions';
import { type JobRunIO } from '../../client/_internal/job';
import { type TNormalizePdfJobDefinition } from './normalize-pdf';

export const run = async ({
  payload,
  io: _io,
}: {
  payload: TNormalizePdfJobDefinition;
  io: JobRunIO;
}) => {
  const { documentDataId } = payload;

  const documentData = await prisma.documentData.findUnique({
    where: { id: documentDataId },
  });

  if (!documentData) {
    // Soft-fail: row was likely deleted before the worker picked up the job.
    return;
  }

  if (documentData.normalizationStatus === 'complete') {
    return;
  }

  if (documentData.type !== DocumentDataType.S3_PATH) {
    // We only normalize S3-stored uploads; legacy BYTES_64 rows are already
    // fully in DB and out of scope here.
    return;
  }

  const oldKey = documentData.data;

  try {
    const original = await getFileServerSide({
      type: documentData.type,
      data: oldKey,
    });

    const normalized = await normalizePdf(Buffer.from(original), { flattenForm: true });

    // Reuse the original filename so download UX stays sensible. The bucket
    // path includes a fresh alphaid via `uploadS3File`, so collisions are
    // not a concern.
    const fileName = path.basename(oldKey);

    const { key: newKey } = await uploadS3File({
      name: fileName,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(normalized.buffer.slice(0)),
    } as unknown as File);

    await prisma.documentData.update({
      where: { id: documentDataId },
      data: {
        data: newKey,
        normalizationStatus: 'complete',
      },
    });

    // Best-effort cleanup of the original; if it fails the orphan-cleanup
    // job will pick it up.
    await deleteS3File(oldKey).catch(() => undefined);
  } catch (err) {
    await prisma.documentData
      .update({
        where: { id: documentDataId },
        data: { normalizationStatus: 'failed' },
      })
      .catch(() => undefined);

    throw err instanceof AppError ? err : new AppError('NORMALIZE_PDF_FAILED');
  }
};

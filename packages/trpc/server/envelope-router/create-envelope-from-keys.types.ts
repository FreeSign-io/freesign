import { EnvelopeType } from '@prisma/client';
import { z } from 'zod';

import {
  ZDocumentAccessAuthTypesSchema,
  ZDocumentActionAuthTypesSchema,
} from '@documenso/lib/types/document-auth';
import { ZDocumentFormValuesSchema } from '@documenso/lib/types/document-form-values';
import { ZDocumentMetaCreateSchema } from '@documenso/lib/types/document-meta';
import { ZEnvelopeAttachmentTypeSchema } from '@documenso/lib/types/envelope-attachment';
import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZFieldPageNumberSchema,
} from '@documenso/lib/types/field';
import { ZEnvelopeFieldAndMetaSchema } from '@documenso/lib/types/field-meta';
import { zEmail } from '@documenso/lib/utils/zod';

import {
  ZDocumentExternalIdSchema,
  ZDocumentTitleSchema,
  ZDocumentVisibilitySchema,
} from '../document-router/schema';
import { ZCreateEnvelopeRecipientSchema } from './envelope-recipients/create-envelope-recipients.types';

export const ZUploadedFileSchema = z.object({
  /** The S3 key returned by /api/files/presigned-put-url. */
  key: z.string().min(1),
  fileName: z.string().min(1),
  /** Bytes. Must match the size declared at presign time. */
  fileSize: z.number().int().positive(),
});

export const ZCreateEnvelopeFromKeysRequestSchema = z.object({
  payload: z.object({
    title: ZDocumentTitleSchema,
    type: z.nativeEnum(EnvelopeType),
    delegatedDocumentOwner: zEmail().optional(),
    externalId: ZDocumentExternalIdSchema.optional(),
    visibility: ZDocumentVisibilitySchema.optional(),
    globalAccessAuth: z.array(ZDocumentAccessAuthTypesSchema).optional(),
    globalActionAuth: z.array(ZDocumentActionAuthTypesSchema).optional(),
    formValues: ZDocumentFormValuesSchema.optional(),
    folderId: z.string().optional(),
    recipients: z
      .array(
        ZCreateEnvelopeRecipientSchema.extend({
          fields: ZEnvelopeFieldAndMetaSchema.and(
            z.object({
              identifier: z.union([z.string(), z.number()]).optional(),
              page: ZFieldPageNumberSchema,
              positionX: ZClampedFieldPositionXSchema,
              positionY: ZClampedFieldPositionYSchema,
              width: ZClampedFieldWidthSchema,
              height: ZClampedFieldHeightSchema,
            }),
          )
            .array()
            .optional(),
        }),
      )
      .optional(),
    meta: ZDocumentMetaCreateSchema.optional(),
    attachments: z
      .array(
        z.object({
          label: z.string().min(1),
          data: z.string().url(),
          type: ZEnvelopeAttachmentTypeSchema.optional().default('link'),
        }),
      )
      .optional(),
  }),
  uploadedFiles: z.array(ZUploadedFileSchema).min(1),
});

export const ZCreateEnvelopeFromKeysResponseSchema = z.object({
  id: z.string(),
  /** True iff at least one DocumentData is awaiting background normalization. */
  normalizationPending: z.boolean(),
});

export type TCreateEnvelopeFromKeysRequest = z.infer<typeof ZCreateEnvelopeFromKeysRequestSchema>;
export type TCreateEnvelopeFromKeysResponse = z.infer<typeof ZCreateEnvelopeFromKeysResponseSchema>;

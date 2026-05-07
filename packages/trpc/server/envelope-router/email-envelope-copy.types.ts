import { z } from 'zod';

import { zEmail } from '@documenso/lib/utils/zod';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';

export const emailEnvelopeCopyMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/email-copy',
    summary: 'Email a signed envelope copy',
    description:
      'Email a copy of a completed envelope to a list of fresh email addresses. The envelope must be COMPLETED and owned by the caller.',
    tags: ['Envelope'],
  },
};

export const ZEmailEnvelopeCopyRequestSchema = z.object({
  envelopeId: z.string(),
  emails: z.array(zEmail()).min(1).max(20),
});

export const ZEmailEnvelopeCopyResponseSchema = ZSuccessResponseSchema.extend({
  sent: z.number().int().nonnegative(),
});

export type TEmailEnvelopeCopyRequest = z.infer<typeof ZEmailEnvelopeCopyRequestSchema>;
export type TEmailEnvelopeCopyResponse = z.infer<typeof ZEmailEnvelopeCopyResponseSchema>;

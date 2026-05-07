import { z } from 'zod';

import { ZDocumentMetaUpdateSchema } from '@documenso/lib/types/document-meta';

import { ZSuccessResponseSchema } from '../schema';
import type { TrpcRouteMeta } from '../trpc';
import { ZRecipientWithSigningUrlSchema } from './schema';

export const distributeEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/distribute',
    summary: 'Distribute envelope',
    description: 'Send the envelope to recipients based on your distribution method',
    tags: ['Envelope'],
  },
};

export const ZDistributeEnvelopeRequestSchema = z.object({
  envelopeId: z.string().describe('The ID of the envelope to send.'),
  /**
   * Whether to email recipients about the signing request.
   *
   * Default behaviour (when omitted) preserves backward compatibility: emails
   * fire if the team has signing-request emails enabled, otherwise they don't.
   * Pass `false` explicitly to skip the email loop entirely — useful for
   * self-sign flows where the sender is the only recipient and is about to
   * be redirected to the signing page directly.
   */
  sendEmail: z.boolean().optional(),
  meta: ZDocumentMetaUpdateSchema.pick({
    subject: true,
    message: true,
    timezone: true,
    dateFormat: true,
    distributionMethod: true,
    redirectUrl: true,
    language: true,
    emailId: true,
    emailReplyTo: true,
    emailSettings: true,
  }).optional(),
});

export const ZDistributeEnvelopeResponseSchema = ZSuccessResponseSchema.extend({
  id: z.string().describe('The ID of the envelope that was sent.'),
  recipients: ZRecipientWithSigningUrlSchema.array(),
});

export type TDistributeEnvelopeRequest = z.infer<typeof ZDistributeEnvelopeRequestSchema>;
export type TDistributeEnvelopeResponse = z.infer<typeof ZDistributeEnvelopeResponseSchema>;

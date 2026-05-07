import { emailEnvelopeCopy } from '@documenso/lib/server-only/document/email-envelope-copy';

import { authenticatedProcedure } from '../trpc';
import {
  ZEmailEnvelopeCopyRequestSchema,
  ZEmailEnvelopeCopyResponseSchema,
  emailEnvelopeCopyMeta,
} from './email-envelope-copy.types';

export const emailEnvelopeCopyRoute = authenticatedProcedure
  .meta(emailEnvelopeCopyMeta)
  .input(ZEmailEnvelopeCopyRequestSchema)
  .output(ZEmailEnvelopeCopyResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, emails } = input;

    ctx.logger.info({
      input: { envelopeId, recipientCount: emails.length },
    });

    const { sent } = await emailEnvelopeCopy({
      envelopeId,
      userId: ctx.user.id,
      teamId,
      emails,
    });

    return { success: true, sent };
  });

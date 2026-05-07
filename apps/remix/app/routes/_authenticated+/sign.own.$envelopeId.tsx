import { RecipientRole } from '@prisma/client';
import { redirect } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/sign.own.$envelopeId';

/**
 * Self-sign authenticated entry point.
 *
 * Lets a logged-in sender sign their own envelope without going through the
 * recipient-token email flow. Verifies ownership and the "single SIGNER who
 * is the sender" shape, then redirects to the existing `/sign/{token}` route
 * using the recipient's stored token. The downstream signing flow already
 * handles `user.email === recipient.email` via `DocumentSigningAuthProvider`,
 * so no signing-context changes are needed here.
 *
 * Returns 401 if not signed in, 404 if the envelope doesn't exist or the
 * caller doesn't own it, and 403 if the envelope is not a self-sign envelope
 * (i.e. has multiple recipients or a recipient that isn't the sender).
 */
export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { envelopeId } = params;

  if (!envelopeId) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      statusCode: 404,
      message: 'Envelope id missing',
    });
  }

  const { user } = await getSession(request);

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      userId: user.id,
    },
    select: {
      id: true,
      recipients: {
        select: {
          id: true,
          email: true,
          role: true,
          token: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      statusCode: 404,
      message: 'Envelope not found',
    });
  }

  if (envelope.recipients.length !== 1) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      statusCode: 403,
      message: 'This envelope has multiple recipients; use the standard signing flow.',
    });
  }

  const [recipient] = envelope.recipients;

  if (recipient.email !== user.email || recipient.role !== RecipientRole.SIGNER) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      statusCode: 403,
      message: 'This envelope is not configured for self-signing.',
    });
  }

  return redirect(`/sign/${recipient.token}`);
};

// No component: loader-only redirect route.
export default function SignOwnEnvelopeRoute() {
  return null;
}

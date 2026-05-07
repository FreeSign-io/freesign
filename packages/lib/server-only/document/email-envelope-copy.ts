import { createElement } from 'react';

import { msg } from '@lingui/core/macro';
import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { mailer } from '@documenso/email/mailer';
import { DocumentCompletedEmailTemplate } from '@documenso/email/templates/document-completed';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../utils/teams';
import { getEmailContext } from '../email/get-email-context';

export type EmailEnvelopeCopyOptions = {
  envelopeId: string;
  userId: number;
  teamId: number;
  /** Fresh email addresses to receive the signed PDF as a CC. */
  emails: string[];
};

/**
 * Email a copy of a COMPLETED envelope's signed PDF to a fresh
 * list of addresses (typically used after self-sign, when the
 * sender wants to share the signed copy with people who were
 * not on the original envelope as recipients).
 *
 * Ownership is enforced: only the envelope's owner can email
 * copies. The envelope must be COMPLETED.
 */
export const emailEnvelopeCopy = async ({
  envelopeId,
  userId,
  teamId,
  emails,
}: EmailEnvelopeCopyOptions) => {
  if (emails.length === 0) {
    return { sent: 0 };
  }

  const envelope = await prisma.envelope.findFirst({
    where: {
      id: envelopeId,
      type: EnvelopeType.DOCUMENT,
      userId,
      teamId,
    },
    include: {
      envelopeItems: {
        include: {
          documentData: {
            select: {
              type: true,
              id: true,
              data: true,
            },
          },
        },
      },
      documentMeta: true,
      team: { select: { id: true, url: true } },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Envelope not found',
    });
  }

  if (envelope.status !== DocumentStatus.COMPLETED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Envelope must be completed before emailing a copy',
    });
  }

  const { branding, emailLanguage, senderEmail, replyToEmail } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: { type: 'team', teamId: envelope.teamId },
    meta: envelope.documentMeta,
  });

  const attachments = await Promise.all(
    envelope.envelopeItems.map(async (envelopeItem) => {
      const file = await getFileServerSide(envelopeItem.documentData);
      const fileName =
        envelope.internalVersion === 1 ? envelope.title : envelopeItem.title + '.pdf';

      return {
        filename: fileName.endsWith('.pdf') ? fileName : fileName + '.pdf',
        content: Buffer.from(file),
        contentType: 'application/pdf',
      };
    }),
  );

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const downloadLink = envelope.team?.url
    ? `${NEXT_PUBLIC_WEBAPP_URL()}/t/${envelope.team.url}/documents/${envelope.id}`
    : `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(envelope.team?.url)}/${envelope.id}`;

  const i18n = await getI18nInstance(emailLanguage);

  const dedupedEmails = Array.from(
    new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
  );

  await Promise.all(
    dedupedEmails.map(async (address) => {
      const template = createElement(DocumentCompletedEmailTemplate, {
        documentName: envelope.title,
        assetBaseUrl,
        downloadLink,
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: emailLanguage, branding }),
        renderEmailWithI18N(template, { lang: emailLanguage, branding, plainText: true }),
      ]);

      await mailer.sendMail({
        to: [{ name: '', address }],
        from: senderEmail,
        replyTo: replyToEmail,
        subject: i18n._(msg`Signed document copy`),
        html,
        text,
        attachments,
      });
    }),
  );

  return { sent: dedupedEmails.length };
};

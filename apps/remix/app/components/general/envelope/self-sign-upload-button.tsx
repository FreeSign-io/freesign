import { useMemo, useState } from 'react';

import { msg, plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { EnvelopeType, RecipientRole } from '@prisma/client';
import { PenLine } from 'lucide-react';
import { ErrorCode as DropzoneErrorCode, type FileRejection } from 'react-dropzone';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';

import { useLimits } from '@documenso/ee/server-only/limits/provider/client';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import type { TCreateEnvelopePayload } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { buildDropzoneRejectionDescription } from '@documenso/ui/lib/handle-dropzone-rejection';
import { cn } from '@documenso/ui/lib/utils';
import { DocumentUploadButton } from '@documenso/ui/primitives/document-upload-button';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type SelfSignUploadButtonProps = {
  className?: string;
  folderId?: string;
};

/**
 * Upload a PDF and immediately sign it yourself, no email loop.
 *
 * Sibling of `EnvelopeUploadButton`. Creates an envelope with the
 * sender as the sole SIGNER recipient, then navigates to the editor
 * (where the user drops their signature/text fields). The editor
 * detects this shape and replaces the "Send Document" CTA with
 * "Sign now", which calls `envelope.distribute({ sendEmail: false })`
 * and routes to `/sign/own/:id`.
 */
export const SelfSignUploadButton = ({ className, folderId }: SelfSignUploadButtonProps) => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();
  const { user } = useSession();

  const team = useCurrentTeam();
  const navigate = useNavigate();
  const organisation = useCurrentOrganisation();

  const userTimezone = TIME_ZONES.find(
    (timezone) => timezone === Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const { remaining, refreshLimits, maximumEnvelopeItemCount } = useLimits();

  const [isLoading, setIsLoading] = useState(false);

  const { mutateAsync: createEnvelope } = trpc.envelope.create.useMutation();

  const disabledMessage = useMemo(() => {
    if (organisation.subscription && remaining.documents === 0) {
      return msg`Self-sign disabled due to unpaid invoices`;
    }
    if (remaining.documents === 0) {
      return msg`You have reached your document limit.`;
    }
    if (!user.emailVerified) {
      return msg`Verify your email to sign documents.`;
    }
  }, [remaining.documents, user.emailVerified, organisation.subscription]);

  const onFileDrop = async (files: File[]) => {
    try {
      setIsLoading(true);

      const payload = {
        folderId,
        type: EnvelopeType.DOCUMENT,
        title: files[0].name,
        meta: {
          timezone: userTimezone,
        },
        recipients: [
          {
            email: user.email,
            name: user.name ?? user.email,
            role: RecipientRole.SIGNER,
          },
        ],
      } satisfies TCreateEnvelopePayload;

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));

      for (const file of files) {
        formData.append('files', file);
      }

      const { id } = await createEnvelope(formData).catch((error) => {
        console.error(error);
        throw error;
      });

      void refreshLimits();

      const aiQueryParam = team.preferences.aiFeaturesEnabled ? '?ai=true' : '';
      await navigate(`${formatDocumentsPath(team.url)}/${id}/edit${aiQueryParam}`);
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(err);

      const errorMessage = match(error.code)
        .with('INVALID_DOCUMENT_FILE', () => t`You cannot upload encrypted PDFs.`)
        .with(
          AppErrorCode.LIMIT_EXCEEDED,
          () => t`You have reached your document limit for this month. Please upgrade your plan.`,
        )
        .with(
          'ENVELOPE_ITEM_LIMIT_EXCEEDED',
          () => t`You have reached the limit of the number of files per envelope.`,
        )
        .otherwise(() => t`An error occurred while uploading your document.`);

      toast({
        title: t`Error`,
        description: errorMessage,
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onFileDropRejected = (fileRejections: FileRejection[]) => {
    const maxItemsReached = fileRejections.some((fileRejection) =>
      fileRejection.errors.some((error) => error.code === DropzoneErrorCode.TooManyFiles),
    );

    if (maxItemsReached) {
      toast({
        title: plural(maximumEnvelopeItemCount, {
          one: `You cannot upload more than # item per envelope.`,
          other: `You cannot upload more than # items per envelope.`,
        }),
        duration: 5000,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: t`Upload failed`,
      description: i18n._(buildDropzoneRejectionDescription(fileRejections)),
      duration: 5000,
      variant: 'destructive',
    });
  };

  return (
    <div className={cn('relative', className)}>
      <DocumentUploadButton
        loading={isLoading}
        disabled={remaining.documents === 0 || !user.emailVerified}
        disabledMessage={disabledMessage}
        onDrop={onFileDrop}
        onDropRejected={onFileDropRejected}
        type={EnvelopeType.DOCUMENT}
        internalVersion="2"
        maxFiles={maximumEnvelopeItemCount}
        label={msg`Sign yourself`}
        icon={<PenLine className="h-4 w-4" />}
        variant="outline"
      />
    </div>
  );
};

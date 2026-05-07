import { useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { PenLine } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type SignNowButtonProps = {
  variant?: 'header' | 'sidebar';
  /** When true, renders icon-only / collapsed sidebar form. */
  minimized?: boolean;
};

/**
 * Self-sign CTA: distribute envelope without sending email,
 * then redirect the sender to /sign/own/:envelopeId. Replaces
 * the regular "Send Document" CTA when the envelope is shaped
 * like a self-sign (single SIGNER recipient = sender).
 */
export const SignNowButton = ({ variant = 'header', minimized = false }: SignNowButtonProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { envelope, flushAutosave } = useCurrentEnvelopeEditor();

  const { mutateAsync: distribute } = trpc.envelope.distribute.useMutation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    try {
      setIsSubmitting(true);

      await flushAutosave();

      await distribute({
        envelopeId: envelope.id,
        sendEmail: false,
      });

      await navigate(`/sign/own/${envelope.id}`);
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(err);

      toast({
        title: t`Could not start signing`,
        description: error.message || t`An error occurred while preparing your document.`,
        variant: 'destructive',
        duration: 7500,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'sidebar') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        title={t`Sign now`}
        loading={isSubmitting}
        onClick={() => void handleClick()}
      >
        <PenLine className="h-4 w-4" />

        {!minimized && (
          <span className="ml-2">
            <Trans>Sign now</Trans>
          </span>
        )}
      </Button>
    );
  }

  return (
    <Button size="sm" loading={isSubmitting} onClick={() => void handleClick()}>
      <PenLine className="mr-2 h-4 w-4" />
      <Trans>Sign now</Trans>
    </Button>
  );
};

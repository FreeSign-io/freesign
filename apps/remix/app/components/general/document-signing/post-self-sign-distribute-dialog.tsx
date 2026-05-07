import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { MailIcon, Trash2Icon } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { zEmail } from '@documenso/lib/utils/zod';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PostSelfSignDistributeDialogProps = {
  envelopeId: string;
  documentTitle: string;
  trigger: React.ReactNode;
};

const ZFormSchema = z.object({
  emails: z
    .array(z.object({ value: zEmail() }))
    .min(1)
    .max(20),
});

type TFormSchema = z.infer<typeof ZFormSchema>;

/**
 * Post-self-sign distribution dialog. After the user signs a self-sign
 * document and lands on the celebration page, this dialog lets them
 * (optionally) email the signed PDF to a fresh list of addresses,
 * mirroring DocuSign's "Want to email this to anyone?" prompt.
 */
export const PostSelfSignDistributeDialog = ({
  envelopeId,
  documentTitle,
  trigger,
}: PostSelfSignDistributeDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: emailCopy } = trpc.envelope.emailCopy.useMutation();

  const form = useForm<TFormSchema>({
    defaultValues: {
      emails: [{ value: '' }],
    },
    resolver: zodResolver(ZFormSchema),
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'emails' });

  const onSubmit = async ({ emails }: TFormSchema) => {
    try {
      const result = await emailCopy({
        envelopeId,
        emails: emails.map((entry) => entry.value),
      });

      toast({
        title: t`Copy sent`,
        description: t`The signed copy was emailed to ${result.sent} recipient(s).`,
        duration: 5000,
      });

      setIsOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);
      toast({
        title: t`Could not send`,
        description: error.message || t`The copy could not be emailed. Please try again.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset({ emails: [{ value: '' }] });
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Email a signed copy</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Send a copy of <span className="font-medium">{documentTitle}</span> to anyone you'd
              like. They'll receive the signed PDF as an attachment.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <fieldset disabled={isSubmitting} className="space-y-2">
              {fields.map((entry, index) => (
                <FormField
                  key={entry.id}
                  control={control}
                  name={`emails.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t`name@example.com`}
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>

                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            aria-label={t`Remove email`}
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}

              {fields.length < 20 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ value: '' })}
                >
                  <Trans>Add another email</Trans>
                </Button>
              )}
            </fieldset>

            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isSubmitting}>
                  <Trans>Skip</Trans>
                </Button>
              </DialogClose>

              <Button loading={isSubmitting} type="submit">
                <MailIcon className="mr-2 h-4 w-4" />
                <Trans>Email copy</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

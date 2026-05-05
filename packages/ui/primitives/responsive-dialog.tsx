import * as React from 'react';

import { useMediaQuery } from '@documenso/lib/client-only/hooks/use-media-query';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { SheetContent } from './sheet';

const DESKTOP_QUERY = '(min-width: 768px)';

const ResponsiveDialog = Dialog;
const ResponsiveDialogTrigger = DialogTrigger;
const ResponsiveDialogClose = DialogClose;
const ResponsiveDialogHeader = DialogHeader;
const ResponsiveDialogFooter = DialogFooter;
const ResponsiveDialogTitle = DialogTitle;
const ResponsiveDialogDescription = DialogDescription;

type ResponsiveDialogContentProps = React.ComponentPropsWithoutRef<typeof DialogContent>;

const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  ResponsiveDialogContentProps
>(({ children, className, ...props }, ref) => {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  if (isDesktop) {
    return (
      <DialogContent ref={ref} className={className} {...props}>
        {children}
      </DialogContent>
    );
  }

  return (
    <SheetContent position="bottom" size="content" className={className}>
      {children}
    </SheetContent>
  );
});

ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};

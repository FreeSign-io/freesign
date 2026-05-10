import { useRef } from 'react';

import { Loader } from 'lucide-react';

import { useFitFontSize } from '@documenso/lib/client-only/hooks/use-fit-font-size';
import { cn } from '@documenso/ui/lib/utils';

export const DocumentSigningFieldsLoader = () => {
  return (
    <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
      <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
    </div>
  );
};

export const DocumentSigningFieldsUninserted = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="text-foreground group-hover:text-recipient-green whitespace-pre-wrap text-[clamp(0.425rem,25cqw,0.825rem)] duration-200">
      {children}
    </p>
  );
};

type DocumentSigningFieldsInsertedProps = {
  children: React.ReactNode;

  /**
   * The text alignment of the field.
   *
   * Defaults to left.
   */
  textAlign?: 'left' | 'center' | 'right';
};

export const DocumentSigningFieldsInserted = ({
  children,
  textAlign = 'left',
}: DocumentSigningFieldsInsertedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : '';

  const fontSize = useFitFontSize({
    containerRef,
    textRef,
    text,
    maxFontRem: 0.825,
    minFontRem: 0.5,
  });

  return (
    <div ref={containerRef} className="flex h-full w-full items-center overflow-hidden">
      <p
        ref={textRef}
        className={cn(
          'text-foreground w-full whitespace-pre-wrap break-words text-left leading-tight duration-200',
          {
            '!text-center': textAlign === 'center',
            '!text-right': textAlign === 'right',
          },
        )}
        style={{ fontSize: `${fontSize}rem` }}
      >
        {children}
      </p>
    </div>
  );
};

import type { RefObject } from 'react';
import { useLayoutEffect, useState } from 'react';

type UseFitFontSizeOptions = {
  containerRef: RefObject<HTMLElement | null>;
  textRef: RefObject<HTMLElement | null>;
  text: string | null | undefined;
  maxFontRem?: number;
  minFontRem?: number;
  stepRem?: number;
};

/**
 * Shrinks a text element's font-size so the rendered content fits within its
 * container, with a readability floor. Mirrors the algorithm previously inlined
 * in document-signing-signature-field.tsx so every filled field type can opt
 * in to the same auto-fit behaviour.
 */
export const useFitFontSize = ({
  containerRef,
  textRef,
  text,
  maxFontRem = 0.825,
  minFontRem = 0.5,
  stepRem = 0.05,
}: UseFitFontSizeOptions) => {
  const [fontSize, setFontSize] = useState(maxFontRem);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;

    if (!container || !textEl || !text) {
      setFontSize(maxFontRem);
      return;
    }

    const adjust = () => {
      let size = maxFontRem;
      textEl.style.fontSize = `${size}rem`;

      while (
        (textEl.scrollWidth > container.clientWidth ||
          textEl.scrollHeight > container.clientHeight) &&
        size > minFontRem
      ) {
        size = Math.max(minFontRem, size - stepRem);
        textEl.style.fontSize = `${size}rem`;
      }

      setFontSize(size);
    };

    const observer = new ResizeObserver(adjust);
    observer.observe(container);

    adjust();

    return () => observer.disconnect();
  }, [containerRef, textRef, text, maxFontRem, minFontRem, stepRem]);

  return fontSize;
};

import type Konva from 'konva';

type FitFontSizeOptions = {
  textNode: Konva.Text;
  maxWidth: number;
  maxHeight: number;
  startSize: number;
  minSize?: number;
  step?: number;
};

/**
 * Iteratively shrinks a Konva.Text node's fontSize until its rendered rect
 * fits within `maxWidth` x `maxHeight`, with a readability floor at `minSize`.
 *
 * Mirrors the DOM-side useFitFontSize hook so the value the recipient sees in
 * the live signing UI matches what gets baked into the sealed PDF.
 */
export const fitFontSize = ({
  textNode,
  maxWidth,
  maxHeight,
  startSize,
  minSize = 4,
  step = 0.5,
}: FitFontSizeOptions): number => {
  let size = startSize;

  textNode.fontSize(size);

  let rect = textNode.getClientRect({ skipTransform: true });

  while ((rect.width > maxWidth || rect.height > maxHeight) && size > minSize) {
    size = Math.max(minSize, size - step);
    textNode.fontSize(size);
    rect = textNode.getClientRect({ skipTransform: true });
  }

  return size;
};

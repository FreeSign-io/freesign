/**
 * !: This is a workaround to fix the memory leak in the skia-canvas library.
 * !: Internals are ported from the original `konva/skia-backend.js` file.
 */
import { Konva } from 'konva/lib/_CoreInternals';
import { Canvas, DOMMatrix, Image, Path2D } from 'skia-canvas';

// Type mismatch: skia-canvas exposes runtime-compatible DOMMatrix/Path2D shims but their declared
// types are not nominally identical to the DOM globals. Konva only relies on the shape of these
// constructors, so the assignment is safe at runtime.
// @ts-expect-error skia-canvas DOMMatrix is shape-compatible with the DOM global
global.DOMMatrix = DOMMatrix;

// @ts-expect-error skia-canvas Path2D is shape-compatible with the DOM global
global.Path2D = Path2D;
Path2D.prototype.toString = () => '[object Path2D]';

Konva.Util['createCanvasElement'] = () => {
  const node = new Canvas(300, 300);
  node.gpu = false;

  if (!('style' in node) || !node['style']) {
    Object.assign(node, { style: {} });
  }

  node.toString = () => '[object HTMLCanvasElement]';
  const ctx = node.getContext('2d');

  Object.defineProperty(ctx, 'canvas', {
    get: () => node,
  });

  return node as unknown as HTMLCanvasElement;
};

Konva.Util.createImageElement = () => {
  const node = new Image();
  node.toString = () => '[object HTMLImageElement]';

  return node as unknown as HTMLImageElement;
};

Konva._renderBackend = 'skia-canvas';

export default Konva;

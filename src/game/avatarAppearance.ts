import { AVATAR_SIZE, type PoseId } from "./config";

export interface EyeGeometry {
  cx: number;
  cy: number;
  naturalRx: number;
  naturalRy: number;
}

// Per-pose geometry measured from the authored 512px PNGs, then expressed in
// the 192px studio space. `naturalR*` follows the *outside* of the orange eye
// ring — everything beyond it is face/body. The authored eye is slightly oval,
// so circles are visibly wrong, especially in the flat pose.
export const EYE_GEOMETRY: Readonly<Record<PoseId, EyeGeometry>> = {
  stand: { cx: 96.38, cy: 57.38, naturalRx: 12.4, naturalRy: 14.2 },
  curl: { cx: 99.2, cy: 79.9, naturalRx: 13.5, naturalRy: 15.9 },
  flat: { cx: 77.8, cy: 104.1, naturalRx: 14.6, naturalRy: 16.5 },
};

const IVORY = [244, 232, 207] as const;
const STRUCTURAL_LINE_MAX = 70;

/**
 * Return a cached-friendly, ivory-bodied rendering of an authored avatar.
 *
 * The source already contains the right silhouette, line work and soft ivory
 * shading. Every non-eye body pixel except the genuinely dark structural line
 * work is compressed into a narrow warm-ivory value range, so no teal/orange
 * motif can survive as a grey decal. This is a one-time pixel pass when an
 * avatar PNG loads — never part of an animation frame.
 */
export function makeIvoryAvatar(
  source: CanvasImageSource,
  pose: PoseId,
  size = AVATAR_SIZE,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, size, size);

  const pixels = context.getImageData(0, 0, size, size);
  const data = pixels.data;
  const scale = size / AVATAR_SIZE;
  const eye = EYE_GEOMETRY[pose];
  const eyeX = eye.cx * scale;
  const eyeY = eye.cy * scale;
  const eyeRx = eye.naturalRx * scale;
  const eyeRy = eye.naturalRy * scale;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      if (data[index + 3] === 0) continue;
      const dx = x - eyeX;
      const dy = y - eyeY;
      if ((dx * dx) / (eyeRx * eyeRx) + (dy * dy) / (eyeRy * eyeRy) <= 1) continue;

      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      if (Math.max(red, green, blue) <= STRUCTURAL_LINE_MAX) continue;

      // Preserve just enough of the source value for the sculpted form to read,
      // while making former orange/teal regions indistinguishable as motifs.
      const luminance = (red * .2126 + green * .7152 + blue * .0722) / 255;
      const shade = .9 + luminance * .1;
      data[index] = Math.round(IVORY[0] * shade);
      data[index + 1] = Math.round(IVORY[1] * shade);
      data[index + 2] = Math.round(IVORY[2] * shade);
    }
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

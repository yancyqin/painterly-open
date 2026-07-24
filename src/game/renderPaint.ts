import { AVATAR_SIZE } from "./config";
import {
  PAINT_RASTER_SIZE,
  packPaintRaster,
  unpackPaintRaster,
  type PaintMark,
} from "./paint";

function drawMark(ctx: CanvasRenderingContext2D, mark: PaintMark, color: string) {
  ctx.save();
  ctx.translate(mark.x, mark.y);
  ctx.rotate(mark.angle);
  ctx.globalAlpha = mark.alpha;

  if (mark.shape === "dot") {
    const radius = mark.size / 2;
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(Math.max(0.15, 0.82 - mark.soft * 0.55), color);
    gradient.addColorStop(1, color + "00");
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, -radius, mark.size, mark.size);
  } else if (mark.shape === "streak") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, mark.size * 0.62, Math.max(2.2, mark.size * (0.16 + mark.soft * 0.18)), 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mark.shape === "square") {
    ctx.fillStyle = color;
    const side = mark.size * 0.78;
    ctx.fillRect(-side / 2, -side / 2, side, side);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, mark.size * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, mark.size * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPaintMarks(
  ctx: CanvasRenderingContext2D,
  marks: readonly PaintMark[],
  palette: readonly string[],
) {
  for (const mark of marks) drawMark(ctx, mark, palette[mark.colorIndex] ?? palette[0] ?? "#ffffff");
}

export function drawPaintedAvatar(
  ctx: CanvasRenderingContext2D,
  mask: CanvasImageSource,
  marks: readonly PaintMark[],
  palette: readonly string[]
) {
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.save();
  ctx.drawImage(mask, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#f5f1e6";
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.globalCompositeOperation = "source-atop";
  drawPaintMarks(ctx, marks, palette);
  ctx.restore();
}

export function drawPaintedAvatarLayers(
  ctx: CanvasRenderingContext2D,
  mask: CanvasImageSource,
  layers: readonly CanvasImageSource[],
) {
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.save();
  ctx.drawImage(mask, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#f5f1e6";
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.globalCompositeOperation = "source-atop";
  for (const layer of layers) ctx.drawImage(layer, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.restore();
}

let rasterCanvas: HTMLCanvasElement | null = null;
let rasterContext: CanvasRenderingContext2D | null = null;

function rasterScratch(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!rasterCanvas) {
    rasterCanvas = document.createElement("canvas");
    rasterCanvas.width = PAINT_RASTER_SIZE;
    rasterCanvas.height = PAINT_RASTER_SIZE;
    rasterContext = rasterCanvas.getContext("2d", { willReadFrequently: true })!;
  }
  return [rasterCanvas, rasterContext!];
}

export function packPaintedAvatarCanvas(source: CanvasImageSource): Uint8Array {
  const [canvas, ctx] = rasterScratch();
  ctx.clearRect(0, 0, PAINT_RASTER_SIZE, PAINT_RASTER_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, PAINT_RASTER_SIZE, PAINT_RASTER_SIZE);
  return packPaintRaster(ctx.getImageData(0, 0, PAINT_RASTER_SIZE, PAINT_RASTER_SIZE).data);
}

export function drawPackedPaintRaster(
  ctx: CanvasRenderingContext2D,
  packed: unknown,
): boolean {
  const rgba = unpackPaintRaster(packed);
  if (!rgba) return false;
  const [canvas, rasterCtx] = rasterScratch();
  const image = rasterCtx.createImageData(PAINT_RASTER_SIZE, PAINT_RASTER_SIZE);
  image.data.set(rgba);
  rasterCtx.putImageData(image, 0, 0);
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.restore();
  return true;
}

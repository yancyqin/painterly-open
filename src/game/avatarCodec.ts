const OUTPUT_SIZE = 128;
const MAX_AVATAR_BYTES = 60_000;

export async function encodeAvatar(source: CanvasImageSource): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const webp = await canvasBlob(canvas, "image/webp", 0.78);
  const blob = webp && webp.type === "image/webp"
    ? webp
    : await canvasBlob(canvas, "image/png");
  if (!blob) throw new Error("This browser could not encode the painted chameleon.");
  if (blob.size > MAX_AVATAR_BYTES) {
    throw new Error("The painted chameleon is too detailed to publish. Clear a few strokes and try again.");
  }
  return blobToDataUrl(blob);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read encoded avatar."));
    reader.readAsDataURL(blob);
  });
}

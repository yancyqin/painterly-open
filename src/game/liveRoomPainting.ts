import {
  LIVE_ALPHA_WAVE_SPEED_MIN,
  LIVE_ALPHA_WAVE_SPEED_RANGE,
  LIVE_FORCE_STRENGTH,
  LIVE_GRAPHITE_SPEED_MIN,
  LIVE_GRAPHITE_SPEED_RANGE,
  liveAlphaWaveState,
  liveCurrentState,
  liveGraphiteState,
  makeOrganicFadeStamp,
} from "./livePainting";

export const UNFINISHED_MORNING_COLOR_BACKGROUND_URL = new URL(
  "./assets/rooms/unfinished-morning/donors/unfinished-morning-blank-canvas-owner-donor-v3.jpg",
  import.meta.url,
).href;

export const UNFINISHED_MORNING_HUMANIST_COLOR_BACKGROUND_URL = new URL(
  "./assets/rooms/unfinished-morning/donors/unfinished-morning-humanist-owner-donor-v5.jpg",
  import.meta.url,
).href;

export const UNFINISHED_MORNING_HANDSCROLL_COLOR_BACKGROUND_URL = new URL(
  "./assets/rooms/unfinished-morning/donors/unfinished-morning-handscroll-owner-donor-v4.jpg",
  import.meta.url,
).href;

export const UNFINISHED_MORNING_FOG_DENSITY_URL = new URL(
  "./assets/rooms/unfinished-morning/effects/unfinished-morning-fog-density-v1.png",
  import.meta.url,
).href;

export function unfinishedMorningLiveBackgroundUrl(roomIndex: number): string | null {
  if (roomIndex === 0) return UNFINISHED_MORNING_COLOR_BACKGROUND_URL;
  if (roomIndex === 1) return UNFINISHED_MORNING_HUMANIST_COLOR_BACKGROUND_URL;
  if (roomIndex === 2) return UNFINISHED_MORNING_HANDSCROLL_COLOR_BACKGROUND_URL;
  return null;
}

/** The shell whose geometry each color donor was authored against. */
export function unfinishedMorningLiveBaseSurface(roomIndex: number): 0 | 1 | 2 | null {
  if (roomIndex === 0) return 0; // 6A's matching study was normalized to v1.
  if (roomIndex === 1) return 0; // 6B donor was restored from v1.
  if (roomIndex === 2) return 0; // 6C donor is structurally closest to v1.
  return null;
}

const ROOM_WIDTH = 960;
const ROOM_HEIGHT = 640;
const FX_SCALE = .5;
const FX_WIDTH = ROOM_WIDTH * FX_SCALE;
const FX_HEIGHT = ROOM_HEIGHT * FX_SCALE;

type RGB = readonly [number, number, number];

interface CurrentMark {
  x: number;
  y: number;
  size: number;
  seed: number;
  angle: number;
  color: RGB;
}

interface FadePool {
  distanceFromWhite: Float32Array;
  maxDistance: number;
  seed: number;
  speed: number;
}

interface DraftLine {
  x: number;
  y: number;
  length: number;
  bend: number;
  angle: number;
  seed: number;
  speed: number;
  weight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hash(seed: number): number {
  const value = Math.sin((seed + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function imageReady(image: HTMLImageElement): boolean {
  return Boolean(image.complete && image.naturalWidth && image.naturalHeight);
}

/**
 * The fixed, reviewed 6A background preset. It is intentionally separate from
 * challenge data: the challenge only says Live is on; all room composition and
 * force strength stay game-shipped and deterministic.
 */
export class UnfinishedMorningLiveRoomRenderer {
  private readonly sourceCanvas = document.createElement("canvas");
  private sourcePixels: Uint8ClampedArray | null = null;
  private readonly donorLayer = document.createElement("canvas");
  private readonly donorMask = document.createElement("canvas");
  private donorMaskImage: ImageData | null = null;
  private cloudNoise = new Float32Array(FX_WIDTH * FX_HEIGHT);
  private lastDonorMaskTime = Number.NEGATIVE_INFINITY;
  private faceFadeStamp: HTMLCanvasElement | null = null;
  private currentMarks: CurrentMark[] = [];
  private readonly fadePools: FadePool[] = [];
  private readonly draftLines: DraftLine[] = [];
  private preparedImage: HTMLImageElement | null = null;
  private preparedRoom = -1;

  constructor() {
    this.sourceCanvas.width = FX_WIDTH;
    this.sourceCanvas.height = FX_HEIGHT;
    for (const canvas of [this.donorLayer, this.donorMask]) {
      canvas.width = FX_WIDTH;
      canvas.height = FX_HEIGHT;
    }
    const maskContext = this.donorMask.getContext("2d")!;
    this.donorMaskImage = maskContext.createImageData(FX_WIDTH, FX_HEIGHT);
    for (let offset = 0; offset < this.donorMaskImage.data.length; offset += 4) {
      this.donorMaskImage.data[offset] = 255;
      this.donorMaskImage.data[offset + 1] = 255;
      this.donorMaskImage.data[offset + 2] = 255;
    }
  }

  dispose(): void {
    this.sourcePixels = null;
    this.donorMaskImage = null;
    this.currentMarks = [];
    this.fadePools.length = 0;
    this.draftLines.length = 0;
    this.preparedImage = null;
    this.preparedRoom = -1;
    if (this.faceFadeStamp) {
      this.faceFadeStamp.width = 0;
      this.faceFadeStamp.height = 0;
      this.faceFadeStamp = null;
    }
    for (const canvas of [this.sourceCanvas, this.donorLayer, this.donorMask]) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  /** Draw the full-color donor with staggered soft transparency over a shell. */
  draw(
    context: CanvasRenderingContext2D,
    liveBackground: HTMLImageElement,
    _fogDensity: HTMLImageElement | null,
    roomIndex: number,
    timeSeconds: number,
  ): boolean {
    if (!imageReady(liveBackground)) return false;
    const normalizedRoom = clamp(Math.round(roomIndex), 0, 2);
    if (this.preparedImage !== liveBackground || this.preparedRoom !== normalizedRoom) {
      this.prepare(liveBackground, normalizedRoom);
    }
    const strength = LIVE_FORCE_STRENGTH;
    this.drawFadingDonor(context, timeSeconds, strength);
    if (normalizedRoom === 0) this.drawBlueCurrent(context, timeSeconds, strength);
    if (normalizedRoom === 0) this.drawGroundGraphite(context, timeSeconds, strength);
    return true;
  }

  private prepare(source: HTMLImageElement, roomIndex: number): void {
    const context = this.sourceCanvas.getContext("2d", { willReadFrequently: true })!;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, FX_WIDTH, FX_HEIGHT);
    context.drawImage(source, 0, 0, FX_WIDTH, FX_HEIGHT);
    const donor = context.getImageData(0, 0, FX_WIDTH, FX_HEIGHT);
    // Owner-authored white holes are the permanent transparent portion of the
    // donor. JPEG makes their feather slightly off-white, so key by Euclidean
    // distance: a pure-white core becomes alpha 0 while its soft edge remains
    // a continuous matte into the warm, non-white painting.
    for (let offset = 0; offset < donor.data.length; offset += 4) {
      const redDistance = 255 - (donor.data[offset] ?? 255);
      const greenDistance = 255 - (donor.data[offset + 1] ?? 255);
      const blueDistance = 255 - (donor.data[offset + 2] ?? 255);
      const distanceFromWhite = Math.hypot(redDistance, greenDistance, blueDistance);
      const sourceAlpha = (donor.data[offset + 3] ?? 255) / 255;
      donor.data[offset + 3] = Math.round(
        255 * sourceAlpha * smoothstep(5, 38, distanceFromWhite),
      );
    }
    context.putImageData(donor, 0, 0);
    this.sourcePixels = donor.data;
    this.makeFadePools(roomIndex);
    this.removeWhiteFringe(donor);
    context.putImageData(donor, 0, 0);
    this.currentMarks = roomIndex === 0 ? this.makeCurrentMarks() : [];
    this.lastDonorMaskTime = Number.NEGATIVE_INFINITY;
    this.makeDraftLines(roomIndex);
    this.preparedImage = source;
    this.preparedRoom = roomIndex;
  }

  private makeFadePools(roomIndex: number): void {
    this.fadePools.length = 0;
    this.makeWhiteRegionFadePools(roomIndex);
  }

  /** Remove all white paint; the Live transition is alpha-only. */
  private removeWhiteFringe(donor: ImageData): void {
    if (!this.fadePools.length) return;
    for (let pixel = 0; pixel < FX_WIDTH * FX_HEIGHT; pixel += 1) {
      let distanceFromWhite = Number.POSITIVE_INFINITY;
      for (const pool of this.fadePools) {
        distanceFromWhite = Math.min(distanceFromWhite, pool.distanceFromWhite[pixel]!);
      }
      const offset = pixel * 4;
      const colorDistanceFromWhite = Math.hypot(
        255 - (donor.data[offset] ?? 255),
        255 - (donor.data[offset + 1] ?? 255),
        255 - (donor.data[offset + 2] ?? 255),
      );
      // White and near-white pixels never enter the animated layer anywhere,
      // not even at low opacity. Real donor color fades in only through alpha,
      // with an additional transparent gutter along every source white edge.
      const coloredContent = smoothstep(82, 132, colorDistanceFromWhite);
      const transparentFeather = distanceFromWhite >= 28
        ? 1
        : smoothstep(7, 28, distanceFromWhite);
      const keepAlpha = coloredContent * transparentFeather;
      donor.data[offset + 3] = Math.round((donor.data[offset + 3] ?? 0) * keepAlpha);
    }
  }

  /** Find each permanent white hole and use it as one staggered cloud origin. */
  private makeWhiteRegionFadePools(roomIndex: number): void {
    const pixels = this.sourcePixels;
    if (!pixels) return;
    const pixelCount = FX_WIDTH * FX_HEIGHT;
    const visited = new Uint8Array(pixelCount);
    const regions: number[][] = [];

    for (let start = 0; start < pixelCount; start += 1) {
      if (visited[start]) continue;
      visited[start] = 1;
      if ((pixels[start * 4 + 3] ?? 255) > 8) continue;

      const queue = [start];
      let cursor = 0;
      while (cursor < queue.length) {
        const index = queue[cursor++]!;
        const x = index % FX_WIDTH;
        const neighbors = [index - 1, index + 1, index - FX_WIDTH, index + FX_WIDTH];
        for (let side = 0; side < neighbors.length; side += 1) {
          const neighbor = neighbors[side]!;
          if (neighbor < 0 || neighbor >= pixelCount || visited[neighbor]) continue;
          const neighborX = neighbor % FX_WIDTH;
          if (side === 0 && neighborX !== x - 1) continue;
          if (side === 1 && neighborX !== x + 1) continue;
          visited[neighbor] = 1;
          if ((pixels[neighbor * 4 + 3] ?? 255) <= 8) queue.push(neighbor);
        }
      }

      // Ignore isolated compression pinholes. The owner-painted white regions
      // are thousands of half-resolution pixels, so this threshold is ample.
      if (queue.length < 48) continue;
      regions.push(queue);
    }

    regions.sort((left, right) => right.length - left.length);
    for (let y = 0; y < FX_HEIGHT; y += 1) {
      for (let x = 0; x < FX_WIDTH; x += 1) {
        const index = y * FX_WIDTH + x;
        // Broad low-frequency ripples break up the distance front without the
        // per-pixel sparkle of random noise.
        this.cloudNoise[index] =
          Math.sin(x * .041 + y * .017 + roomIndex * 1.73) * .47
          + Math.sin(x * .016 - y * .053 + roomIndex * 2.31) * .31
          + Math.sin((x + y) * .009 + roomIndex * 3.17) * .22;
      }
    }

    for (let index = 0; index < regions.length; index += 1) {
      const region = regions[index]!;
      const siteSeed = 31_019 + roomIndex * 2_003 + index * 271;
      const distance = new Float32Array(pixelCount);
      distance.fill(Number.POSITIVE_INFINITY);
      for (const whitePixel of region) distance[whitePixel] = 0;

      // Two-pass 8-neighbour chamfer distance. Because every white pixel is a
      // zero source, distance 0 is the actual white region and distance 1
      // begins immediately outside its edge — never at a guessed centre.
      for (let y = 0; y < FX_HEIGHT; y += 1) {
        for (let x = 0; x < FX_WIDTH; x += 1) {
          const pixel = y * FX_WIDTH + x;
          let best = distance[pixel]!;
          if (x > 0) best = Math.min(best, distance[pixel - 1]! + 1);
          if (y > 0) best = Math.min(best, distance[pixel - FX_WIDTH]! + 1);
          if (x > 0 && y > 0) best = Math.min(best, distance[pixel - FX_WIDTH - 1]! + Math.SQRT2);
          if (x + 1 < FX_WIDTH && y > 0) best = Math.min(best, distance[pixel - FX_WIDTH + 1]! + Math.SQRT2);
          distance[pixel] = best;
        }
      }
      let maxDistance = 0;
      for (let y = FX_HEIGHT - 1; y >= 0; y -= 1) {
        for (let x = FX_WIDTH - 1; x >= 0; x -= 1) {
          const pixel = y * FX_WIDTH + x;
          let best = distance[pixel]!;
          if (x + 1 < FX_WIDTH) best = Math.min(best, distance[pixel + 1]! + 1);
          if (y + 1 < FX_HEIGHT) best = Math.min(best, distance[pixel + FX_WIDTH]! + 1);
          if (x + 1 < FX_WIDTH && y + 1 < FX_HEIGHT) best = Math.min(best, distance[pixel + FX_WIDTH + 1]! + Math.SQRT2);
          if (x > 0 && y + 1 < FX_HEIGHT) best = Math.min(best, distance[pixel + FX_WIDTH - 1]! + Math.SQRT2);
          distance[pixel] = best;
          maxDistance = Math.max(maxDistance, best);
        }
      }

      this.fadePools.push({
        distanceFromWhite: distance,
        maxDistance,
        // Distribute phases before adding a small deterministic wobble so no
        // two white regions inhale or disappear at the same moment.
        seed: (index / regions.length + hash(siteSeed + 7) * .16) % 1,
        speed: LIVE_ALPHA_WAVE_SPEED_MIN + hash(siteSeed + 11) * LIVE_ALPHA_WAVE_SPEED_RANGE,
      });
    }
  }

  private makeDraftLines(roomIndex: number): void {
    this.draftLines.length = 0;
    if (roomIndex !== 0) return;
    // Keep Graphite Whisper as a sparse accent: roughly 10% of the original
    // 72-line field, so it no longer competes with the donor diffusion.
    const lineCount = 7;
    for (let index = 0; index < lineCount; index += 1) {
      const seed = 811 + roomIndex * 1301 + index * 31;
      let x: number;
      let y: number;
      let angle: number;
      let length: number;
      const vanishingX = 485;
      const vanishingY = 292;
      const floorStart = 342;
      x = 92 + hash(seed + 3) * 790;
      y = floorStart + Math.pow(hash(seed + 1), .72) * 225;
      const perspectiveAngle = Math.atan2(y - vanishingY, x - vanishingX);
      angle = perspectiveAngle + (index % 3 === 0 ? Math.PI / 2 : 0) + (hash(seed + 11) - .5) * .28;
      length = 18 + hash(seed + 5) * (42 + (y - floorStart) * .13);
      this.draftLines.push({
        x,
        y,
        length,
        bend: (hash(seed + 7) - .5) * 10,
        angle,
        seed: hash(seed + 13),
        speed: LIVE_GRAPHITE_SPEED_MIN + hash(seed + 17) * LIVE_GRAPHITE_SPEED_RANGE,
        weight: .55 + hash(seed + 19) * .75,
      });
    }
  }

  private makeCurrentMarks(): CurrentMark[] {
    const pixels = this.sourcePixels!;
    const marks: CurrentMark[] = [];
    for (let index = 0; index < 34; index += 1) {
      const u = index / 33;
      const x = 430 + u * 410;
      const y = 68 + Math.sin(u * Math.PI * 1.1) * 84 + Math.sin(u * Math.PI * 3) * 14;
      const px = clamp(Math.round(x * FX_SCALE), 0, FX_WIDTH - 1);
      const py = clamp(Math.round(y * FX_SCALE), 0, FX_HEIGHT - 1);
      const offset = (py * FX_WIDTH + px) * 4;
      const sampled: RGB = [pixels[offset] ?? 190, pixels[offset + 1] ?? 204, pixels[offset + 2] ?? 211];
      // Preserve the demo's photo color but keep the current legibly blue.
      const color: RGB = [
        Math.round(sampled[0] * .58 + 91 * .42),
        Math.round(sampled[1] * .58 + 136 * .42),
        Math.round(sampled[2] * .58 + 156 * .42),
      ];
      marks.push({
        x,
        y,
        size: 24 + hash(1700 + index * 5) * 22,
        seed: hash(1700 + index * 7),
        angle: .1 + Math.cos(u * Math.PI) * .28,
        color,
      });
    }
    return marks;
  }

  private drawFadingDonor(context: CanvasRenderingContext2D, time: number, strength: number): void {
    const mask = this.donorMask.getContext("2d")!;
    // The 480×320 distance mask only needs 30 fps. Bilinear scale-up and the
    // very broad feather hide the half-frame cadence while halving CPU work.
    // While the player walks, GameCanvas holds the live clock (see uiFrame),
    // so `time` stops advancing → this gate skips the per-pixel rebuild and
    // only the cheap composite below runs, keeping a move frame light.
    if (time < this.lastDonorMaskTime || time - this.lastDonorMaskTime >= 1 / 30) {
      const image = this.donorMaskImage!;
      const waves = this.fadePools.map((pool, index) => {
        const wave = liveAlphaWaveState(time, pool.seed, pool.speed);
        return {
          distance: pool.distanceFromWhite,
          front: (pool.maxDistance + 46) * wave.growth,
          band: 30 + wave.growth * 84,
          softness: 25 + wave.growth * 30,
          noiseAmount: 5 + wave.growth * 17,
          opacity: wave.opacity * (.84 + hash(index * 149 + this.preparedRoom * 401) * .16) * strength,
        };
      });

      for (let pixel = 0; pixel < FX_WIDTH * FX_HEIGHT; pixel += 1) {
        let combinedAlpha = 0;
        for (const wave of waves) {
          if (wave.opacity <= .001) continue;
          const distance = wave.distance[pixel]! + this.cloudNoise[pixel]! * wave.noiseAmount;
          // A broad annulus is defined entirely by distance from the real white
          // boundary. It begins at distance 0, moves outward, and leaves the
          // already-crossed area transparent again like a dissipating smoke ring.
          const outer = 1 - smoothstep(
            wave.front - wave.softness,
            wave.front + wave.softness,
            distance,
          );
          const innerFront = wave.front - wave.band;
          const inner = smoothstep(
            innerFront - wave.softness,
            innerFront + wave.softness,
            distance,
          );
          const contribution = outer * inner * wave.opacity;
          combinedAlpha = 1 - (1 - combinedAlpha) * (1 - contribution);
        }
        image.data[pixel * 4 + 3] = Math.round(clamp(combinedAlpha, 0, 1) * 255);
      }
      mask.setTransform(1, 0, 0, 1, 0, 0);
      mask.globalCompositeOperation = "source-over";
      mask.globalAlpha = 1;
      mask.putImageData(image, 0, 0);

      // The previously approved exception remains: the 6B Creator's face is
      // always supplied by the shell below, never covered by the donor.
      if (this.preparedRoom === 1) {
        const faceStamp = this.faceFadeStamp ??= makeOrganicFadeStamp(240, 701 + 2 * 97);
        mask.globalCompositeOperation = "destination-out";
        mask.globalAlpha = 1;
        mask.drawImage(faceStamp, 150, 24, 42, 42);
      }
      this.lastDonorMaskTime = time;
    }
    mask.globalCompositeOperation = "source-over";
    mask.globalAlpha = 1;

    const layer = this.donorLayer.getContext("2d")!;
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.globalCompositeOperation = "source-over";
    layer.globalAlpha = 1;
    layer.clearRect(0, 0, FX_WIDTH, FX_HEIGHT);
    layer.drawImage(this.sourceCanvas, 0, 0);
    layer.globalCompositeOperation = "destination-in";
    layer.drawImage(this.donorMask, 0, 0);
    layer.globalCompositeOperation = "source-over";
    context.save();
    context.imageSmoothingEnabled = true;
    context.drawImage(this.donorLayer, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
    context.restore();
  }

  private drawBlueCurrent(context: CanvasRenderingContext2D, time: number, strength: number): void {
    context.save();
    for (const mark of this.currentMarks) {
      const current = liveCurrentState(time, mark.seed);
      const size = mark.size * current.sizeScale;
      context.save();
      context.translate(mark.x + current.slide, mark.y + current.yDrift);
      context.rotate(mark.angle);
      context.globalAlpha = current.opacity * strength;
      // Same 112×42 S-current as the former tinted stamp, drawn directly in
      // the sampled color. This removes one GPU-backed canvas per color/mark.
      const [red, green, blue] = mark.color;
      context.translate(-size * 1.3, -size * .32);
      context.scale(size * 2.6 / 112, size * .64 / 42);
      const gradient = context.createLinearGradient(0, 21, 112, 21);
      gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0)`);
      gradient.addColorStop(.25, `rgba(${red}, ${green}, ${blue}, .25)`);
      gradient.addColorStop(.54, `rgba(${red}, ${green}, ${blue}, .82)`);
      gradient.addColorStop(.78, `rgba(${red}, ${green}, ${blue}, .22)`);
      gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
      context.strokeStyle = gradient;
      context.lineWidth = 8;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(4, 28);
      context.bezierCurveTo(34, 2, 70, 38, 108, 13);
      context.stroke();
      context.restore();
    }
    context.restore();
  }

  private drawGroundGraphite(context: CanvasRenderingContext2D, time: number, strength: number): void {
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgb(82, 85, 82)";
    for (const line of this.draftLines) {
      const graphite = liveGraphiteState(time, line.seed, line.speed);
      if (graphite.end - graphite.start <= .001) continue;
      context.save();
      // The authored vector stays fixed. Only its endpoint advances, like a
      // pencil physically drawing the path; it never jitters as a whole line.
      context.translate(line.x, line.y);
      context.rotate(line.angle);
      context.lineWidth = line.weight;
      context.globalAlpha = .34 * clamp(strength, .45, 1.1);
      this.strokeDraftVector(context, line, graphite.start, graphite.end);
      context.restore();
    }
    context.restore();
  }

  private strokeDraftVector(
    context: CanvasRenderingContext2D,
    line: DraftLine,
    startProgress: number,
    endProgress: number,
  ): void {
    const startX = -line.length / 2;
    const startY = 0;
    const controlX = 0;
    const controlY = line.bend;
    const endX = line.length / 2;
    const endY = line.bend * .16;
    const start = clamp(startProgress, 0, 1);
    const end = clamp(endProgress, 0, 1);
    if (end <= start) return;
    const pointAt = (t: number): readonly [number, number] => {
      const inverse = 1 - t;
      return [
        inverse * inverse * startX + 2 * inverse * t * controlX + t * t * endX,
        inverse * inverse * startY + 2 * inverse * t * controlY + t * t * endY,
      ];
    };
    const [firstX, firstY] = pointAt(start);
    const segments = Math.max(1, Math.ceil((end - start) * 18));
    context.beginPath();
    context.moveTo(firstX, firstY);
    for (let index = 1; index <= segments; index += 1) {
      const [x, y] = pointAt(start + (end - start) * index / segments);
      context.lineTo(x, y);
    }
    context.stroke();
  }

}

export function supportsLiveRoomPainting(artHouse: string, roomIndex: number): boolean {
  return artHouse === "unfinished-morning" && roomIndex >= 0 && roomIndex <= 2;
}

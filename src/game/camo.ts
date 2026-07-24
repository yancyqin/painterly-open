import type { ArtRoomDefinition } from "./types";
import type { PaintMark } from "./paint";

function pick(colors: readonly number[], index: number): number {
  return colors[((index % colors.length) + colors.length) % colors.length] ?? 0;
}

// Every room gets a deterministic, removable starter made only from that
// room's authored palette. The preset teaches a mark language; it does not
// copy background pixels or choose the Hider's final surface.
export function makeRoomCamoMarks(room: ArtRoomDefinition): PaintMark[] {
  const marks: PaintMark[] = [];
  const { style, baseColors, accentColors } = room.starterCamo;

  if (style === "blocks") {
    for (let gy = 0; gy < 11; gy++) {
      for (let gx = 0; gx < 11; gx++) {
        const phase = gx * 0.73 + gy * 0.41;
        marks.push({
          x: 9 + gx * 17.4,
          y: 9 + gy * 17.4,
          size: 21,
          angle: (Math.round(phase) % 2) * Math.PI / 2,
          alpha: 0.9,
          soft: 0,
          colorIndex: (gx + gy) % 5 === 0 ? pick(accentColors, gx + gy) : pick(baseColors, gx * 2 + gy),
          shape: "square",
        });
      }
    }
    for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) {
      marks.push({
        x: 18 + gx * 31,
        y: 18 + gy * 31,
        size: 17,
        angle: (gx + gy) % 2 ? 0 : Math.PI / 2,
        alpha: 0.76,
        soft: 0.05,
        colorIndex: pick(accentColors, gx + gy * 3),
        shape: "streak",
      });
    }
    return marks;
  }

  // A broad room-colored underpainting removes the ivory giveaway with only
  // 64 marks, leaving most of the payload budget for the child's own work.
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const wave = Math.sin(gx * 0.83 + gy * 0.57);
      marks.push({
        x: 12 + gx * 24,
        y: 12 + gy * 24,
        size: style === "wash" ? 40 + wave * 5 : 34 + wave * 4,
        angle: wave,
        alpha: style === "wash" ? 0.38 : 0.76,
        soft: style === "wash" ? 1 : 0.82,
        colorIndex: pick(baseColors, gx + gy * 3),
        shape: "dot",
      });
    }
  }

  if (style === "pointillist") {
    for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 12; gx++) {
      const phase = gx * 1.31 + gy * 0.77;
      marks.push({
        x: 7 + gx * 16 + Math.sin(phase) * 3,
        y: 7 + gy * 16 + Math.cos(phase * 1.2) * 3,
        size: 8 + (gx + gy) % 5,
        angle: phase,
        alpha: 0.88,
        soft: 0.2,
        colorIndex: (gx + gy * 2) % 4 === 0 ? pick(accentColors, gx + gy) : pick(baseColors, gx * 3 + gy),
        shape: "dot",
      });
    }
    return marks;
  }

  if (style === "optical") {
    // Monet-inspired optical mixing: translucent neighboring colors share a
    // horizontal reflection rhythm, but no single dab copies a room pixel.
    for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 13; gx++) {
      const phase = gx * 0.74 + gy * 0.53;
      const accent = (gx * 3 + gy * 5) % 9 === 0;
      marks.push({
        x: 5 + gx * 15.2 + Math.sin(phase) * 2.8,
        y: 7 + gy * 15.8 + Math.cos(phase * 1.17) * 2.4,
        size: 10 + (gx + gy) % 5,
        angle: Math.sin(phase * 0.61) * 0.28,
        alpha: 0.48 + ((gx + gy) % 3) * 0.08,
        soft: 0.42,
        colorIndex: accent ? pick(accentColors, gx + gy) : pick(baseColors, gx * 2 + gy),
        shape: (gx + gy) % 4 === 0 ? "dot" : "streak",
      });
    }
    return marks;
  }

  if (style === "wash") {
    for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 9; gx++) {
      const phase = gx * 0.49 + gy * 0.81;
      marks.push({
        x: 10 + gx * 21.5 + Math.sin(phase) * 4,
        y: 10 + gy * 21.5 + Math.cos(phase) * 3,
        size: 27 + Math.sin(phase * 1.8) * 7,
        angle: -0.25 + Math.sin(phase) * 0.45,
        alpha: 0.24,
        soft: 0.9,
        colorIndex: (gx + gy) % 6 === 0 ? pick(accentColors, gx + gy) : pick(baseColors, gx + gy * 2),
        shape: "streak",
      });
    }
    return marks;
  }

  const rows = style === "facets" ? 10 : 10;
  const cols = style === "facets" ? 10 : 12;
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const phase = gx * 0.61 + gy * 0.47;
    const accent = (gx + gy * 5) % 7 === 0;
    marks.push({
      x: 8 + gx * (176 / Math.max(1, cols - 1)),
      y: 10 + gy * (172 / Math.max(1, rows - 1)),
      size: style === "facets" ? 23 : 20 + Math.sin(phase * 1.7) * 4,
      angle: style === "facets" ? Math.round(Math.sin(phase) * 2) * Math.PI / 4 : -0.72 + Math.sin(phase) * 0.92,
      alpha: 0.84,
      soft: style === "facets" ? 0.02 : 0.08,
      colorIndex: accent ? pick(accentColors, gx + gy) : pick(baseColors, gx * 2 + gy),
      shape: style === "facets" ? "square" : "streak",
    });
  }
  return marks;
}

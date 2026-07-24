import type { ArtHouseId, ArtRoomDefinition } from "./types";

export const VAN_GOGH_ROOM: ArtRoomDefinition = {
  id: "van-gogh-house",
  title: "Van Gogh House",
  livePainting: true,
  liveBrushes: ["firefly", "growth", "color-liquify-splash"],
  palette: [
    "#102451", "#173b78", "#285d9b", "#457da4",
    "#d18b25", "#e8ad32", "#f3cf62", "#eadca6",
    "#6d3f28", "#3f6848", "#66864c", "#b95b35",
  ],
  artTip: "Borrow the room's direction, edge and value instead of filling the whole body one color.",
  defaultShape: "streak",
  starterCamo: {
    label: "Van Gogh Camo",
    help: "A removable cobalt, ochre and sunflower-colored starting layer.",
    style: "swirl",
    baseColors: [0, 1, 2, 3],
    accentColors: [4, 5, 6, 8, 9, 10, 11],
  },
};

export const MONET_ROOM: ArtRoomDefinition = {
  id: "monet-garden-house",
  title: "Monet Garden House",
  palette: [
    "#435f68", "#5f7f7b", "#7fa39a", "#a9c0ad",
    "#6d73a5", "#8f8fbd", "#b8acd0", "#d9cae0",
    "#c99b83", "#e1b9a3", "#d8c873", "#eee2b8",
  ],
  artTip: "Match light and temperature before hue. Neighboring translucent dabs mix at room scale.",
  defaultShape: "dot",
  starterCamo: {
    label: "Garden Light Camo",
    help: "A removable layer of teal, lavender, rose and pale-yellow reflected light.",
    style: "optical",
    baseColors: [0, 1, 2, 4, 5, 6],
    accentColors: [3, 7, 8, 9, 10, 11],
  },
};

export const OUTDOOR_MASTERS_ROOM: ArtRoomDefinition = {
  id: "outdoor-masters-journey",
  title: "Outdoor Masters Journey",
  palette: [
    "#102c67", "#174ca6", "#e4572e", "#f28c28",
    "#ffc93c", "#efe06a", "#1f7a62", "#65a844",
    "#8b3fa0", "#d94f8a", "#f2b05e", "#5b274f",
  ],
  artTip: "Match the big light and dark shapes first, then let bold complementary color carry the camouflage.",
  defaultShape: "streak",
  starterCamo: {
    label: "Wild Outdoor Camo",
    help: "A removable layer of cobalt, orange, green and violet marks that follows the terrace and garden paths.",
    style: "swirl",
    baseColors: [0, 1, 2, 3, 4, 11],
    accentColors: [5, 6, 7, 8, 9, 10],
  },
};

export const ART_ROOMS: Readonly<Record<ArtHouseId, ArtRoomDefinition>> = {
  "van-gogh-house": VAN_GOGH_ROOM,
  "monet-garden-house": MONET_ROOM,
  "outdoor-masters-journey": OUTDOOR_MASTERS_ROOM,
};

export function artRoomFor(id: ArtHouseId): ArtRoomDefinition {
  return ART_ROOMS[id];
}

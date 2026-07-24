export const BASE_MOVE_SPEED: number;
export const MOBILE_MOVE_SPEED: number;

export function moveSpeedFor(options?: { coarsePointer?: boolean }): number;

export const INSPECTION_SOURCE_WIDTH: number;
export const INSPECTION_SOURCE_HEIGHT: number;
export const HIDER_RADIUS_X: number;
export const HIDER_RADIUS_Y: number;
export const HIDER_BODY_OFFSET_Y: number;

export function inspectionSource(
  pointX: number,
  pointY: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number };

export interface InspectionCardHitParams {
  tapX: number;
  tapY: number;
  cardWidth: number;
  cardHeight: number;
  sourceX: number;
  sourceY: number;
  sourceWidth?: number;
  sourceHeight?: number;
  hider: { x: number; y: number };
  sameRoom: boolean;
  radiusX?: number;
  radiusY?: number;
  yOffset?: number;
}

export function inspectionCardHit(
  params: InspectionCardHitParams,
): { x: number; y: number; hit: boolean };

export const ROOM_NAME_ADJECTIVES: readonly string[];
export const ROOM_NAME_NOUNS: readonly string[];
export function normalizeRoomName(value: unknown): string | null;
export function normalizeRoomSearch(value: unknown): string | null;
export function randomRoomName(random?: () => number): string;
export function randomRoomNameExcept(excludedName: unknown, random?: () => number): string;

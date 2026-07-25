export const ROOM_NAME_ADJECTIVES = Object.freeze([
  "Blue", "Brave", "Bright", "Calm", "Cozy", "Fresh", "Funny", "Gentle",
  "Golden", "Green", "Happy", "Hidden", "Jolly", "Kind", "Little", "Lucky",
  "Magic", "Merry", "Pink", "Playful", "Quiet", "Red", "Secret", "Silly",
  "Sleepy", "Soft", "Starry", "Sunny", "Sweet", "Tiny", "Wiggly", "Wild",
]);

export const ROOM_NAME_NOUNS = Object.freeze([
  "Bird", "Bloom", "Bunny", "Cloud", "Cove", "Daisy", "Duck", "Fern",
  "Fish", "Flower", "Fox", "Frog", "Garden", "Hill", "Kite", "Lake",
  "Leaf", "Moon", "Nest", "Panda", "Path", "Pebble", "Pond", "Rainbow",
  "River", "Shell", "Sprout", "Star", "Sun", "Tree", "Turtle", "Willow",
]);

const ADJECTIVES_BY_LOWER = new Map(ROOM_NAME_ADJECTIVES.map(word => [word.toLowerCase(), word]));
const NOUNS_BY_LOWER = new Map(ROOM_NAME_NOUNS.map(word => [word.toLowerCase(), word]));

export function normalizeRoomName(value) {
  if (typeof value !== "string") return null;
  const words = value.trim().split(/\s+/u);
  if (words.length !== 2) return null;
  const adjective = ADJECTIVES_BY_LOWER.get(words[0].toLowerCase());
  const noun = NOUNS_BY_LOWER.get(words[1].toLowerCase());
  return adjective && noun ? `${adjective} ${noun}` : null;
}

export function normalizeRoomSearch(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/gu, " ").toLowerCase();
  if (!normalized || normalized.length > 31 || !/^[a-z]+(?: [a-z]+)?$/u.test(normalized)) return null;
  return normalized;
}

export function randomRoomName(random = Math.random) {
  const adjective = ROOM_NAME_ADJECTIVES[Math.floor(random() * ROOM_NAME_ADJECTIVES.length) % ROOM_NAME_ADJECTIVES.length];
  const noun = ROOM_NAME_NOUNS[Math.floor(random() * ROOM_NAME_NOUNS.length) % ROOM_NAME_NOUNS.length];
  return `${adjective} ${noun}`;
}

export function randomRoomNameExcept(excludedName, random = Math.random) {
  const excluded = normalizeRoomName(excludedName);
  if (!excluded) return randomRoomName(random);

  const [excludedAdjective, excludedNoun] = excluded.split(" ");
  const excludedIndex = (
    ROOM_NAME_ADJECTIVES.indexOf(excludedAdjective) * ROOM_NAME_NOUNS.length
    + ROOM_NAME_NOUNS.indexOf(excludedNoun)
  );
  const combinationCount = ROOM_NAME_ADJECTIVES.length * ROOM_NAME_NOUNS.length;
  const candidate = Math.floor(random() * (combinationCount - 1)) % (combinationCount - 1);
  const index = candidate >= excludedIndex ? candidate + 1 : candidate;
  const adjective = ROOM_NAME_ADJECTIVES[Math.floor(index / ROOM_NAME_NOUNS.length)];
  const noun = ROOM_NAME_NOUNS[index % ROOM_NAME_NOUNS.length];
  return `${adjective} ${noun}`;
}

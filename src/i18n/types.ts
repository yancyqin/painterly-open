import type english from "./en";

export type MessageKey = keyof typeof english;
export type Catalog = Record<MessageKey, string>;

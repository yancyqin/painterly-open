// Single source of truth for the store catalog. Both the Worker checkout path
// and tests import this value, while the Worker entry itself only exports its
// supported fetch/scheduled handlers.
export const UNLOCK_PRICE_CENTS = 299;

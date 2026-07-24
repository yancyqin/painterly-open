import test from "node:test";
import assert from "node:assert/strict";

import { UNLOCK_PRICE_CENTS } from "../src/store.js";

test("the one-time all-rooms unlock costs $2.99", () => {
  // This same constant powers both /api/config wording and Stripe
  // price_data.unit_amount, preventing display/checkout price drift.
  assert.equal(UNLOCK_PRICE_CENTS, 299);
});

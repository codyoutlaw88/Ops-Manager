/**
 * Scheduled entry point. GitHub Actions calls this at the top of 6 AM, 11 AM and 3 PM Central.
 *   npm run rundown            -> only runs if it's one of those hours in Chicago (handles daylight saving)
 *   FORCE=1 npm run rundown    -> run now regardless of the hour
 */
import { db } from "../lib/db";
import { currentSlot } from "../lib/time";
import { runOnce } from "./run";

const slot = process.env.FORCE ? process.env.SLOT || "manual" : currentSlot();
if (!slot) {
  console.log("Not a rundown hour in Chicago; nothing to do.");
  process.exit(0);
}
try {
  const r = await runOnce({ slot });
  await db().end();
  process.exit(r?.failure ? 1 : 0);
} catch (e) {
  console.error(e);
  await db().end().catch(() => {});
  process.exit(1);
}

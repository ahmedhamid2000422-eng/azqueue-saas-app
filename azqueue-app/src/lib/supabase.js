import { createClient } from "@supabase/supabase-js";

const url     = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
    "Check that .env contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, " +
    "and restart `npm run dev` after editing."
  );
}

/**
 * Why the auth lock is replaced.
 *
 * supabase-js serialises auth work behind the browser's Web Locks API. When a
 * request is aborted mid-flight — a component unmounting, a tab being
 * backgrounded — the lock can be left held, and every subsequent call queues
 * behind it. In the console this reads as:
 *
 *   Lock "lock:sb-…-auth-token" was not released within 5000ms
 *
 * We were seeing that 221 times in a single session. Each one is a query
 * stalled for five seconds, which is why the Queue page appeared empty and
 * then filled in "randomly" a few seconds later — the data was not missing,
 * it was waiting behind an orphaned lock while staff looked at a room full of
 * people and a screen showing nobody.
 *
 * This replaces the lock with a pass-through. The trade is real and worth
 * stating: without it, two concurrent refreshes of an expired token could
 * both fire, and one may lose the race and be retried. That is a momentary
 * re-login at worst. A front desk that cannot see its own queue is worse.
 *
 * Revisit if supabase-js fixes the orphaned-lock case upstream:
 * https://github.com/supabase/supabase-js/issues/2111
 */
const passThroughLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: passThroughLock,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export default supabase;

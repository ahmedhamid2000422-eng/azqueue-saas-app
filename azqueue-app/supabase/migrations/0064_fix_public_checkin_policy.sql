-- 0064 — public check-in has been broken since 0054
--
-- SYMPTOM
-- "Could not complete check-in. Please try again or ask staff for help."
-- Reported from the Denver office. Worked for Ahmed in Malaysia, which made
-- it look geographic. It was not. It was authentication.
--
-- CAUSE
-- 0001 created the anonymous insert policy:
--
--     with check (source = 'walk' and status = 'waiting')
--
-- 0054 split arrivals into 'kiosk' and 'own_device' and widened the column
-- CHECK constraint to match. It did not touch the RLS policy. From that
-- moment the application inserted a `source` value the policy forbade, so
-- every check-in by a NOT-SIGNED-IN visitor failed.
--
-- Ahmed's testing passed throughout because he is signed in as the branch
-- owner, and the authenticated policy (user_belongs_to_branch) allows any
-- source. The office sees the failure because customers are anonymous.
--
-- This is the same failure shape as the 4 September outage: the code and the
-- column constraint were kept in step, and the third thing that also gates
-- the write — the policy — was forgotten. Worth remembering that a `source`
-- value now has to satisfy THREE places, not two.
--
-- SAFETY
-- Widening a policy only permits writes that are currently rejected. No
-- column is added, nothing deployed reads anything new, and no existing row
-- changes. Safe to run during office hours — and it should be, because
-- check-in is broken until it is.

drop policy if exists tickets_public_insert on public.tickets;

create policy tickets_public_insert on public.tickets
  for insert to anon
  with check (
    /* Every arrival channel a member of the public can legitimately use.
       'book' is excluded on purpose: a booking is created through the
       booking flow against a scheduled slot, not typed in at the kiosk.

       If a new source value is ever added, it has to be added in three
       places — the column CHECK constraint, this policy, and the code.
       Miss this one and check-in fails silently for anonymous visitors
       while continuing to work for anyone signed in, which is exactly how
       this went unnoticed. */
    source in ('walk', 'kiosk', 'own_device')
    and status = 'waiting'
  );

comment on policy tickets_public_insert on public.tickets is
  'Anonymous check-in. Sources must match the values in the tickets_source_check constraint (0054) — keep the two in step.';

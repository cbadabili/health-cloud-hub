#!/usr/bin/env bash
# Two patients book the same slot at the same moment: exactly one must succeed.
set -euo pipefail
DB="$1"
q() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

DOC=$(q -c "SELECT tests.create_user('doc@x', '{\"role\":\"doctor\",\"registration_council\":\"HPCSA\",\"registration_number\":\"MP1\"}')")
P1=$(q -c "SELECT tests.create_user('p1@x', '{\"role\":\"patient\"}')")
P2=$(q -c "SELECT tests.create_user('p2@x', '{\"role\":\"patient\"}')")
q -c "UPDATE public.doctor_verifications SET status = 'approved' WHERE doctor_id = '$DOC'" >/dev/null
q -c "SELECT tests.login('$DOC', 'aal2'); SELECT public.create_practice('Race Clinic', 'ZA');" >/dev/null
PROVIDER=$(q -c "SELECT id FROM public.providers WHERE user_id = '$DOC'")
SLOT=$(q -c "SELECT date_trunc('hour', now()) + interval '3 days 10 hours'")

book() {
  psql -X -q -At -d "$DB" <<SQL 2>&1
SELECT tests.login('$1');
BEGIN;
SELECT CASE WHEN public.book_appointment('$PROVIDER', '$SLOT', 'Race test') IS NOT NULL THEN 'BOOKED' END;
SELECT pg_sleep(1);
COMMIT;
SQL
}
book "$P1" > /tmp/race_p1.$$ & book "$P2" > /tmp/race_p2.$$ & wait
booked=$(cat /tmp/race_p1.$$ /tmp/race_p2.$$ | grep -c BOOKED || true)
taken=$(cat /tmp/race_p1.$$ /tmp/race_p2.$$ | grep -c SLOT_TAKEN || true)
rows=$(q -c "SELECT count(*) FROM public.appointments WHERE reason_for_visit = 'Race test'")
rm -f /tmp/race_p1.$$ /tmp/race_p2.$$
if [[ "$booked" == 1 && "$taken" == 1 && "$rows" == 1 ]]; then
  echo "ok - two simultaneous bookings for one slot: exactly one succeeds, the other gets SLOT_TAKEN"
else
  echo "not ok - race: booked=$booked slot_taken=$taken rows=$rows"
  exit 1
fi

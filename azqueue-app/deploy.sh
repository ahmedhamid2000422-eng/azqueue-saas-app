#!/usr/bin/env bash
# Deploy the AzQueue edge functions.
#
# Run it from this folder with:   bash deploy.sh
#
# Exists so nobody has to paste long commands into a terminal — pasted lines
# pick up the shell prompt, and the "(main)" in it is a bash syntax error.

set -u

PROJECT_REF="haiighdwffvbjfepfttf"

# Functions that are safe to redeploy at any time. All are called by cron or
# by the browser, so none of them verifies a user JWT.
FUNCTIONS=(
  queue-email
  visit-survey
  ai-insights
  daily-report
)

cd "$(dirname "$0")" || exit 1

echo "Deploying from: $(pwd)"
echo ""

failed=0
for fn in "${FUNCTIONS[@]}"; do
  if [ ! -f "supabase/functions/$fn/index.ts" ]; then
    echo "SKIP  $fn  (no index.ts found)"
    continue
  fi

  printf "%-16s" "$fn"
  if supabase functions deploy "$fn" --no-verify-jwt --project-ref "$PROJECT_REF" >/tmp/azq-deploy.log 2>&1; then
    echo "deployed"
  else
    echo "FAILED"
    sed 's/^/    /' /tmp/azq-deploy.log | tail -5
    failed=$((failed + 1))
  fi
done

echo ""
if [ "$failed" -eq 0 ]; then
  echo "All done."
else
  echo "$failed function(s) failed — see the messages above."
fi

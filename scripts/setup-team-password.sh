#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_ENV="$ROOT_DIR/.env.setup.local"

if [[ ! -f "$SETUP_ENV" ]]; then
  echo ".env.setup.local is missing. Rotate TEAM_SETUP_TOKEN with Supabase before running setup." >&2
  exit 1
fi

set -a
source "$SETUP_ENV"
set +a

if [[ -z "${TEAM_SETUP_TOKEN:-}" ]]; then
  echo "TEAM_SETUP_TOKEN is missing from .env.setup.local." >&2
  exit 1
fi

if [[ -z "${TEAM_PASSWORD:-}" ]]; then
  echo "Run with TEAM_PASSWORD set, for example: TEAM_PASSWORD='your password' npm run setup:team-password" >&2
  exit 1
fi

if [[ ${#TEAM_PASSWORD} -lt 8 ]]; then
  echo "TEAM_PASSWORD must be at least 8 characters." >&2
  exit 1
fi

response_file="$(mktemp)"
status_code="$(
  curl --silent --show-error \
    --output "$response_file" \
    --write-out "%{http_code}" \
    --request POST \
    --header "Content-Type: application/json" \
    --header "x-setup-token: $TEAM_SETUP_TOKEN" \
    --data "{\"password\":\"$TEAM_PASSWORD\"}" \
    "https://fejfeysavvwendbjqywa.supabase.co/functions/v1/setup-team-password"
)"

cat "$response_file"
echo
rm -f "$response_file"

if [[ "$status_code" -lt 200 || "$status_code" -ge 300 ]]; then
  echo "Team password setup failed with HTTP $status_code." >&2
  exit 1
fi

echo "Team password setup request completed."

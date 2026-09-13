#!/bin/bash
# Auto-generated for the Banquet Bot Telegram notification pipeline.
#
# Whenever a commit touches rundown.html, index.html, or any of the
# reference pages (menu/rooms/info/training/handbook), re-extracts the
# relevant data, copies it into the (separate, sibling) banquet-bot-telegram
# repo, commits+pushes it there, and — for rundown/index changes —
# refreshes today's + tomorrow's notification schedule immediately.
#
# Fails safe: if an extractor script errors, its stderr is shown but this
# hook does NOT copy a bad/partial file over the last known-good one.
set -uo pipefail

REPO_DIR="/Users/star69/banquet-bot"
TELEGRAM_DIR="/Users/star69/banquet-bot-telegram"
TZ_NAME="America/Chicago"

cd "$REPO_DIR" || exit 0

CHANGED_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD)
schedule_needs_refresh=false
data_changed=false

if echo "$CHANGED_FILES" | grep -qx 'rundown.html'; then
  echo "[post-commit] rundown.html changed — regenerating rundown.json"
  if node scripts/extract-rundown.js; then
    mkdir -p "$TELEGRAM_DIR/data"
    cp data/rundown.json "$TELEGRAM_DIR/data/rundown.json"
    schedule_needs_refresh=true
    data_changed=true
  else
    echo "[post-commit] extract-rundown.js FAILED — leaving telegram rundown.json untouched" >&2
  fi
fi

if echo "$CHANGED_FILES" | grep -qx 'index.html'; then
  echo "[post-commit] index.html changed — regenerating staff-schedule.json"
  if node scripts/extract-staff-schedule.js; then
    mkdir -p "$TELEGRAM_DIR/data"
    cp data/staff-schedule.json "$TELEGRAM_DIR/data/staff-schedule.json"
    schedule_needs_refresh=true
    data_changed=true
  else
    echo "[post-commit] extract-staff-schedule.js FAILED — leaving telegram staff-schedule.json untouched" >&2
  fi
fi

# Reference pages: no schedule impact, just re-extract clean text for Q&A grounding.
for page in menu rooms info training handbook; do
  if echo "$CHANGED_FILES" | grep -qx "$page.html"; then
    echo "[post-commit] $page.html changed — regenerating reference text"
    if node scripts/extract-page-text.js "$page.html" "data/reference/$page.txt"; then
      mkdir -p "$TELEGRAM_DIR/data/reference"
      cp "data/reference/$page.txt" "$TELEGRAM_DIR/data/reference/$page.txt"
      data_changed=true
    else
      echo "[post-commit] extract-page-text.js FAILED for $page.html — leaving telegram copy untouched" >&2
    fi
  fi
done

if [ "$data_changed" = true ]; then
  cd "$TELEGRAM_DIR" || exit 0

  if [ "$schedule_needs_refresh" = true ]; then
    TODAY=$(TZ="$TZ_NAME" date +%Y-%m-%d)
    TOMORROW=$(TZ="$TZ_NAME" date -v+1d +%Y-%m-%d 2>/dev/null || TZ="$TZ_NAME" date -d "+1 day" +%Y-%m-%d)
    node src/generateSchedule.js "$TODAY" || echo "[post-commit] generateSchedule.js failed for $TODAY" >&2
    node src/generateSchedule.js "$TOMORROW" || echo "[post-commit] generateSchedule.js failed for $TOMORROW" >&2
  fi

  git add data/rundown.json data/staff-schedule.json data/reference/*.txt 2>/dev/null

  if ! git diff --cached --quiet; then
    git commit -q -m "Auto-update data from banquet-bot"
    if git remote get-url origin >/dev/null 2>&1; then
      git push -q || echo "[post-commit] push failed — commit made locally only, push manually" >&2
    else
      echo "[post-commit] no git remote configured on banquet-bot-telegram yet — committed locally only"
    fi
  fi
fi

exit 0

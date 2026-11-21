#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FILES="
index.html
production.html
js/main.js
js/main_unpacked.js
js/recode.js
"
MISSING=""

for FILE in $FILES; do
    if [ ! -e "$ROOT/$FILE" ]; then
        MISSING="$MISSING $FILE"
    fi
done

if [ -z "$MISSING" ]; then
    printf 'All tracked game source files are present.\n'
    exit 0
fi

git -C "$ROOT" restore --source=HEAD --worktree -- $MISSING
printf 'Recovered missing files from Git:\n%s\n' "$MISSING"

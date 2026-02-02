#!/bin/sh
# Quita la línea "Co-authored-by: Cursor" del mensaje de commit.
# Copiar a .git/hooks/prepare-commit-msg (o usar scripts/install-prepare-commit-msg-hook.sh)
COMMIT_MSG_FILE=$1
if [ -f "$COMMIT_MSG_FILE" ]; then
  grep -v '^Co-authored-by: Cursor <cursoragent@cursor.com>' "$COMMIT_MSG_FILE" > "$COMMIT_MSG_FILE.tmp" && mv "$COMMIT_MSG_FILE.tmp" "$COMMIT_MSG_FILE"
fi
exit 0

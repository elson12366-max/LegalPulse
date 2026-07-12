#!/bin/zsh
# Daily judgment fetch for LegalPulse. Invoked by launchd (see the plist).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$HOME/Desktop/LegalPulse/fetcher" || exit 1
echo "===== run $(date) ====="
node fetch-judgments.mjs
echo "===== done $(date) ====="

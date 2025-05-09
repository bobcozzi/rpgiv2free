#!/bin/bash

# Check for a commit message
if [ -z "$1" ]; then
  echo "Usage: $0 \"Your commit message here\""
  exit 1
fi
npm run compile

vsce package
git add .
git commit -m "$1"
git push origin main
vsce publish
npx ovsx publish
#!/bin/sh
# Runs the engine tests with macOS's built-in JavaScriptCore (no Node needed).
cd "$(dirname "$0")/.." || exit 1
exec /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/engine.test.js

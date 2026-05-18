@echo off
setlocal enabledelayedexpansion

cd c:\project_github\agentic-os

echo === npm run typecheck ===
npm run typecheck > temp_typecheck.txt 2>&1
set typecheck_code=!ERRORLEVEL!

echo === npm run lint ===
npm run lint > temp_lint.txt 2>&1
set lint_code=!ERRORLEVEL!

echo === npm run build ===
npm run build > temp_build.txt 2>&1
set build_code=!ERRORLEVEL!

echo === RESULTS ===
echo typecheck: !typecheck_code!
echo lint: !lint_code!
echo build: !build_code!

type temp_typecheck.txt
echo.
type temp_lint.txt
echo.
type temp_build.txt

del temp_typecheck.txt temp_lint.txt temp_build.txt

@echo off
cd /d c:\project_github\agentic-os

echo === Command 1: npm run typecheck ===
call npm run typecheck
set typecheck_code=%errorlevel%
echo Exit code: %typecheck_code%
echo.

echo === Command 2: npm run lint ===
call npm run lint
set lint_code=%errorlevel%
echo Exit code: %lint_code%
echo.

echo === Command 3: npm run build ===
call npm run build
set build_code=%errorlevel%
echo Exit code: %build_code%
echo.

echo === Summary ===
echo typecheck exit code: %typecheck_code%
echo lint exit code: %lint_code%
echo build exit code: %build_code%

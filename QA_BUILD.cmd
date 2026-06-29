@echo off
setlocal
cd /d "%~dp0"
echo EnergyLink Round 14 Local QA
call pnpm qa:local
if errorlevel 1 (
  echo.
  echo QA failed.
  pause
  exit /b 1
)
echo.
echo QA passed. Running full build...
call pnpm build
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo QA and build completed.
pause

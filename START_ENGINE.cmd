@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File tools\windows\start-engine-manager.ps1

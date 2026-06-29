@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File tools\windows\start-web-viewer.ps1

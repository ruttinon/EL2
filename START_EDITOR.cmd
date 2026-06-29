@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File tools\windows\start-editor.ps1

@echo off
title GovAssist AI - MERN Platform Launcher
echo ========================================================
echo   Starting GovAssist AI - Enterprise MERN Platform
echo   Databricks Unity Catalog + AWS Bedrock + MongoDB
echo ========================================================
echo.

echo [1/3] Starting Python RAG AI Bridge on port 5001...
start "Python RAG AI Bridge" cmd /k "python python_bridge.py"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Node.js Express Backend on port 5000...
start "GovAssist MERN Backend" cmd /k "node backend/src/server.js"

timeout /t 3 /nobreak >nul

echo [3/3] Opening Web Application in Microsoft Edge (Enterprise Speech Services enabled)...
start msedge http://localhost:5000 2>nul || start http://localhost:5000

echo.
echo ========================================================
echo   Platform is running!
echo   Web URL:    http://localhost:5000
echo   Admin:      admin / AdminPassword@123
echo   Demo User:  citizen1 / UserPassword@123
echo ========================================================
pause

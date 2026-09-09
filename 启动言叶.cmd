@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 言叶 - 本地日语单词
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js 24 LTS。
  pause
  exit /b 1
)
echo.
echo 正在启动言叶。首次安装时请保持此窗口打开。
echo 启动完成后，在浏览器打开 http://localhost:8765/install
echo.
node scripts/server.mjs
if errorlevel 1 pause

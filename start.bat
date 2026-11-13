@echo off
chcp 65001 >nul
title 標籤管理系統

:: 尋找 java.exe：優先用同目錄下的可攜式 JRE
if exist "%~dp0jre\bin\java.exe" (
    set JAVA="%~dp0jre\bin\java.exe"
) else (
    set JAVA=java
)

cd /d "%~dp0"
echo 正在啟動標籤管理系統...
echo 請勿關閉此視窗
echo.
echo 開啟瀏覽器訪問：http://localhost:8080
echo.

:: 只接受本機連線（店內其他電腦要連時，刪掉 --server.address=127.0.0.1，見 docs\deployment-firewall.md 4.2）
%JAVA% -jar label-manager-0.1.0-SNAPSHOT.jar --server.address=127.0.0.1

pause

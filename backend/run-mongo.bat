@echo off
title MongoDB Local (Port 27018)
echo Starting Local MongoDB on port 27018...
if not exist "%~dp0data\db" mkdir "%~dp0data\db"
"C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath "%~dp0data\db" --port 27018 --bind_ip 127.0.0.1 --noauth
pause

@echo off
setlocal
if "%MOZILLABUILD%"=="" set MOZILLABUILD=C:\mozilla-build
python "%~dp0mach" %*

@echo off
setlocal

REM ===================================================================
REM  Grcki Giros - pokretanje sajta lokalno
REM
REM  Dvoklikni ovaj fajl. Otvara se sajt u pretrazivacu, sa pravim
REM  backendom (Apps Script kod u lokalnom emulatoru): meni, korpa,
REM  porudzbine, admin panel.
REM
REM  Zasto ovo, a ne dvoklik na dist\index.html: otvoren sa diska
REM  (file://) sajt ne nalazi CSS, fontove i skripte, jer ih trazi na
REM  /assets/... kao na pravom serveru.
REM
REM  Adrese:
REM    sajt        http://localhost:5180
REM    admin       http://localhost:5180/admin/   (PIN 123456)
REM    emailovi    http://localhost:5180/__outbox
REM    tabela      http://localhost:5180/__state
REM ===================================================================

cd /d "%~dp0"
set PORT=5180

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js nije instaliran ili nije u PATH-u.
  echo  Preuzmi ga sa https://nodejs.org  ^(LTS verzija^) i pokusaj ponovo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Prvi put - instaliram zavisnosti, potrajace minut...
  echo.
  if exist "package-lock.json" (
    call npm ci
  ) else (
    call npm install
  )
  if errorlevel 1 (
    echo.
    echo  Instalacija nije prosla. Pogledaj sta pise iznad.
    pause
    exit /b 1
  )
)

echo.
echo  Gradim sajt...
call node tools\build.mjs --dev
if errorlevel 1 (
  echo.
  echo  Build nije prosao. Pogledaj sta pise iznad.
  pause
  exit /b 1
)

echo.
echo  ================================================
echo   Sajt radi na:  http://localhost:%PORT%
echo   Admin panel:   http://localhost:%PORT%/admin/   PIN 123456
echo.
echo   Da ga ugasis: zatvori ovaj crni prozor.
echo  ================================================
echo.

if /i not "%~1"=="--no-browser" start "" "http://localhost:%PORT%"
node tools\dev-server.mjs --port %PORT%

endlocal

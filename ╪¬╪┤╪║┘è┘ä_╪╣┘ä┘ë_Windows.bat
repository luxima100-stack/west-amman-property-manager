@echo off
chcp 65001 >nul
echo ==============================================
echo   نظام إدارة عقارات غرب عمان
echo ==============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo لم يتم العثور على Node.js.
  echo ثبّت Node.js 20 LTS أو أحدث ثم أعد تشغيل هذا الملف.
  pause
  exit /b 1
)
if not exist node_modules (
  echo جاري تثبيت مكونات البرنامج...
  call npm install
)
echo.
echo جاري تشغيل البرنامج...
echo افتح: http://localhost:3000
echo لإيقاف البرنامج اضغط Ctrl+C
echo.
npm start
pause

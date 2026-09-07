@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo Atualizando projeto...
echo ========================================
git pull origin claude/assessorias-supabase-login-71d9nb

if errorlevel 1 (
    echo.
    echo ERRO ao atualizar o Git.
    echo Verifique se existem conflitos ou alteracoes locais.
    pause
    exit /b
)

echo.
echo Projeto atualizado.
echo Iniciando servidor local...

start "" python -m http.server 8000

timeout /t 2 >nul

start http://localhost:8000/gestor.html
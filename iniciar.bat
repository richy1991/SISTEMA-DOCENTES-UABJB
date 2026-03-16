@echo off
echo ========================================
echo Sistema de Gestion del Fondo de Tiempo
echo Universidad Autonoma del Beni
echo ========================================
echo.
echo Iniciando servidores...
echo.

cd backend
start cmd /k "venv\Scripts\activate && python manage.py runserver"

cd ..\frontend
start cmd /k "npm run dev"

echo.
echo Servidores iniciados:
echo - Backend: http://127.0.0.1:8000
echo - Frontend: http://localhost:5173
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul
@echo off
setlocal EnableDelayedExpansion
title Kubernetes Monitoring Tool - Setup & Launcher

REM Change to directory where script is located
cd /d "%~dp0"

:MENU
cls
echo ================================================================
echo       Kubernetes Monitoring ^& Observability Tool Setup
echo ================================================================
echo.
echo  Please choose a setup or launch option based on HOW_TO_SETUP.md:
echo.
echo   [1] Option A: Complete Quick Local Setup (Docker Compose + Dev Servers)
echo   [2] Option B: Complete Real K8s Setup (Minikube + Helm + Port-Forward)
echo   [3] Install Project Dependencies Only (Node.js ^& Python venv)
echo   [4] Start Infrastructure Containers (MongoDB, Prometheus, Loki)
echo   [5] Start Backend and Frontend Servers (New Windows)
echo   [6] Install K8s Tools (kubectl, Minikube, Helm)
echo   [7] Run API Health Check ^& Automated Tests
echo   [8] Stop All Services ^& Clean Up (Docker, Dev Ports, Minikube)
echo   [0] Exit
echo.
echo ================================================================
set "CHOICE="
set /p CHOICE="Enter your choice [0-8]: "

if "%CHOICE%"=="1" goto OPTION_A
if "%CHOICE%"=="2" goto OPTION_B
if "%CHOICE%"=="3" goto INSTALL_DEPS
if "%CHOICE%"=="4" goto START_INFRA
if "%CHOICE%"=="5" goto START_APP
if "%CHOICE%"=="6" goto INSTALL_TOOLS
if "%CHOICE%"=="7" goto RUN_TESTS
if "%CHOICE%"=="8" goto STOP_ALL
if "%CHOICE%"=="0" goto EXIT_SCRIPT

echo [!] Invalid option selected.
timeout /t 2 >nul
goto MENU

REM ================================================================
REM PREREQUISITE CHECK FUNCTION
REM ================================================================
:CHECK_PREREQS
echo.
echo [*] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js v18+.
    pause
    goto MENU
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    goto MENU
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.10+.
    pause
    goto MENU
)

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH. Please install Docker Desktop.
    pause
    goto MENU
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker daemon is not running! Please start Docker Desktop and try again.
    pause
    goto MENU
)

echo [OK] Node.js, Python, and Docker are ready.
goto :eof

REM ================================================================
REM STEP: INSTALL DEPENDENCIES
REM ================================================================
:INSTALL_DEPS_SUB
echo.
echo ================================================================
echo [*] Step 1/3: Installing Root and Frontend NPM Dependencies...
echo ================================================================
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install root npm dependencies.
    pause
    goto MENU
)

if exist frontend (
    echo [*] Installing frontend npm dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo ================================================================
echo [*] Step 2/3: Setting up Python Virtual Environment (backend\.venv)...
echo ================================================================
if not exist "backend\.venv" (
    echo [*] Creating virtual environment in backend\.venv...
    cd backend
    python -m venv .venv
    cd ..
)

echo [*] Installing Python requirements...
call backend\.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    goto MENU
)
echo [OK] Dependencies installed successfully.
goto :eof

REM ================================================================
REM OPTION 1: QUICK LOCAL SETUP (OPTION A)
REM ================================================================
:OPTION_A
call :CHECK_PREREQS
call :INSTALL_DEPS_SUB

echo.
echo ================================================================
echo [*] Step 3/3: Starting Infrastructure Containers (Docker Compose)...
echo ================================================================
call npm run infra:up
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker Compose infrastructure.
    pause
    goto MENU
)

echo.
echo [*] Starting Backend and Frontend servers in separate windows...
start "K8s Monitor - Backend (Port 4000)" cmd /k "cd /d \"%~dp0\" && npm run backend:dev"
start "K8s Monitor - Frontend (Port 3000)" cmd /k "cd /d \"%~dp0\" && npm run frontend:dev"

echo.
echo ================================================================
echo  [SUCCESS] Option A Local Setup is Complete!
echo ================================================================
echo  - MongoDB:    http://localhost:27017
echo  - Prometheus: http://localhost:9090
echo  - Loki:       http://localhost:3100
echo  - Backend:    http://localhost:4000
echo  - Frontend:   http://localhost:3000
echo.
echo  Opening http://localhost:3000 in your browser...
timeout /t 3 >nul
start http://localhost:3000
pause
goto MENU

REM ================================================================
REM OPTION 2: KUBERNETES SETUP (OPTION B)
REM ================================================================
:OPTION_B
call :CHECK_PREREQS

where minikube >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] minikube was not found in PATH.
    echo Please install it first using Option [6] or install-k8s-tools.bat.
    pause
    goto MENU
)

where helm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] helm was not found in PATH.
    echo Please install it first using Option [6] or install-k8s-tools.bat.
    pause
    goto MENU
)

where kubectl >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] kubectl was not found in PATH.
    echo Please install it first using Option [6] or install-k8s-tools.bat.
    pause
    goto MENU
)

call :INSTALL_DEPS_SUB

echo.
echo ================================================================
echo [*] Checking and Starting Minikube Cluster...
echo ================================================================
echo [*] Checking if Minikube is already running...
minikube status >nul 2>&1
if %errorlevel% equ 0 (
    echo [!] Existing active Minikube cluster detected.
    echo [*] Stopping and deleting existing Minikube cluster for a fresh setup...
    minikube stop
    minikube delete
) else (
    minikube delete >nul 2>&1
)

echo [*] Starting fresh Minikube cluster...
minikube start
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Minikube.
    pause
    goto MENU
)

echo.
echo ================================================================
echo [*] Adding Helm Repositories ^& Installing Prometheus Operator ^& Promtail...
echo ================================================================
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

echo [*] Installing kube-prometheus-stack...
helm install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace

echo [*] Installing Promtail log shipper...
helm install promtail grafana/promtail --namespace monitoring --set "config.clients[0].url=http://192.168.49.1:3100/loki/api/v1/push"

echo.
echo ================================================================
echo [*] Starting Supporting Infrastructure (MongoDB ^& Loki)...
echo ================================================================
call npm run infra:up
echo [*] Stopping standalone Prometheus container to free port 9090 for K8s...
docker stop k8s-monitor-prometheus >nul 2>&1

echo.
echo ================================================================
echo [*] Deploying Sample Pods for Monitoring...
echo ================================================================
kubectl run k8s-demo-app --image=nginx:alpine --port=80 2>nul || echo [*] k8s-demo-app already exists.
kubectl run crash-test-pod --image=busybox --restart=Always -- /bin/sh -c "sleep 5; exit 1" 2>nul || echo [*] crash-test-pod already exists.

echo.
echo [*] Launching Prometheus Port Forwarding in separate window...
start "K8s Monitor - Port Forward (Port 9090)" cmd /k "kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090"

echo [*] Starting Backend and Frontend servers in separate windows...
start "K8s Monitor - Backend (Port 4000)" cmd /k "cd /d \"%~dp0\" && npm run backend:dev"
start "K8s Monitor - Frontend (Port 3000)" cmd /k "cd /d \"%~dp0\" && npm run frontend:dev"

echo.
echo ================================================================
echo  [SUCCESS] Option B Kubernetes Setup is Complete!
echo ================================================================
echo  - Minikube:     Running
echo  - Port-Forward: http://localhost:9090 -^> K8s Prometheus
echo  - Backend:      http://localhost:4000
echo  - Frontend:     http://localhost:3000
echo.
echo  Opening http://localhost:3000 in your browser...
timeout /t 3 >nul
start http://localhost:3000
pause
goto MENU

REM ================================================================
REM OPTION 3: INSTALL DEPENDENCIES ONLY
REM ================================================================
:INSTALL_DEPS
call :CHECK_PREREQS
call :INSTALL_DEPS_SUB
pause
goto MENU

REM ================================================================
REM OPTION 4: START INFRASTRUCTURE ONLY
REM ================================================================
:START_INFRA
call :CHECK_PREREQS
echo.
echo [*] Starting Docker Compose infrastructure...
call npm run infra:up
pause
goto MENU

REM ================================================================
REM OPTION 5: START BACKEND & FRONTEND SERVERS
REM ================================================================
:START_APP
echo.
echo [*] Launching Backend and Frontend in separate windows...
start "K8s Monitor - Backend (Port 4000)" cmd /k "cd /d \"%~dp0\" && npm run backend:dev"
start "K8s Monitor - Frontend (Port 3000)" cmd /k "cd /d \"%~dp0\" && npm run frontend:dev"
echo [OK] Servers launched.
pause
goto MENU

REM ================================================================
REM OPTION 6: INSTALL K8S TOOLS
REM ================================================================
:INSTALL_TOOLS
if exist "install-k8s-tools.bat" (
    echo [*] Launching install-k8s-tools.bat...
    call "install-k8s-tools.bat"
) else (
    echo [ERROR] install-k8s-tools.bat not found in current directory.
    pause
)
goto MENU

REM ================================================================
REM OPTION 7: RUN TESTS
REM ================================================================
:RUN_TESTS
echo.
echo ================================================================
echo [*] Running Automated API Health Checks ^& Tests...
echo ================================================================
echo.
echo [1] Checking Backend Health (http://localhost:4000/health)...
powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:4000/health' -Method Get; Write-Host '[OK] Health Status: ' ($res | ConvertTo-Json -Compress) } catch { Write-Host '[FAIL] Backend is not responding on port 4000. Ensure backend is running.' -ForegroundColor Red }"
echo.
echo [2] Checking Prometheus (http://localhost:9090/-/healthy)...
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:9090/-/healthy' -Method Get; Write-Host '[OK] Prometheus Status:' $res.StatusCode } catch { Write-Host '[FAIL] Prometheus is not responding on port 9090.' -ForegroundColor Red }"
echo.
echo [3] Checking Loki (http://localhost:3100/ready)...
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:3100/ready' -Method Get; Write-Host '[OK] Loki Status:' $res.Content } catch { Write-Host '[FAIL] Loki is not responding on port 3100.' -ForegroundColor Red }"
echo.
pause
goto MENU

REM ================================================================
REM OPTION 8: STOP ALL SERVICES & TEARDOWN
REM ================================================================
:STOP_ALL
echo.
echo ================================================================
echo [*] Stopping All Containers and Processes...
echo ================================================================

echo [*] Stopping Docker Compose containers...
call npm run infra:down

echo [*] Killing listening processes on ports 3000, 4000, 9090, 3100, 27017...
powershell -Command "$ports = @(3000, 4000, 9090, 3100, 27017); foreach ($p in $ports) { Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"

echo.
set "STOP_MINI="
set /p STOP_MINI="Do you also want to stop and delete Minikube? (y/n): "
if /i "%STOP_MINI%"=="y" (
    where minikube >nul 2>&1
    if %errorlevel% equ 0 (
        echo [*] Stopping and deleting Minikube...
        minikube stop
        minikube delete
    )
)

echo.
echo [OK] All services stopped cleanly.
pause
goto MENU

:EXIT_SCRIPT
echo Exiting setup script. Goodbye!
exit /b 0

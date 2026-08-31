@echo off
setlocal EnableDelayedExpansion

:: ==========================================================
:: Kubernetes, Minikube & Helm Installer for Windows
:: ==========================================================

:: 1. Check for Administrator Privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrator privileges required. Requesting elevation...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title Kubernetes Tools Installer (kubectl, minikube, helm)
cls
echo ==========================================================
echo       Installing Kubernetes CLI (kubectl), Minikube, Helm
echo ==========================================================
echo.

:: 2. Check Package Manager (prefer winget, fallback to choco)
where winget >nul 2>&1
if %errorlevel% equ 0 (
    set "PKG_MGR=winget"
    echo [*] Found Windows Package Manager (winget).
    goto :INSTALL_WINGET
)

where choco >nul 2>&1
if %errorlevel% equ 0 (
    set "PKG_MGR=choco"
    echo [*] Found Chocolatey (choco).
    goto :INSTALL_CHOCO
)

:: If neither is found, offer direct download via PowerShell
echo [!] Neither winget nor Chocolatey found.
echo [*] Downloading binaries directly using PowerShell...
goto :INSTALL_DIRECT

:: ==========================================================
:: Method A: Winget (Recommended & Built-in for Windows 10/11)
:: ==========================================================
:INSTALL_WINGET
echo.
echo [*] Installing kubectl via winget...
winget install -e --id Kubernetes.kubectl --accept-source-agreements --accept-package-agreements

echo.
echo [*] Installing Minikube via winget...
winget install -e --id Kubernetes.minikube --accept-source-agreements --accept-package-agreements

echo.
echo [*] Installing Helm via winget...
winget install -e --id Helm.Helm --accept-source-agreements --accept-package-agreements

goto :VERIFY

:: ==========================================================
:: Method B: Chocolatey
:: ==========================================================
:INSTALL_CHOCO
echo.
echo [*] Installing kubectl, minikube, and kubernetes-helm via Chocolatey...
choco install kubernetes-cli minikube kubernetes-helm -y
goto :VERIFY

:: ==========================================================
:: Method C: Direct Binary Download & PATH Setup
:: ==========================================================
:INSTALL_DIRECT
set "BIN_DIR=C:\k8s-tools"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo.
echo [*] Downloading kubectl...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://dl.k8s.io/release/v1.31.0/bin/windows/amd64/kubectl.exe' -OutFile '%BIN_DIR%\kubectl.exe'"

echo [*] Downloading minikube...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/kubernetes/minikube/releases/latest/download/minikube-windows-amd64.exe' -OutFile '%BIN_DIR%\minikube.exe'"

echo [*] Downloading and unpacking helm...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://get.helm.sh/helm-v3.15.4-windows-amd64.zip' -OutFile '%TEMP%\helm.zip'; Expand-Archive -Path '%TEMP%\helm.zip' -DestinationPath '%TEMP%\helm' -Force; Move-Item -Path '%TEMP%\helm\windows-amd64\helm.exe' -Destination '%BIN_DIR%\helm.exe' -Force; Remove-Item '%TEMP%\helm.zip', '%TEMP%\helm' -Recurse -Force"

echo [*] Adding %BIN_DIR% to System PATH...
powershell -Command "$oldPath = [Environment]::GetEnvironmentVariable('Path', 'Machine'); if ($oldPath -notlike '*%BIN_DIR%*') { [Environment]::SetEnvironmentVariable('Path', \"$oldPath;%BIN_DIR%\", 'Machine') }"
set "PATH=%PATH%;%BIN_DIR%"
goto :VERIFY

:: ==========================================================
:: Verification
:: ==========================================================
:VERIFY
echo.
echo ==========================================================
echo                Verifying Installations
echo ==========================================================
echo.

:: Refresh environment PATH for current shell
call :REFRESH_ENV

echo [1/3] Checking kubectl:
kubectl version --client 2>nul || echo [!] Please open a new terminal to check kubectl.
echo.

echo [2/3] Checking Minikube:
minikube version 2>nul || echo [!] Please open a new terminal to check minikube.
echo.

echo [3/3] Checking Helm:
helm version 2>nul || echo [!] Please open a new terminal to check helm.
echo.

echo ==========================================================
echo  Installation complete!
echo  Note: You may need to restart your terminal/cmd window
echo        for environment PATH updates to take effect.
echo ==========================================================
echo.
pause
exit /b

:REFRESH_ENV
for /f "tokens=2*" %%a in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"
set "PATH=%SYS_PATH%;%USER_PATH%;%PATH%"
goto :eof

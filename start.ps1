# Start servers for Crop Disease Detection Application

Write-Host "Starting Crop Disease Detection Application..." -ForegroundColor Green

# Kill any existing Python or Node processes
Write-Host "`nStopping any existing servers..." -ForegroundColor Yellow
try {
    Get-Process -Name "python", "node" -ErrorAction SilentlyContinue | ForEach-Object { 
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process: $($_.ProcessName) (ID: $($_.Id))" -ForegroundColor Gray
        } catch {
            Write-Host "Could not stop process: $($_.ProcessName) (ID: $($_.Id))" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 2
} catch {
    Write-Host "No existing processes to stop" -ForegroundColor Gray
}

# Verify .env files exist
if (-not (Test-Path "$PSScriptRoot\backend\.env")) {
    Write-Host "`nWARNING: No .env file found in backend directory." -ForegroundColor Yellow
    Write-Host "Create one with proper credentials for full functionality." -ForegroundColor Yellow
}

if (-not (Test-Path "$PSScriptRoot\frontend\.env.local")) {
    Write-Host "`nWARNING: No .env.local file found in frontend directory." -ForegroundColor Yellow
    Write-Host "Creating a basic one for development..." -ForegroundColor Yellow
    Set-Content -Path "$PSScriptRoot\frontend\.env.local" -Value "NEXT_PUBLIC_BACKEND_URL=http://localhost:5000"
}

# Start backend server
Write-Host "`nStarting Backend Server..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$PSScriptRoot\backend'; python app.py"

# Wait for backend to initialize
Write-Host "Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start frontend server
Write-Host "`nStarting Frontend Server..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`nServers started!" -ForegroundColor Green
Write-Host "Access the application at http://localhost:3000" -ForegroundColor Magenta
Write-Host "Backend API is available at http://localhost:5000" -ForegroundColor Magenta
Write-Host "`nPress Ctrl+C in the server windows to stop the servers when done." -ForegroundColor Yellow
Write-Host "`nTroubleshooting tips:" -ForegroundColor Cyan
Write-Host "1. If the multilingual feature isn't working, check your Google API key in backend/.env" -ForegroundColor White
Write-Host "2. For image analysis issues, verify your Clarifai PAT in backend/.env" -ForegroundColor White
Write-Host "3. For database functionality, ensure Supabase credentials are correct" -ForegroundColor White 
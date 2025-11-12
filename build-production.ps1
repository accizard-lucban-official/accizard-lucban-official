# PowerShell script for building with production environment variables
# Usage: .\build-production.ps1

Write-Host "Building for production..." -ForegroundColor Green

# Check if .env.production exists
if (Test-Path ".env.production") {
    Write-Host "Found .env.production file. Loading variables..." -ForegroundColor Yellow
    
    # Load variables from .env.production
    Get-Content .env.production | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "  Set $key" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "Warning: .env.production not found!" -ForegroundColor Red
    Write-Host "Please create .env.production with your Firebase config values." -ForegroundColor Yellow
    Write-Host "You can copy .env.example and fill in the values." -ForegroundColor Yellow
    exit 1
}

# Build the project
Write-Host "`nRunning npm run build..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild successful! You can now deploy with: firebase deploy --only hosting" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed! Check the errors above." -ForegroundColor Red
    exit 1
}


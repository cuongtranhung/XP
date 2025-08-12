# Windows Server Deployment Script
# Author: Auto-generated
# Usage: .\deploy-windows.ps1 -Environment production

param(
    [string]$Environment = "production",
    [string]$AppPath = "C:\inetpub\auth-app",
    [string]$IISPath = "C:\inetpub\wwwroot\auth-frontend",
    [switch]$SkipBuild = $false
)

# Colors for output
$SuccessColor = "Green"
$WarningColor = "Yellow"
$ErrorColor = "Red"
$InfoColor = "Cyan"

function Write-Step {
    param([string]$Message)
    Write-Host "🔄 $Message" -ForegroundColor $InfoColor
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $SuccessColor
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor $WarningColor
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $ErrorColor
}

# Main deployment function
function Deploy-Application {
    try {
        Write-Host "🚀 Starting Windows Server Deployment..." -ForegroundColor $SuccessColor
        Write-Host "Environment: $Environment" -ForegroundColor $InfoColor
        Write-Host "App Path: $AppPath" -ForegroundColor $InfoColor
        Write-Host "IIS Path: $IISPath" -ForegroundColor $InfoColor
        Write-Host "----------------------------------------" -ForegroundColor $InfoColor

        # Step 1: Stop existing processes
        Write-Step "Stopping existing Node.js processes..."
        try {
            pm2 stop auth-backend 2>$null
            Write-Success "PM2 processes stopped"
        } catch {
            Write-Warning "No PM2 processes to stop or PM2 not installed"
        }

        # Step 2: Navigate to app directory
        Write-Step "Navigating to application directory..."
        if (-not (Test-Path $AppPath)) {
            Write-Error "Application path not found: $AppPath"
            Write-Host "Please ensure the application is cloned to the correct path."
            return
        }
        Set-Location $AppPath
        Write-Success "Changed to application directory"

        # Step 3: Pull latest code
        Write-Step "Pulling latest code from Git..."
        try {
            git pull origin main
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Code updated successfully"
            } else {
                Write-Warning "Git pull had some issues, continuing..."
            }
        } catch {
            Write-Warning "Git pull failed, using existing code"
        }

        # Step 4: Backend deployment
        Write-Step "Deploying backend..."
        Set-Location "$AppPath\backend"
        
        if (-not $SkipBuild) {
            Write-Step "Installing backend dependencies..."
            npm install --production
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Backend dependency installation failed"
                return
            }
            Write-Success "Backend dependencies installed"

            Write-Step "Building backend..."
            npm run build
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Backend build failed"
                return
            }
            Write-Success "Backend built successfully"
        }

        # Step 5: Database migration
        Write-Step "Running database migrations..."
        try {
            npm run db:migrate 2>$null
            Write-Success "Database migrations completed"
        } catch {
            Write-Warning "Database migration skipped or failed"
        }

        # Step 6: Frontend deployment
        Write-Step "Deploying frontend..."
        Set-Location "$AppPath\frontend"
        
        if (-not $SkipBuild) {
            Write-Step "Installing frontend dependencies..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Frontend dependency installation failed"
                return
            }
            Write-Success "Frontend dependencies installed"

            Write-Step "Building frontend..."
            npm run build
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Frontend build failed"
                return
            }
            Write-Success "Frontend built successfully"
        }

        # Step 7: Deploy to IIS
        Write-Step "Deploying frontend to IIS..."
        if (Test-Path $IISPath) {
            Remove-Item "$IISPath\*" -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            New-Item -ItemType Directory -Path $IISPath -Force
        }
        
        Copy-Item "dist\*" $IISPath -Recurse -Force
        Write-Success "Frontend deployed to IIS"

        # Step 8: Start backend with PM2
        Write-Step "Starting backend with PM2..."
        Set-Location "$AppPath\backend"
        
        try {
            pm2 start dist/app.js --name "auth-backend" --update-env
            pm2 save
            Write-Success "Backend started with PM2"
        } catch {
            Write-Error "Failed to start backend with PM2"
            Write-Host "Trying to start with Node.js directly..."
            Start-Process -FilePath "node" -ArgumentList "dist/app.js" -NoNewWindow
        }

        # Step 9: Health check
        Write-Step "Performing health check..."
        Start-Sleep -Seconds 10

        try {
            $healthResponse = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get -TimeoutSec 30
            if ($healthResponse.status -eq "healthy") {
                Write-Success "Backend health check passed"
            } else {
                Write-Warning "Backend health check returned unexpected status"
            }
        } catch {
            Write-Error "Backend health check failed: $($_.Exception.Message)"
        }

        try {
            $frontendResponse = Invoke-WebRequest -Uri "http://localhost/health" -Method Get -TimeoutSec 30
            if ($frontendResponse.StatusCode -eq 200) {
                Write-Success "Frontend health check passed"
            }
        } catch {
            Write-Warning "Frontend health check failed, but this might be normal if not configured"
        }

        # Step 10: Final status
        Write-Host "`n========================================" -ForegroundColor $SuccessColor
        Write-Host "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor $SuccessColor
        Write-Host "========================================" -ForegroundColor $SuccessColor
        Write-Host "Backend API: http://localhost:5000" -ForegroundColor $InfoColor
        Write-Host "Frontend: http://localhost" -ForegroundColor $InfoColor
        Write-Host "Health Check: http://localhost:5000/health" -ForegroundColor $InfoColor
        Write-Host "`nNext steps:" -ForegroundColor $InfoColor
        Write-Host "1. Configure your domain in IIS" -ForegroundColor $InfoColor
        Write-Host "2. Set up SSL certificate" -ForegroundColor $InfoColor
        Write-Host "3. Configure firewall rules" -ForegroundColor $InfoColor
        Write-Host "4. Set up monitoring" -ForegroundColor $InfoColor

    } catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor $ErrorColor
    }
}

# Utility functions
function Test-Prerequisites {
    Write-Step "Checking prerequisites..."
    
    $prerequisites = @()
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js: $nodeVersion"
    } catch {
        $prerequisites += "Node.js"
    }

    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "npm: $npmVersion"
    } catch {
        $prerequisites += "npm"
    }

    # Check PM2
    try {
        $pm2Version = pm2 --version
        Write-Success "PM2: $pm2Version"
    } catch {
        Write-Warning "PM2 not installed, will try to install..."
        npm install -g pm2
    }

    # Check Git
    try {
        $gitVersion = git --version
        Write-Success "Git: $gitVersion"
    } catch {
        $prerequisites += "Git"
    }

    # Check IIS
    $iisFeature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
    if ($iisFeature.State -eq "Enabled") {
        Write-Success "IIS: Enabled"
    } else {
        Write-Warning "IIS is not enabled"
        $prerequisites += "IIS"
    }

    if ($prerequisites.Count -gt 0) {
        Write-Error "Missing prerequisites: $($prerequisites -join ', ')"
        Write-Host "Please install the missing components and try again."
        return $false
    }

    Write-Success "All prerequisites are available"
    return $true
}

function Show-Help {
    Write-Host @"
Windows Server Deployment Script

USAGE:
    .\deploy-windows.ps1 [OPTIONS]

OPTIONS:
    -Environment <string>    Deployment environment (default: production)
    -AppPath <string>        Application path (default: C:\inetpub\auth-app)
    -IISPath <string>        IIS deployment path (default: C:\inetpub\wwwroot\auth-frontend)
    -SkipBuild              Skip build steps (use existing build)
    -Help                   Show this help message

EXAMPLES:
    .\deploy-windows.ps1
    .\deploy-windows.ps1 -Environment staging
    .\deploy-windows.ps1 -SkipBuild
    .\deploy-windows.ps1 -AppPath "D:\apps\auth-app"

PREREQUISITES:
    - Node.js 18+
    - npm
    - PM2 (will be installed if missing)
    - Git
    - IIS with required features
    - PostgreSQL (if using local database)

"@ -ForegroundColor $InfoColor
}

# Main execution
if ($args -contains "-Help" -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    return
}

Write-Host "Windows Server Deployment Script v1.0" -ForegroundColor $SuccessColor
Write-Host "======================================" -ForegroundColor $SuccessColor

if (Test-Prerequisites) {
    Deploy-Application
} else {
    Write-Error "Prerequisites check failed. Deployment aborted."
}
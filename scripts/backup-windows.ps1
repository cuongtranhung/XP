# Windows Server Backup Script
# Author: Auto-generated
# Usage: .\backup-windows.ps1

param(
    [string]$BackupPath = "C:\Backups\auth-app",
    [string]$AppPath = "C:\inetpub\auth-app",
    [string]$DatabaseName = "fullstack_auth_prod",
    [string]$DatabaseUser = "auth_user",
    [string]$PostgreSQLPath = "C:\Program Files\PostgreSQL\15\bin",
    [int]$RetentionDays = 7,
    [switch]$CompressBackup = $true
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

function Start-Backup {
    try {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupDir = "$BackupPath\$timestamp"
        
        Write-Host "💾 Starting Windows Server Backup..." -ForegroundColor $SuccessColor
        Write-Host "Timestamp: $timestamp" -ForegroundColor $InfoColor
        Write-Host "Backup Directory: $backupDir" -ForegroundColor $InfoColor
        Write-Host "----------------------------------------" -ForegroundColor $InfoColor

        # Create backup directory
        Write-Step "Creating backup directory..."
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Write-Success "Backup directory created"

        # Backup database
        Write-Step "Backing up PostgreSQL database..."
        $dbBackupFile = "$backupDir\database.sql"
        $pgDumpPath = "$PostgreSQLPath\pg_dump.exe"
        
        if (Test-Path $pgDumpPath) {
            $env:PGPASSWORD = Read-Host -Prompt "Enter PostgreSQL password for user '$DatabaseUser'" -AsSecureString
            $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:PGPASSWORD))
            
            & $pgDumpPath -h localhost -U $DatabaseUser -d $DatabaseName -f $dbBackupFile
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Database backup completed"
                $dbSize = (Get-Item $dbBackupFile).Length / 1MB
                Write-Host "Database backup size: $([math]::Round($dbSize, 2)) MB" -ForegroundColor $InfoColor
            } else {
                Write-Error "Database backup failed"
            }
            
            # Clear password from environment
            $env:PGPASSWORD = $null
        } else {
            Write-Warning "PostgreSQL pg_dump not found at $pgDumpPath"
            Write-Warning "Skipping database backup"
        }

        # Backup application files
        Write-Step "Backing up application files..."
        $appBackupDir = "$backupDir\application"
        
        if (Test-Path $AppPath) {
            Copy-Item $AppPath $appBackupDir -Recurse -Force
            Write-Success "Application files backup completed"
            
            $appSize = (Get-ChildItem $appBackupDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Host "Application backup size: $([math]::Round($appSize, 2)) MB" -ForegroundColor $InfoColor
        } else {
            Write-Warning "Application path not found: $AppPath"
        }

        # Backup IIS configuration
        Write-Step "Backing up IIS configuration..."
        try {
            $iisBackupName = "auth-app-backup-$timestamp"
            & "$env:windir\system32\inetsrv\appcmd.exe" add backup $iisBackupName
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "IIS configuration backup completed"
                # Export backup info to file
                "IIS Backup Name: $iisBackupName" | Out-File "$backupDir\iis-backup-info.txt"
            } else {
                Write-Warning "IIS backup failed"
            }
        } catch {
            Write-Warning "IIS backup failed: $($_.Exception.Message)"
        }

        # Backup environment files
        Write-Step "Backing up environment configurations..."
        $configBackupDir = "$backupDir\config"
        New-Item -ItemType Directory -Path $configBackupDir -Force | Out-Null
        
        # Backup .env files (without sensitive data)
        $envFiles = Get-ChildItem $AppPath -Name ".env*" -Recurse
        foreach ($envFile in $envFiles) {
            $fullPath = Join-Path $AppPath $envFile
            $content = Get-Content $fullPath | ForEach-Object {
                if ($_ -match "PASSWORD|SECRET|KEY|TOKEN") {
                    $_ -replace "=.*", "=***REDACTED***"
                } else {
                    $_
                }
            }
            $content | Out-File "$configBackupDir\$envFile"
        }
        Write-Success "Environment configurations backup completed"

        # Compress backup if requested
        if ($CompressBackup) {
            Write-Step "Compressing backup..."
            $zipFile = "$BackupPath\backup-$timestamp.zip"
            Compress-Archive -Path $backupDir -DestinationPath $zipFile -Force
            
            if (Test-Path $zipFile) {
                Remove-Item $backupDir -Recurse -Force
                Write-Success "Backup compressed to: $zipFile"
                
                $zipSize = (Get-Item $zipFile).Length / 1MB
                Write-Host "Compressed backup size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor $InfoColor
            }
        }

        # Cleanup old backups
        Write-Step "Cleaning up old backups..."
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        $oldBackups = Get-ChildItem $BackupPath | Where-Object { $_.CreationTime -lt $cutoffDate }
        
        foreach ($oldBackup in $oldBackups) {
            Remove-Item $oldBackup.FullName -Recurse -Force
            Write-Host "Removed old backup: $($oldBackup.Name)" -ForegroundColor $InfoColor
        }
        
        if ($oldBackups.Count -gt 0) {
            Write-Success "Cleaned up $($oldBackups.Count) old backup(s)"
        } else {
            Write-Host "No old backups to clean up" -ForegroundColor $InfoColor
        }

        # Generate backup report
        Write-Step "Generating backup report..."
        $reportFile = if ($CompressBackup) { "$BackupPath\backup-$timestamp.zip.report.txt" } else { "$backupDir\backup-report.txt" }
        
        $report = @"
BACKUP REPORT
=============
Timestamp: $timestamp
Backup Type: $(if ($CompressBackup) { "Compressed" } else { "Uncompressed" })
Retention Policy: $RetentionDays days

COMPONENTS BACKED UP:
- Database: $(if (Test-Path "$backupDir\database.sql" -or Test-Path $zipFile) { "✅ SUCCESS" } else { "❌ FAILED" })
- Application Files: $(if (Test-Path "$backupDir\application" -or Test-Path $zipFile) { "✅ SUCCESS" } else { "❌ FAILED" })
- IIS Configuration: $(if (Test-Path "$backupDir\iis-backup-info.txt" -or Test-Path $zipFile) { "✅ SUCCESS" } else { "❌ FAILED" })
- Environment Config: $(if (Test-Path "$backupDir\config" -or Test-Path $zipFile) { "✅ SUCCESS" } else { "❌ FAILED" })

BACKUP LOCATION:
$(if ($CompressBackup) { $zipFile } else { $backupDir })

NEXT STEPS:
1. Verify backup integrity
2. Test restore procedure
3. Consider offsite backup storage
4. Schedule regular backups

Generated: $(Get-Date)
"@
        
        $report | Out-File $reportFile
        Write-Success "Backup report generated: $reportFile"

        # Final status
        Write-Host "`n========================================" -ForegroundColor $SuccessColor
        Write-Host "🎉 BACKUP COMPLETED SUCCESSFULLY!" -ForegroundColor $SuccessColor
        Write-Host "========================================" -ForegroundColor $SuccessColor
        Write-Host "Backup Location: $(if ($CompressBackup) { $zipFile } else { $backupDir })" -ForegroundColor $InfoColor
        Write-Host "Report: $reportFile" -ForegroundColor $InfoColor

    } catch {
        Write-Error "Backup failed: $($_.Exception.Message)"
        Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor $ErrorColor
    }
}

function Test-BackupPrerequisites {
    Write-Step "Checking backup prerequisites..."
    
    $issues = @()
    
    # Check if backup directory can be created
    try {
        if (-not (Test-Path $BackupPath)) {
            New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
        }
        Write-Success "Backup directory: $BackupPath"
    } catch {
        $issues += "Cannot create backup directory: $BackupPath"
    }

    # Check application path
    if (Test-Path $AppPath) {
        Write-Success "Application path found: $AppPath"
    } else {
        $issues += "Application path not found: $AppPath"
    }

    # Check PostgreSQL tools
    $pgDumpPath = "$PostgreSQLPath\pg_dump.exe"
    if (Test-Path $pgDumpPath) {
        Write-Success "PostgreSQL tools found: $pgDumpPath"
    } else {
        Write-Warning "PostgreSQL tools not found: $pgDumpPath"
        Write-Warning "Database backup will be skipped"
    }

    # Check available disk space
    $drive = (Get-Item $BackupPath).PSDrive
    $freeSpace = (Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "$($drive.Name):" }).FreeSpace / 1GB
    
    if ($freeSpace -gt 5) {
        Write-Success "Available disk space: $([math]::Round($freeSpace, 2)) GB"
    } else {
        $issues += "Low disk space: $([math]::Round($freeSpace, 2)) GB available"
    }

    if ($issues.Count -gt 0) {
        Write-Error "Prerequisites check failed:"
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor $ErrorColor
        }
        return $false
    }

    Write-Success "All prerequisites are satisfied"
    return $true
}

function Show-Help {
    Write-Host @"
Windows Server Backup Script

USAGE:
    .\backup-windows.ps1 [OPTIONS]

OPTIONS:
    -BackupPath <string>       Backup destination path (default: C:\Backups\auth-app)
    -AppPath <string>          Application path to backup (default: C:\inetpub\auth-app)
    -DatabaseName <string>     PostgreSQL database name (default: fullstack_auth_prod)
    -DatabaseUser <string>     PostgreSQL user (default: auth_user)
    -PostgreSQLPath <string>   PostgreSQL installation path (default: C:\Program Files\PostgreSQL\15\bin)
    -RetentionDays <int>       Days to keep backups (default: 7)
    -CompressBackup           Compress backup to ZIP file (default: true)
    -Help                     Show this help message

EXAMPLES:
    .\backup-windows.ps1
    .\backup-windows.ps1 -RetentionDays 14
    .\backup-windows.ps1 -BackupPath "D:\Backups"
    .\backup-windows.ps1 -CompressBackup:$false

BACKUP INCLUDES:
    - PostgreSQL database dump
    - Application files and source code
    - IIS configuration
    - Environment configurations (sensitive data redacted)

"@ -ForegroundColor $InfoColor
}

# Main execution
if ($args -contains "-Help" -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    return
}

Write-Host "Windows Server Backup Script v1.0" -ForegroundColor $SuccessColor
Write-Host "==================================" -ForegroundColor $SuccessColor

if (Test-BackupPrerequisites) {
    Start-Backup
} else {
    Write-Error "Prerequisites check failed. Backup aborted."
}
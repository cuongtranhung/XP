# 🪟 Hướng Dẫn Cài Đặt Trên Windows Server

## 📋 Yêu Cầu Hệ Thống

### Windows Server Requirements
- **OS**: Windows Server 2019/2022 hoặc Windows 10/11 Pro
- **RAM**: Tối thiểu 4GB (khuyến nghị 8GB+)
- **CPU**: 2 cores trở lên
- **Disk**: 50GB+ free space
- **Network**: Internet connection, Port 80/443 mở

---

## 🛠️ OPTION 1: Cài Đặt Trực Tiếp (Native)

### Bước 1: Cài Đặt Prerequisites

#### 1.1 Cài đặt Node.js
```powershell
# Download và cài đặt Node.js 18 LTS
# Từ: https://nodejs.org/en/download/
# Hoặc dùng Chocolatey:
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

choco install nodejs -y
```

#### 1.2 Cài đặt PostgreSQL
```powershell
# Download PostgreSQL 15 từ:
# https://www.postgresql.org/download/windows/

# Hoặc dùng Chocolatey:
choco install postgresql15 -y
```

#### 1.3 Cài đặt Git
```powershell
choco install git -y
```

#### 1.4 Cài đặt PM2 (Process Manager)
```powershell
npm install -g pm2
npm install -g pm2-windows-service
```

### Bước 2: Chuẩn Bị Database

```sql
-- Mở PostgreSQL Command Line (psql)
-- Tạo database và user
CREATE DATABASE fullstack_auth_prod;
CREATE USER auth_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE fullstack_auth_prod TO auth_user;
GRANT ALL ON SCHEMA public TO auth_user;
```

### Bước 3: Deploy Backend

```powershell
# Tạo thư mục ứng dụng
New-Item -ItemType Directory -Path "C:\inetpub\auth-app" -Force
cd "C:\inetpub\auth-app"

# Clone source code
git clone https://github.com/your-username/your-repo.git .

# Cài đặt backend dependencies
cd backend
npm install --production

# Tạo file .env cho Windows
New-Item -ItemType File -Path ".env" -Force
```

**Nội dung file .env cho backend:**
```env
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://auth_user:your_secure_password@localhost:5432/fullstack_auth_prod

# JWT Configuration  
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=noreply@yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

```powershell
# Build backend
npm run build

# Chạy database migration
npm run db:migrate

# Start với PM2
pm2 start dist/app.js --name "auth-backend"
pm2 save
pm2-service-install
```

### Bước 4: Deploy Frontend

```powershell
cd ../frontend

# Tạo file .env cho frontend
New-Item -ItemType File -Path ".env.production" -Force
```

**Nội dung .env.production:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=SecureAuth
VITE_APP_VERSION=2.0.0
VITE_ENVIRONMENT=production
```

```powershell
# Cài đặt dependencies và build
npm install
npm run build

# Copy build files đến IIS directory
Copy-Item -Path "dist\*" -Destination "C:\inetpub\wwwroot\auth-frontend" -Recurse -Force
```

### Bước 5: Cấu Hình IIS

#### 5.1 Enable IIS Features
```powershell
# Enable IIS và các features cần thiết
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpRedirect, IIS-WebServerManagementTools, IIS-IISRewrite

# Cài đặt URL Rewrite Module
# Download từ: https://www.iis.net/downloads/microsoft/url-rewrite
```

#### 5.2 Tạo Sites trong IIS Manager

**Frontend Site:**
- Site name: `auth-frontend`
- Physical path: `C:\inetpub\wwwroot\auth-frontend`
- Binding: `*:80:yourdomain.com`

**Backend Reverse Proxy:**
- Site name: `auth-backend-proxy`
- Physical path: `C:\inetpub\wwwroot\empty`
- Binding: `*:80:api.yourdomain.com`

#### 5.3 Cấu hình web.config cho Frontend

```xml
<!-- C:\inetpub\wwwroot\auth-frontend\web.config -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- Handle client-side routing -->
                <rule name="React Routes" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                        <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/" />
                </rule>
            </rules>
        </rewrite>
        
        <!-- Security Headers -->
        <httpProtocol>
            <customHeaders>
                <add name="X-Frame-Options" value="SAMEORIGIN" />
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-XSS-Protection" value="1; mode=block" />
                <add name="Referrer-Policy" value="no-referrer-when-downgrade" />
            </customHeaders>
        </httpProtocol>
        
        <!-- Compression -->
        <urlCompression doStaticCompression="true" doDynamicCompression="true" />
        
        <!-- Static file caching -->
        <staticContent>
            <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="31536000" />
        </staticContent>
    </system.webServer>
</configuration>
```

#### 5.4 Cấu hình Reverse Proxy cho Backend

```xml
<!-- C:\inetpub\wwwroot\empty\web.config -->
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="Proxy to Node.js" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://localhost:5000/{R:1}" />
                </rule>
            </rules>
        </rewrite>
    </system.webServer>
</configuration>
```

---

## 🐳 OPTION 2: Docker Desktop (Khuyến Nghị)

### Bước 1: Cài Đặt Docker Desktop

```powershell
# Download Docker Desktop for Windows
# Từ: https://www.docker.com/products/docker-desktop/

# Hoặc dùng Chocolatey:
choco install docker-desktop -y

# Restart máy sau khi cài đặt
Restart-Computer
```

### Bước 2: Chuẩn Bị Files

```powershell
# Clone repository
git clone https://github.com/your-username/your-repo.git C:\auth-app
cd C:\auth-app

# Copy environment file
Copy-Item ".env.production" ".env"

# Chỉnh sửa .env file với thông tin Windows
notepad .env
```

### Bước 3: Docker Compose Deployment

```powershell
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Kiểm tra status
docker-compose -f docker-compose.prod.yml ps

# Xem logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 🔧 PowerShell Scripts Tự Động

### Deploy Script

```powershell
# deploy.ps1
param(
    [string]$Environment = "production"
)

Write-Host "🚀 Starting deployment to Windows Server..." -ForegroundColor Green

# Stop existing processes
Write-Host "⏹️ Stopping existing processes..." -ForegroundColor Yellow
pm2 stop auth-backend 2>$null

# Pull latest code
Write-Host "📥 Pulling latest code..." -ForegroundColor Yellow
git pull origin main

# Install backend dependencies
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
cd backend
npm install --production

# Build backend
Write-Host "🔨 Building backend..." -ForegroundColor Yellow
npm run build

# Build frontend
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
cd ../frontend
npm install
npm run build

# Deploy frontend to IIS
Write-Host "📋 Deploying frontend to IIS..." -ForegroundColor Yellow
Remove-Item "C:\inetpub\wwwroot\auth-frontend\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "dist\*" "C:\inetpub\wwwroot\auth-frontend\" -Recurse -Force

# Start backend with PM2
Write-Host "▶️ Starting backend..." -ForegroundColor Yellow
cd ../backend
pm2 start dist/app.js --name "auth-backend"
pm2 save

# Health check
Write-Host "🏥 Running health check..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get
    if ($response.status -eq "healthy") {
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host "❌ Health check failed!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "🎉 Deployment completed!" -ForegroundColor Green
```

### Backup Script

```powershell
# backup.ps1
$backupPath = "C:\Backups\auth-app"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "💾 Creating backup..." -ForegroundColor Green

# Create backup directory
New-Item -ItemType Directory -Path "$backupPath\$timestamp" -Force

# Backup database
Write-Host "📊 Backing up database..." -ForegroundColor Yellow
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -h localhost -U auth_user -d fullstack_auth_prod -f "$backupPath\$timestamp\database.sql"

# Backup application files
Write-Host "📁 Backing up application files..." -ForegroundColor Yellow
Copy-Item "C:\inetpub\auth-app" "$backupPath\$timestamp\app" -Recurse -Force

# Cleanup old backups (keep last 7 days)
Get-ChildItem $backupPath | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Recurse -Force

Write-Host "✅ Backup completed: $backupPath\$timestamp" -ForegroundColor Green
```

---

## 🔒 Cấu Hình SSL Certificate

### Option 1: Let's Encrypt với win-acme

```powershell
# Download win-acme
Invoke-WebRequest -Uri "https://github.com/win-acme/win-acme/releases/latest/download/win-acme.v2.2.0.1312.x64.pluggable.zip" -OutFile "win-acme.zip"
Expand-Archive "win-acme.zip" -DestinationPath "C:\win-acme"

# Chạy win-acme
cd C:\win-acme
.\wacs.exe

# Chọn options:
# 1. Create certificate with advanced options
# 2. Manual input
# 3. Enter your domain: yourdomain.com,api.yourdomain.com
# 4. Choose IIS plugin
```

### Option 2: Commercial SSL Certificate

1. Mua SSL certificate từ nhà cung cấp
2. Import certificate vào Certificate Store
3. Bind certificate với IIS sites

---

## 📊 Monitoring và Maintenance

### Windows Services

```powershell
# Tạo Windows Service cho PM2
pm2-service-install

# Kiểm tra service status
Get-Service PM2*

# Start/Stop services
Start-Service PM2
Stop-Service PM2
```

### Log Management

```powershell
# PM2 logs
pm2 logs auth-backend

# IIS logs
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" | Select-Object -Last 100

# Application Event logs
Get-WinEvent -LogName Application | Where-Object {$_.ProviderName -eq "Node.js"} | Select-Object -First 10
```

### Performance Monitoring

```powershell
# CPU và Memory usage
Get-Process node
Get-Process w3wp

# Disk space
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}}, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Port đã được sử dụng:**
```powershell
# Kiểm tra port 5000
netstat -ano | findstr :5000
# Kill process nếu cần
Stop-Process -Id <ProcessID> -Force
```

**2. PM2 không start:**
```powershell
# Reinstall PM2 service
pm2-service-uninstall
pm2-service-install
```

**3. Database connection failed:**
```powershell
# Test database connection
Test-NetConnection -ComputerName localhost -Port 5432
# Restart PostgreSQL service
Restart-Service postgresql-x64-15
```

**4. IIS site không hoạt động:**
```powershell
# Restart IIS
iisreset

# Check Application Pool
Get-IISAppPool
Start-WebAppPool -Name "DefaultAppPool"
```

---

## 📝 Quick Commands Cheat Sheet

```powershell
# Deployment
.\deploy.ps1

# Check status
pm2 status
docker-compose ps

# View logs
pm2 logs auth-backend
docker-compose logs -f

# Restart services
pm2 restart auth-backend
iisreset

# Backup
.\backup.ps1

# Health checks
Invoke-RestMethod http://localhost:5000/health
Invoke-RestMethod http://localhost/health
```

---

## 🎯 Production Optimization

### IIS Optimizations
- Enable output caching
- Configure compression
- Set up CDN for static files
- Implement request filtering

### Node.js Optimizations
- Use PM2 cluster mode
- Configure memory limits
- Set up log rotation
- Enable gzip compression

### Database Optimizations
- Configure PostgreSQL for Windows
- Set up automated backups
- Configure connection pooling
- Monitor performance

**🎉 Windows Server deployment hoàn tất! Hệ thống ready cho production.**
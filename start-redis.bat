@echo off
echo 🚀 Starting Redis for XP Project...
echo ==================================

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Stop any existing Redis containers
echo 🔄 Stopping any existing Redis containers...
docker-compose -f docker-compose.redis-simple.yml down >nul 2>&1

REM Start Redis
echo 🚀 Starting Redis server...
docker-compose -f docker-compose.redis-simple.yml up -d

REM Wait for Redis to be ready
echo ⏳ Waiting for Redis to be ready...
timeout /t 3 /nobreak >nul

REM Test connection
echo 🔍 Testing Redis connection...
docker exec xp-redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Redis is running successfully!
    echo.
    echo 📊 Redis Info:
    echo   - Host: localhost
    echo   - Port: 6379
    echo   - Commander UI: http://localhost:8081
    echo   - Username: admin
    echo   - Password: admin123
    echo.
    echo 🔧 Useful commands:
    echo   - Check status: docker exec xp-redis redis-cli ping
    echo   - View logs: docker logs xp-redis
    echo   - Stop Redis: docker-compose -f docker-compose.redis-simple.yml down
    echo   - Redis CLI: docker exec -it xp-redis redis-cli
) else (
    echo ❌ Failed to connect to Redis. Check logs:
    docker logs xp-redis
    pause
    exit /b 1
)

echo ==================================
echo ✅ Redis setup complete!
pause
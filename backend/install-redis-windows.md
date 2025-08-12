# Redis Installation Guide for Windows/WSL

## 🚀 Quick Installation Options

### Option 1: Redis on Windows (Easiest)

#### Using Memurai (Redis for Windows)
1. Download Memurai from: https://www.memurai.com/get-memurai
2. Run the installer
3. Memurai runs as Windows service on port 6379
4. Test: Open PowerShell and run `redis-cli ping`

#### Using Redis Windows Port
1. Download from: https://github.com/microsoftarchive/redis/releases
2. Extract to `C:\Redis`
3. Run `redis-server.exe`
4. Test in another terminal: `redis-cli.exe ping`

### Option 2: WSL2 with Redis

#### Install Redis in WSL
```bash
# Update packages
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
```

#### Configure for auto-start
```bash
# Edit WSL config
sudo nano /etc/redis/redis.conf

# Change these settings:
# bind 127.0.0.1 ::1
# protected-mode yes
# port 6379

# Restart Redis
sudo service redis-server restart
```

### Option 3: Docker Desktop

1. Install Docker Desktop for Windows
2. Run our Redis setup:
```bash
cd /mnt/c/Users/Admin/source/repos/XP
docker-compose -f docker-compose.redis.yml up -d
```

## 🔧 After Installation

### 1. Update Backend Configuration
Edit `/backend/.env`:
```env
REDIS_ENABLED=true
ENABLE_CACHE=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. Test Connection
```bash
cd /mnt/c/Users/Admin/source/repos/XP/backend
node test-redis-connection.js
```

### 3. Start Backend
```bash
npm run dev
```

## 📊 Verify Cache is Working

### Check Cache Status
```bash
curl http://localhost:5000/api/cache/stats
```

### Monitor Redis
```bash
redis-cli monitor
```

## 🚨 Troubleshooting

### WSL Cannot Connect to Redis
```bash
# Check if Redis is running
ps aux | grep redis

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Restart Redis
sudo service redis-server restart
```

### Windows Firewall Blocking
1. Open Windows Defender Firewall
2. Add inbound rule for port 6379
3. Allow connections from WSL

### Port Already in Use
```bash
# Find process using port 6379
netstat -ano | findstr :6379

# Kill the process (use PID from above)
taskkill /PID [process_id] /F
```

## 📈 Expected Results

After successful installation:
- Redis responds to `ping` with `PONG`
- Backend starts with: "Redis cache connected successfully"
- Cache stats endpoint shows `isEnabled: true`
- API responses are cached (check Redis with `redis-cli monitor`)

## 🎯 Quick Test Commands

```bash
# Test Redis is running
redis-cli ping

# Set a test key
redis-cli set test "Hello Redis"

# Get the test key
redis-cli get test

# Check Redis info
redis-cli info server

# Monitor activity
redis-cli monitor
```

---

Choose the option that works best for your environment!
# 🚀 Development Environment Setup

## Overview
This project uses a stable localhost-based configuration that works seamlessly between Windows 11 (PostgreSQL) and WSL2 (application code).

## Architecture
```
Windows 11 (Host)
├── PostgreSQL (port 5432)
└── Browser (access via localhost)

WSL2 (Development)
├── Backend (Node.js - port 5000)
├── Frontend (React - port 3000)
└── Claude Code (AI development)
```

## Quick Start

### 1. Prerequisites
- Windows 11 with WSL2 installed
- PostgreSQL installed on Windows
- Node.js 18+ in WSL2
- npm 9+ in WSL2

### 2. Initial Setup
```bash
# Clone repository in WSL2
cd /mnt/c/Users/[YourUsername]/source/repos/
git clone [repository-url] XP
cd XP

# Install dependencies
npm run setup
```

### 3. Database Setup
Ensure PostgreSQL is running on Windows with:
- Host: localhost (from Windows) or Windows host IP (from WSL2)
- Port: 5432
- Database: postgres
- Username: postgres
- Password: @abcd1234

### 4. Start Development Environment

#### Option A: Automated (Recommended)
```bash
# Start both frontend and backend
npm run dev

# Stop all services
npm run stop
```

#### Option B: Manual
```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Access URLs

### From Windows Browser (Recommended)
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Login Page: http://localhost:3000/login

### Test Credentials
- Email: cuongtranhung@gmail.com
- Password: @Abcd6789

## Network Configuration

### How It Works
1. **Backend** connects to Windows PostgreSQL using dynamic IP detection
2. **Frontend** runs on localhost:3000 and proxies API calls to localhost:5000
3. **Browser** accesses everything via localhost (no IP dependencies)

### WSL2 to Windows Connection
The backend automatically detects the Windows host IP by:
1. Reading `/etc/resolv.conf` in WSL2
2. Extracting the nameserver IP (Windows host)
3. Using this IP to connect to PostgreSQL

### Key Configuration Files

#### Backend (.env)
```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
DATABASE_HOST=[auto-detected]
DATABASE_PORT=5432
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
```

#### Vite Config (vite.config.ts)
```javascript
server: {
  port: 3000,
  host: 'localhost',
  strictPort: true,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true
    }
  }
}
```

## Troubleshooting

### Issue: Cannot connect to PostgreSQL
```bash
# Check Windows host IP from WSL2
grep nameserver /etc/resolv.conf

# Test PostgreSQL connection
PGPASSWORD='@abcd1234' psql -h [WINDOWS_IP] -p 5432 -U postgres -d postgres -c "SELECT 1"
```

### Issue: Frontend/Backend not starting
```bash
# Check for running processes
ps aux | grep -E "(node|vite)"

# Kill all dev processes
npm run stop

# Check logs
tail -f logs/backend.log
tail -f logs/frontend.log
```

### Issue: Port already in use
```bash
# Find process using port
lsof -i :3000
lsof -i :5000

# Kill specific port
fuser -k 3000/tcp
fuser -k 5000/tcp
```

## Production Deployment

This localhost-based setup makes deployment easier:

1. **No hardcoded IPs** - Everything uses localhost or environment variables
2. **Standard ports** - Frontend (3000), Backend (5000), Database (5432)
3. **Environment-based** - Different .env files for dev/staging/production
4. **Docker-ready** - Can be containerized without network changes

### Production Environment Variables
```env
# Production .env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com
DATABASE_HOST=your-db-host.com
DATABASE_PORT=5432
DATABASE_SSL=true
```

## Benefits of This Setup

✅ **Stable URLs** - Always use localhost:3000 and localhost:5000
✅ **No IP Dependencies** - Works regardless of WSL2/Windows IP changes
✅ **Easy Development** - Single command to start everything
✅ **Production Ready** - Same configuration pattern for deployment
✅ **Cross-Platform** - Works on any Windows 11 + WSL2 setup

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full dev environment |
| `npm run stop` | Stop all services |
| `npm run dev:frontend` | Start only frontend |
| `npm run dev:backend` | Start only backend |
| `npm run setup` | Install all dependencies |
| `npm run build:frontend` | Build frontend for production |
| `npm run build:backend` | Build backend for production |
| `npm run test:e2e` | Run end-to-end tests |

## Logs Location

- Backend: `logs/backend.log`
- Frontend: `logs/frontend.log`

## Support

For issues or questions:
1. Check the logs first
2. Ensure PostgreSQL is running on Windows
3. Verify WSL2 network connectivity
4. Restart WSL2 if needed: `wsl --shutdown` then reopen terminal
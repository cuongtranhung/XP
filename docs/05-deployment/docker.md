# Docker Setup Guide

## Prerequisites

1. **Install Docker Desktop** (Windows/Mac) or Docker Engine (Linux)
   - Windows: https://docs.docker.com/desktop/install/windows-install/
   - Mac: https://docs.docker.com/desktop/install/mac-install/
   - Linux: https://docs.docker.com/engine/install/

2. **Install Docker Compose** (usually included with Docker Desktop)
   - Verify: `docker-compose --version`

## Quick Start

### 1. Clone and Navigate to Project
```bash
cd /mnt/c/Users/Admin/source/repos/XP
```

### 2. Start All Services
```bash
# Start all containers in detached mode
docker-compose up -d

# Or start with logs visible
docker-compose up
```

### 3. Check Services Status
```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Access Applications
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432

## Individual Service Management

### Database Only
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Connect to database
docker exec -it fullstack_auth_db psql -U postgres
```

### Backend Only
```bash
# Start backend (requires database)
docker-compose up -d postgres backend
```

### Frontend Only
```bash
# Start all services
docker-compose up -d
```

## Common Commands

### Stop Services
```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Rebuild Containers
```bash
# Rebuild after code changes
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild and start
docker-compose up -d --build
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Execute Commands in Container
```bash
# Backend shell
docker exec -it fullstack_auth_backend sh

# Run migrations
docker exec fullstack_auth_backend npm run db:migrate

# Frontend shell
docker exec -it fullstack_auth_frontend sh
```

## Database Management

### Connect to PostgreSQL
```bash
# Using psql
docker exec -it fullstack_auth_db psql -U postgres -d postgres

# Using connection string
psql postgresql://postgres:@abcd1234@localhost:5432/postgres
```

### Backup Database
```bash
# Create backup
docker exec fullstack_auth_db pg_dump -U postgres postgres > backup.sql

# Restore backup
docker exec -i fullstack_auth_db psql -U postgres postgres < backup.sql
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3000
lsof -i :5000
lsof -i :5432

# Kill process
kill -9 <PID>
```

### Container Won't Start
```bash
# Check logs
docker-compose logs <service-name>

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Database Connection Issues
1. Ensure PostgreSQL container is running: `docker-compose ps`
2. Check DATABASE_URL in backend container
3. Verify network connectivity: `docker network ls`

### Permission Issues
```bash
# Fix volume permissions
sudo chown -R $USER:$USER .
```

## Environment Variables

### Using .env.docker
```bash
# Copy environment file
cp .env.docker .env

# Start with env file
docker-compose --env-file .env.docker up
```

### Override Variables
```bash
# Set custom database password
POSTGRES_PASSWORD=newpassword docker-compose up

# Or export variables
export POSTGRES_PASSWORD=newpassword
docker-compose up
```

## Production Deployment

### Build for Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

### Security Checklist
- [ ] Change all default passwords
- [ ] Update JWT_SECRET to secure value
- [ ] Configure proper SMTP credentials
- [ ] Use HTTPS in production
- [ ] Limit exposed ports
- [ ] Regular security updates

## Useful Docker Commands

```bash
# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove all unused resources
docker system prune -a

# Check disk usage
docker system df

# Monitor resource usage
docker stats
```

## VS Code Integration

Install the Docker extension for VS Code:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search "Docker"
4. Install official Docker extension by Microsoft

This allows you to:
- View running containers
- Start/stop services
- View logs
- Manage images
- Debug inside containers
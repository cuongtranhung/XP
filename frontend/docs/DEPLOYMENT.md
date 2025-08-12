# Deployment Guide

This document provides comprehensive instructions for deploying the XP Frontend application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Production Deployment](#production-deployment)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher  
- **Docker**: 20.x or higher (for containerized deployment)
- **Docker Compose**: 1.29 or higher

## Environment Configuration

### 1. Environment Variables

Copy the environment template and configure for your environment:

```bash
cp .env.example .env
```

### 2. Required Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` |
| `VITE_APP_NAME` | Application name | `XP Frontend` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |

### 3. Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_FEATURE_ANALYTICS` | Enable analytics | `true` |
| `VITE_SENTRY_DSN` | Sentry error tracking | `""` |
| `VITE_DEBUG` | Enable debug mode | `false` |

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 3. Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Docker Deployment

### 1. Development with Docker

```bash
# Build and run development container
npm run docker:dev

# Or manually
docker-compose up
```

### 2. Production with Docker

```bash
# Build production image
npm run docker:build:prod

# Run production container
npm run docker:run:prod

# Or with docker-compose
npm run docker:prod
```

### 3. Multi-stage Docker Build

The Dockerfile uses multi-stage builds:

- **Builder stage**: Compiles TypeScript and builds the application
- **Production stage**: Serves the application with Nginx
- **Development stage**: Runs the development server with hot reload

## CI/CD Pipeline

### 1. GitHub Actions Workflow

The CI/CD pipeline includes:

- **Code Quality**: ESLint, Prettier, TypeScript checking
- **Testing**: Unit tests, E2E tests, coverage reports
- **Security**: Dependency auditing, vulnerability scanning
- **Performance**: Lighthouse CI for performance metrics
- **Build**: Docker image building and pushing
- **Deploy**: Automated deployment to staging and production

### 2. Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `VITE_API_URL` | Production API URL |
| `SONAR_TOKEN` | SonarCloud token |
| `SNYK_TOKEN` | Snyk security scanning token |
| `SLACK_WEBHOOK` | Slack notifications webhook |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI token |

### 3. Branch Strategy

- **main**: Production branch (auto-deploy to production)
- **develop**: Development branch (auto-deploy to staging)
- **feature/***: Feature branches (run tests only)

## Production Deployment

### 1. Build for Production

```bash
# Build the application
npm run build

# Analyze bundle size
npm run build:analyze
```

### 2. Docker Production Deployment

```bash
# Build production image with environment variables
docker build -t xp-frontend:prod \
  --target production \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_APP_NAME="XP Frontend Production" \
  .

# Run production container
docker run -d \
  --name xp-frontend-prod \
  -p 80:80 \
  --restart unless-stopped \
  xp-frontend:prod
```

### 3. Docker Compose Production

```bash
# Set environment variables
export VITE_API_URL=https://api.example.com
export VITE_APP_NAME="XP Frontend Production"

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xp-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: xp-frontend
  template:
    metadata:
      labels:
        app: xp-frontend
    spec:
      containers:
      - name: xp-frontend
        image: xp-frontend:prod
        ports:
        - containerPort: 80
        env:
        - name: VITE_API_URL
          value: "https://api.example.com"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Health Checks

### 1. Application Health Check

The application provides a health check endpoint:

```bash
curl http://localhost/health
```

Expected response: `healthy`

### 2. Docker Health Check

Docker containers include built-in health checks:

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View health check logs
docker inspect --format='{{json .State.Health}}' xp-frontend-prod
```

### 3. Monitoring Health Metrics

```bash
# Check application metrics
curl http://localhost/api/health/metrics

# Check Nginx status
curl http://localhost/nginx-status
```

## Security Configuration

### 1. Nginx Security Headers

The Nginx configuration includes security headers:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`: Configured for React applications

### 2. Container Security

- Non-root user execution
- Read-only file system
- Minimal base image (Alpine Linux)
- Security updates included

### 3. HTTPS Configuration

For production, configure SSL/TLS:

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
}
```

## Performance Optimization

### 1. Build Optimization

The production build includes:

- **Tree Shaking**: Removes unused code
- **Code Splitting**: Lazy-loaded routes and components
- **Minification**: Compressed JavaScript and CSS
- **Asset Optimization**: Optimized images and fonts

### 2. Nginx Optimization

- **Gzip Compression**: Reduces file sizes
- **Browser Caching**: Long-term caching for static assets
- **HTTP/2**: Improved performance
- **Resource Hints**: Preload critical resources

### 3. Performance Monitoring

```bash
# Run Lighthouse CI
npx lhci autorun

# Bundle analyzer
npm run build:analyze

# Performance testing
npm run test:e2e
```

## Troubleshooting

### 1. Common Issues

**Build Failures**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
rm -rf dist .vite
```

**Docker Issues**
```bash
# Rebuild Docker image without cache
docker build --no-cache -t xp-frontend .

# Check Docker logs
docker logs xp-frontend-prod

# Access container shell
docker exec -it xp-frontend-prod sh
```

**Performance Issues**
```bash
# Check bundle size
npm run build:analyze

# Run performance tests
npm run test:e2e

# Monitor with dev tools
npm run dev
```

### 2. Log Analysis

```bash
# Nginx access logs
docker exec xp-frontend-prod tail -f /var/log/nginx/access.log

# Nginx error logs
docker exec xp-frontend-prod tail -f /var/log/nginx/error.log

# Container logs
docker logs -f xp-frontend-prod
```

### 3. Health Check Debugging

```bash
# Test health endpoint
curl -v http://localhost/health

# Check container health status
docker inspect xp-frontend-prod | grep -A 10 '"Health"'

# Manual health check
docker exec xp-frontend-prod /usr/local/bin/health-check.sh
```

## Support

For deployment support:

1. Check the logs first
2. Verify environment variables
3. Test health endpoints
4. Review Docker/Kubernetes status
5. Contact the development team

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-01 | Initial deployment guide |
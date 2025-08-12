# 🚀 Hướng Dẫn Triển Khai Lên Máy Chủ Internet

## 📋 Danh Sách Cần Chuẩn Bị

### 1. Máy Chủ (VPS/Cloud Server)
- **CPU**: Tối thiểu 2 cores
- **RAM**: Tối thiểu 4GB
- **Disk**: Tối thiểu 20GB SSD
- **OS**: Ubuntu 20.04+ hoặc CentOS 8+
- **Network**: Port 80, 443, 22 mở

### 2. Tên Miền (Domain)
- Domain chính cho frontend (vd: `yourdomain.com`)
- Subdomain cho API (vd: `api.yourdomain.com`)
- SSL certificate (Let's Encrypt miễn phí)

### 3. Dịch Vụ Email SMTP
- Gmail SMTP (khuyến nghị)
- SendGrid, Mailgun, hoặc SMTP khác

### 4. Database Cloud (Tùy chọn)
- PostgreSQL từ AWS RDS, Google Cloud SQL
- Hoặc sử dụng PostgreSQL trên server

---

## 🛠️ Các Tùy Chọn Triển Khai

### Option 1: Docker Compose (Khuyến nghị cho bắt đầu)
### Option 2: Kubernetes (Cho production lớn)
### Option 3: Platform-as-a-Service (Heroku, Vercel, Railway)

---

## 🐳 OPTION 1: Docker Compose Deployment

### Bước 1: Chuẩn Bị Server

```bash
# Cập nhật server
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Cài đặt Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Restart để apply docker group
sudo reboot
```

### Bước 2: Upload Code Lên Server

```bash
# Clone repository
git clone https://github.com/your-username/your-repo.git /opt/auth-app
cd /opt/auth-app

# Hoặc upload qua SCP/SFTP
scp -r ./XP/ user@your-server-ip:/opt/auth-app
```

### Bước 3: Cấu Hình Environment

```bash
# Copy và chỉnh sửa file environment
cp .env.production .env

# Chỉnh sửa các thông tin:
nano .env
```

**Thông tin cần thay đổi trong .env:**
```env
# Database
DB_PASSWORD=your-super-secure-password-here

# JWT Secret (tạo random 32+ ký tự)
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters

# Email SMTP
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Domains
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
```

### Bước 4: Khởi Động Services

```bash
# Build và start containers
docker-compose -f docker-compose.prod.yml up -d

# Kiểm tra status
docker-compose -f docker-compose.prod.yml ps

# Xem logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Bước 5: Cấu Hình Nginx Reverse Proxy

```bash
# Cài đặt Nginx
sudo apt install nginx -y

# Tạo config file
sudo nano /etc/nginx/sites-available/auth-app
```

**Nội dung nginx config:**
```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site và restart nginx
sudo ln -s /etc/nginx/sites-available/auth-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Bước 6: Cài Đặt SSL Certificate

```bash
# Cài đặt Certbot
sudo apt install certbot python3-certbot-nginx -y

# Tạo SSL certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Setup auto-renewal
sudo crontab -e
# Thêm dòng: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## ☁️ OPTION 2: Platform-as-a-Service

### A. Heroku Deployment

```bash
# Cài đặt Heroku CLI
npm install -g heroku

# Login và tạo apps
heroku login
heroku create your-app-backend
heroku create your-app-frontend

# Configure environment variables
heroku config:set NODE_ENV=production -a your-app-backend
heroku config:set JWT_SECRET=your-secret -a your-app-backend
heroku config:set DATABASE_URL=your-db-url -a your-app-backend

# Deploy backend
git subtree push --prefix=backend heroku main

# Deploy frontend
git subtree push --prefix=frontend heroku main
```

### B. Vercel (Frontend) + Railway (Backend)

**Frontend trên Vercel:**
```bash
# Cài đặt Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

**Backend trên Railway:**
1. Đăng ký tài khoản Railway.app
2. Connect GitHub repository
3. Deploy backend từ /backend folder
4. Configure environment variables

---

## 🔧 Bảo Trì và Monitoring

### Health Checks

```bash
# Kiểm tra backend
curl https://api.yourdomain.com/health

# Kiểm tra frontend
curl https://yourdomain.com/health

# Kiểm tra database
docker-compose exec database pg_isready -U auth_user
```

### Log Monitoring

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f database
```

### Backup Database

```bash
# Tạo backup
docker-compose exec database pg_dump -U auth_user fullstack_auth_prod > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose exec -T database psql -U auth_user fullstack_auth_prod < backup_20240101.sql
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild và restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker system prune -f
```

---

## 🔒 Security Checklist

### Server Security
- [ ] Firewall cấu hình đúng (UFW/iptables)
- [ ] SSH key authentication (disable password)
- [ ] Fail2ban installed
- [ ] Regular security updates
- [ ] Non-root user for applications

### Application Security
- [ ] Environment variables không expose
- [ ] Strong JWT secret (32+ characters)
- [ ] Database password mạnh
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced

### Database Security
- [ ] Database user có quyền hạn tối thiểu
- [ ] Regular backups
- [ ] Connection encryption
- [ ] Access from application only

---

## 🚨 Troubleshooting

### Container Không Khởi Động
```bash
# Check logs
docker-compose logs container-name

# Check resources
docker system df
free -h
df -h
```

### Database Connection Issues
```bash
# Test connection
docker-compose exec backend npm run db:test

# Reset database
docker-compose down
docker volume rm auth-app_postgres_data
docker-compose up -d
```

### SSL Certificate Issues
```bash
# Renew certificates
sudo certbot renew

# Check expiry
sudo certbot certificates
```

---

## 📞 Support và Tài Liệu

- **GitHub Issues**: Để báo lỗi và feature requests
- **Docker Documentation**: https://docs.docker.com
- **Nginx Documentation**: https://nginx.org/en/docs/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/

---

## 🎯 Performance Optimization

### Production Optimizations
- Enable gzip compression
- Use CDN for static assets
- Database indexing
- Redis caching
- Image optimization
- Bundle splitting

### Monitoring Tools
- **Uptime**: UptimeRobot, Pingdom
- **Performance**: New Relic, DataDog
- **Logs**: ELK Stack, Grafana
- **Errors**: Sentry

**🎉 Chúc bạn deploy thành công!**
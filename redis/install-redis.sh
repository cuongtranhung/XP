#!/bin/bash

# Redis Installation Script for Development
# For Ubuntu/Debian based systems (including WSL)

echo "🚀 Installing Redis for XP System..."

# Update package list
sudo apt-get update

# Install Redis
sudo apt-get install -y redis-server redis-tools

# Backup default config
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup

# Copy our custom config
sudo cp ./redis.conf /etc/redis/redis.conf

# Create data directory
sudo mkdir -p /var/lib/redis
sudo chown redis:redis /var/lib/redis

# Start Redis service
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Check status
if redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis installed and running successfully!"
    echo "📊 Redis Info:"
    redis-cli INFO server | grep redis_version
    echo ""
    echo "🔗 Redis is available at: localhost:6379"
    echo "🎯 Test with: redis-cli ping"
else
    echo "❌ Redis installation failed"
    exit 1
fi
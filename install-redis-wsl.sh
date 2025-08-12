#!/bin/bash

echo "📦 Installing Redis on WSL/Ubuntu..."
echo "====================================="

# Update package list
echo "📋 Updating package list..."
sudo apt update

# Install Redis
echo "🚀 Installing Redis server..."
sudo apt install redis-server -y

# Configure Redis
echo "⚙️ Configuring Redis..."
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory <bytes>/maxmemory 512mb/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

# Start Redis service
echo "🔄 Starting Redis service..."
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis
echo "🔍 Testing Redis connection..."
redis-cli ping
if [ $? -eq 0 ]; then
    echo "✅ Redis installed and running successfully!"
    echo ""
    echo "📊 Redis Info:"
    echo "  - Host: localhost"
    echo "  - Port: 6379"
    echo "  - Config: /etc/redis/redis.conf"
    echo ""
    echo "🔧 Useful commands:"
    echo "  - Status: sudo systemctl status redis-server"
    echo "  - Restart: sudo systemctl restart redis-server"
    echo "  - Stop: sudo systemctl stop redis-server"
    echo "  - Redis CLI: redis-cli"
    echo "  - Monitor: redis-cli monitor"
else
    echo "❌ Failed to connect to Redis"
    sudo systemctl status redis-server
    exit 1
fi

echo "====================================="
echo "✅ Redis installation complete!"
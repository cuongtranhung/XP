#!/bin/bash

echo "🚀 Starting Redis for XP Project..."
echo "=================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Stop any existing Redis containers
echo "🔄 Stopping any existing Redis containers..."
docker-compose -f docker-compose.redis-simple.yml down 2>/dev/null

# Start Redis
echo "🚀 Starting Redis server..."
docker-compose -f docker-compose.redis-simple.yml up -d

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 3

# Test connection
echo "🔍 Testing Redis connection..."
docker exec xp-redis redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Redis is running successfully!"
    echo ""
    echo "📊 Redis Info:"
    echo "  - Host: localhost"
    echo "  - Port: 6379"
    echo "  - Commander UI: http://localhost:8081"
    echo "  - Username: admin"
    echo "  - Password: admin123"
    echo ""
    echo "🔧 Useful commands:"
    echo "  - Check status: docker exec xp-redis redis-cli ping"
    echo "  - View logs: docker logs xp-redis"
    echo "  - Stop Redis: docker-compose -f docker-compose.redis-simple.yml down"
    echo "  - Redis CLI: docker exec -it xp-redis redis-cli"
else
    echo "❌ Failed to connect to Redis. Check logs:"
    docker logs xp-redis
    exit 1
fi

echo "=================================="
echo "✅ Redis setup complete!"
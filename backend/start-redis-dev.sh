#!/bin/bash

# Start Redis for development
# This script tries multiple methods to get Redis running

echo "🚀 Starting Redis for XP Development..."
echo "======================================="
echo ""

# Method 1: Check if Redis is already installed
if command -v redis-server &> /dev/null; then
    echo "✅ Redis found in system"
    echo "Starting Redis server..."
    redis-server --port 6379 --daemonize yes
    
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running!"
        echo "🔗 Connection: localhost:6379"
        exit 0
    fi
fi

# Method 2: Check for local installation
if [ -f "$HOME/.local/bin/redis-server" ]; then
    echo "✅ Redis found in ~/.local/bin"
    export PATH="$HOME/.local/bin:$PATH"
    echo "Starting Redis server..."
    "$HOME/.local/bin/redis-server" --port 6379 --daemonize yes
    
    if "$HOME/.local/bin/redis-cli" ping &> /dev/null; then
        echo "✅ Redis is running!"
        echo "🔗 Connection: localhost:6379"
        exit 0
    fi
fi

# Method 3: Try Docker
if command -v docker &> /dev/null; then
    echo "🐳 Docker found, trying to start Redis container..."
    
    # Stop any existing Redis container
    docker stop xp-redis 2>/dev/null
    docker rm xp-redis 2>/dev/null
    
    # Start Redis container
    docker run -d \
        --name xp-redis \
        -p 6379:6379 \
        -v xp-redis-data:/data \
        redis:7.2-alpine \
        redis-server --appendonly yes
    
    sleep 2
    
    if docker exec xp-redis redis-cli ping &> /dev/null; then
        echo "✅ Redis is running in Docker!"
        echo "🔗 Connection: localhost:6379"
        echo "📦 Container: xp-redis"
        exit 0
    fi
fi

# Method 4: Download and run Redis binary (no compilation)
echo "📥 Attempting to download pre-built Redis binary..."

# Create temporary directory
TEMP_DIR="/tmp/redis-binary-$$"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Try to download from GitHub releases (redis-stack)
echo "Downloading Redis Stack binary..."
wget -q "https://github.com/redis-stack/redis-stack/releases/download/v7.2.0-v9/redis-stack-server-7.2.0-v9.x86_64-linux.tar.gz" -O redis.tar.gz

if [ -f "redis.tar.gz" ]; then
    tar xzf redis.tar.gz
    
    # Find redis-server binary
    REDIS_BIN=$(find . -name "redis-server" -type f 2>/dev/null | head -1)
    
    if [ -n "$REDIS_BIN" ]; then
        echo "✅ Redis binary found"
        
        # Copy to home directory
        mkdir -p "$HOME/.local/bin"
        cp "$REDIS_BIN" "$HOME/.local/bin/redis-server"
        chmod +x "$HOME/.local/bin/redis-server"
        
        # Also copy redis-cli if found
        REDIS_CLI=$(find . -name "redis-cli" -type f 2>/dev/null | head -1)
        if [ -n "$REDIS_CLI" ]; then
            cp "$REDIS_CLI" "$HOME/.local/bin/redis-cli"
            chmod +x "$HOME/.local/bin/redis-cli"
        fi
        
        # Start Redis
        "$HOME/.local/bin/redis-server" --port 6379 --daemonize yes
        
        sleep 2
        
        if "$HOME/.local/bin/redis-cli" ping &> /dev/null; then
            echo "✅ Redis is running!"
            echo "🔗 Connection: localhost:6379"
            rm -rf "$TEMP_DIR"
            exit 0
        fi
    fi
fi

# If all methods fail
echo ""
echo "❌ Could not start Redis automatically"
echo ""
echo "📋 Manual installation options:"
echo ""
echo "Option 1 - Install with apt (requires sudo):"
echo "  sudo apt update"
echo "  sudo apt install redis-server"
echo "  sudo service redis-server start"
echo ""
echo "Option 2 - Run the local installation script:"
echo "  chmod +x install-redis-local.sh"
echo "  ./install-redis-local.sh"
echo ""
echo "Option 3 - Use Docker:"
echo "  docker run -d -p 6379:6379 --name xp-redis redis:7-alpine"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

exit 1
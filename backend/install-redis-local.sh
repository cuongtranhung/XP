#!/bin/bash

# Install Redis locally without sudo (for development)
# This script downloads and compiles Redis in user space

echo "🚀 Installing Redis locally (no sudo required)..."

# Set installation directory
INSTALL_DIR="$HOME/.local/redis"
REDIS_VERSION="7.2.4"

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/.local/bin"

# Download Redis
cd /tmp
echo "📥 Downloading Redis ${REDIS_VERSION}..."
wget -q "http://download.redis.io/releases/redis-${REDIS_VERSION}.tar.gz"

if [ ! -f "redis-${REDIS_VERSION}.tar.gz" ]; then
    echo "❌ Failed to download Redis"
    exit 1
fi

# Extract
echo "📦 Extracting Redis..."
tar xzf "redis-${REDIS_VERSION}.tar.gz"
cd "redis-${REDIS_VERSION}"

# Compile
echo "🔨 Compiling Redis (this may take a few minutes)..."
make -j$(nproc) > /tmp/redis-compile.log 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed. Checking for dependencies..."
    echo "You may need to install: build-essential tcl"
    echo "Run: sudo apt-get install build-essential tcl"
    cat /tmp/redis-compile.log
    exit 1
fi

# Install to local directory
echo "📂 Installing to $INSTALL_DIR..."
make PREFIX="$INSTALL_DIR" install >> /tmp/redis-compile.log 2>&1

# Create symlinks in ~/.local/bin
ln -sf "$INSTALL_DIR/bin/redis-server" "$HOME/.local/bin/redis-server"
ln -sf "$INSTALL_DIR/bin/redis-cli" "$HOME/.local/bin/redis-cli"

# Create config directory
mkdir -p "$HOME/.config/redis"

# Create minimal config
cat > "$HOME/.config/redis/redis.conf" << 'EOF'
# Redis Configuration for XP Project

# Network
bind 127.0.0.1
port 6379
protected-mode yes

# General
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice
logfile ""

# Data
databases 16
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ./

# Limits
maxclients 10000
maxmemory 2gb
maxmemory-policy allkeys-lru

# Append Only Mode
appendonly no
appendfilename "appendonly.aof"
appendfsync everysec

# Performance
lazyfree-lazy-eviction no
lazyfree-lazy-expire no
lazyfree-lazy-server-del no
replica-lazy-flush no
EOF

echo "✅ Redis installed successfully!"
echo ""
echo "📍 Installation location: $INSTALL_DIR"
echo "📍 Config file: $HOME/.config/redis/redis.conf"
echo ""
echo "🔧 Add to PATH by running:"
echo "   export PATH=\$HOME/.local/bin:\$PATH"
echo ""
echo "   Or add to ~/.bashrc:"
echo "   echo 'export PATH=\$HOME/.local/bin:\$PATH' >> ~/.bashrc"
echo ""
echo "🚀 To start Redis:"
echo "   redis-server ~/.config/redis/redis.conf"
echo ""
echo "🔍 To test:"
echo "   redis-cli ping"

# Clean up
rm -rf "/tmp/redis-${REDIS_VERSION}"*

# Add to current session PATH
export PATH="$HOME/.local/bin:$PATH"

echo ""
echo "✨ Redis is ready to use!"
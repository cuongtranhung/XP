#!/bin/sh
# Health check script for the frontend container

# Check if Nginx is running
if ! pgrep nginx > /dev/null; then
    echo "ERROR: Nginx is not running"
    exit 1
fi

# Check if the application responds on the health endpoint
if ! curl -f http://localhost/health >/dev/null 2>&1; then
    echo "ERROR: Health endpoint is not responding"
    exit 1
fi

# Check if index.html exists and is readable
if [ ! -f /usr/share/nginx/html/index.html ]; then
    echo "ERROR: index.html not found"
    exit 1
fi

# Check if static assets directory exists
if [ ! -d /usr/share/nginx/html/assets ]; then
    echo "WARNING: Assets directory not found"
fi

echo "Health check passed"
exit 0
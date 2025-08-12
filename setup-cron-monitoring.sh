#!/bin/bash
# Setup cron job for automated monitoring

echo "📅 Setting up cron job for automated monitoring..."

# Create cron entry
CRON_CMD="@reboot cd /mnt/c/Users/Admin/source/repos/XP && /usr/bin/node stability-monitoring.js >> /var/log/stability-monitor.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "stability-monitoring.js"; then
    echo "⚠️ Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✅ Cron job added successfully"
fi

# Also create systemd service (for systems using systemd)
cat > /tmp/stability-monitor.service << EOF
[Unit]
Description=Stability Monitoring Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/mnt/c/Users/Admin/source/repos/XP
ExecStart=/usr/bin/node stability-monitoring.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/stability-monitor.log
StandardError=append:/var/log/stability-monitor.log

[Install]
WantedBy=multi-user.target
EOF

echo "📝 Systemd service file created at /tmp/stability-monitor.service"
echo ""
echo "To install as systemd service (requires sudo):"
echo "  sudo cp /tmp/stability-monitor.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable stability-monitor"
echo "  sudo systemctl start stability-monitor"
echo ""
echo "Current cron jobs:"
crontab -l 2>/dev/null | grep stability || echo "No stability monitoring cron jobs"
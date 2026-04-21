#!/bin/bash

# Quick Redis Installation Script for Ubuntu/WSL
# Run this in your Ubuntu/WSL terminal

echo "🚀 Installing Redis on Ubuntu..."

# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Start Redis service
sudo service redis-server start

# Check status
sudo service redis-server status

# Test connection
echo ""
echo "Testing Redis connection..."
redis-cli ping

# Set password
echo ""
echo "Setting Redis password..."
redis-cli <<EOF
CONFIG SET requirepass "NetViet72TranDangNinh_6df39"
CONFIG REWRITE
EOF

# Test with password
echo ""
echo "Testing with password..."
redis-cli -a NetViet72TranDangNinh_6df39 ping

echo ""
echo "✅ Redis installation complete!"
echo ""
echo "To auto-start Redis on WSL boot, add this to ~/.bashrc:"
echo "sudo service redis-server start"
echo ""
echo "Now you can restart your backend:"
echo "cd /mnt/c/customer-crm/backend-nestjs"
echo "npm run start:dev"

# Redis Setup for WSL (Windows Subsystem for Linux)

## ❌ Current Issue
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

Backend không thể kết nối Redis vì Redis chưa được cài đặt hoặc chưa chạy.

---

## ✅ Solution: Install Redis on WSL

### Option 1: Install Redis on WSL (Recommended)

#### Step 1: Open WSL Terminal
```bash
# Open Ubuntu/Debian WSL terminal
wsl
```

#### Step 2: Install Redis
```bash
# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y
```

#### Step 3: Configure Redis
```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Find and change:
# supervised no
# TO:
# supervised systemd

# Save and exit (Ctrl+X, Y, Enter)
```

#### Step 4: Start Redis
```bash
# Start Redis service
sudo service redis-server start

# Check status
sudo service redis-server status

# Test connection
redis-cli ping
# Should return: PONG
```

#### Step 5: Set Redis Password (Optional but Recommended)
```bash
# Connect to Redis
redis-cli

# Set password
CONFIG SET requirepass "NetViet72TranDangNinh_6df39"

# Save config
CONFIG REWRITE

# Exit
exit

# Test with password
redis-cli -a NetViet72TranDangNinh_6df39 ping
# Should return: PONG
```

#### Step 6: Auto-start Redis on WSL Boot
```bash
# Add to ~/.bashrc or ~/.zshrc
echo "sudo service redis-server start" >> ~/.bashrc

# Or create a startup script
sudo nano /etc/wsl.conf

# Add:
[boot]
command="service redis-server start"
```

---

### Option 2: Install Redis on Windows (Alternative)

#### Using Memurai (Redis for Windows)
1. Download from: https://www.memurai.com/get-memurai
2. Install and start Memurai service
3. Update `.env`:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

#### Using Docker Desktop
```bash
# Run Redis in Docker
docker run -d --name redis -p 6379:6379 redis:alpine redis-server --requirepass NetViet72TranDangNinh_6df39

# Check if running
docker ps

# Test connection
docker exec -it redis redis-cli -a NetViet72TranDangNinh_6df39 ping
```

---

### Option 3: Use Cloud Redis (Production)

#### Upstash Redis (Free Tier Available)
1. Sign up: https://upstash.com/
2. Create Redis database
3. Copy connection URL
4. Update `.env`:
   ```env
   REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT
   ```

#### Redis Labs (Free Tier Available)
1. Sign up: https://redis.com/try-free/
2. Create database
3. Get connection details
4. Update `.env`

---

## 🧪 Verify Redis Connection

### Test from Command Line
```bash
# Without password
redis-cli ping

# With password
redis-cli -a NetViet72TranDangNinh_6df39 ping

# Check info
redis-cli -a NetViet72TranDangNinh_6df39 info
```

### Test from Node.js
Create `test-redis.js`:
```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'NetViet72TranDangNinh_6df39',
  db: 0,
});

redis.ping((err, result) => {
  if (err) {
    console.error('❌ Redis connection failed:', err);
  } else {
    console.log('✅ Redis connected:', result);
  }
  redis.disconnect();
});
```

Run:
```bash
node test-redis.js
```

---

## 🔧 Current Backend Configuration

Your `.env` file:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=NetViet72TranDangNinh_6df39
REDIS_DB=0
REDIS_URL=redis://:NetViet72TranDangNinh_6df39@localhost:6379/0
```

---

## 🚀 After Redis is Running

### Restart Backend
```bash
# Stop current process
# Ctrl+C in the terminal running npm run start:dev

# Or kill process
pkill -f "nest start"

# Start again
npm run start:dev
```

### Check Backend Logs
You should see:
```
[Nest] LOG [InstanceLoader] BullModule dependencies initialized
[Nest] LOG [NestApplication] Nest application successfully started
```

---

## 🐛 Troubleshooting

### Redis not starting
```bash
# Check if port 6379 is in use
sudo lsof -i :6379

# Kill process using port
sudo kill -9 <PID>

# Restart Redis
sudo service redis-server restart
```

### Permission denied
```bash
# Fix permissions
sudo chown redis:redis /var/lib/redis
sudo chmod 755 /var/lib/redis
```

### Can't connect from Windows to WSL Redis
```bash
# Get WSL IP address
ip addr show eth0 | grep inet

# Update .env with WSL IP
REDIS_HOST=172.x.x.x  # Your WSL IP
```

---

## 📝 Quick Start Commands

```bash
# Install Redis (WSL)
sudo apt update && sudo apt install redis-server -y

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping

# Set password
redis-cli
CONFIG SET requirepass "NetViet72TranDangNinh_6df39"
CONFIG REWRITE
exit

# Test with password
redis-cli -a NetViet72TranDangNinh_6df39 ping

# Restart backend
cd /mnt/c/customer-crm/backend-nestjs
npm run start:dev
```

---

## ✅ Success Indicators

When Redis is working correctly, you'll see:
- ✅ `redis-cli ping` returns `PONG`
- ✅ Backend starts without Redis connection errors
- ✅ BullMQ queues initialize successfully
- ✅ Voucher verification jobs can be scheduled
- ✅ Bull Board dashboard accessible at `/admin/queues`

---

## 🔗 Related Documentation

- Redis Official Docs: https://redis.io/docs/
- BullMQ Docs: https://docs.bullmq.io/
- WSL Redis Guide: https://redis.io/docs/getting-started/installation/install-redis-on-windows/

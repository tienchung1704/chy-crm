# Start Redis with Docker (No sudo password needed!)

## 🐳 Option 1: Docker Desktop (Easiest)

### Step 1: Make sure Docker Desktop is running
- Open Docker Desktop on Windows
- Wait for it to start completely

### Step 2: Run Redis container
```bash
docker run -d --name redis-crm -p 6379:6379 redis:alpine redis-server --requirepass NetViet72TranDangNinh_6df39
```

### Step 3: Verify Redis is running
```bash
# Check container status
docker ps

# Test connection
docker exec -it redis-crm redis-cli -a NetViet72TranDangNinh_6df39 ping
# Should return: PONG
```

### Step 4: Restart backend
```bash
cd backend-nestjs
npm run start:dev
```

---

## 🔄 Docker Commands

### Start Redis (if stopped)
```bash
docker start redis-crm
```

### Stop Redis
```bash
docker stop redis-crm
```

### Remove Redis container
```bash
docker rm -f redis-crm
```

### View Redis logs
```bash
docker logs redis-crm
```

### Connect to Redis CLI
```bash
docker exec -it redis-crm redis-cli -a NetViet72TranDangNinh_6df39
```

---

## 🎯 Quick Start (Copy & Paste)

```bash
# Start Redis
docker run -d --name redis-crm -p 6379:6379 redis:alpine redis-server --requirepass NetViet72TranDangNinh_6df39

# Test
docker exec -it redis-crm redis-cli -a NetViet72TranDangNinh_6df39 ping

# Start backend
cd backend-nestjs
npm run start:dev
```

---

## ✅ Success!

When Redis is running, you'll see:
```
✅ PONG
```

Then your backend will start without errors! 🚀

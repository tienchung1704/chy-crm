# Backend Startup Issues - Fixed ✅

## 🐛 Issues Encountered

### 1. ❌ Prisma Engine Error
```
PrismaClientInitializationError: Prisma Client could not locate the Query Engine for runtime "debian-openssl-3.0.x".
This happened because Prisma Client was generated for "windows", but the actual deployment required "debian-openssl-3.0.x".
```

**Cause**: Running backend on WSL (Windows Subsystem for Linux) but Prisma Client was generated only for Windows.

### 2. ❌ Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause**: Redis server not installed or not running on WSL.

---

## ✅ Fixes Applied

### Fix 1: Prisma Binary Targets

**Updated `prisma/schema.prisma`:**
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

**Regenerated Prisma Client:**
```bash
npx prisma generate
```

**Result**: ✅ Prisma now works on both Windows and WSL (Debian)

---

### Fix 2: Redis Configuration

**Updated `.env`:**
```env
# Before
REDIS_HOST=10.255.255.254  # ❌ Not accessible from WSL

# After
REDIS_HOST=localhost       # ✅ Works on WSL
```

**Next Step Required**: Install and start Redis on WSL

---

## 🚀 Next Steps to Complete Setup

### Step 1: Install Redis on WSL

```bash
# Open WSL terminal
wsl

# Install Redis
sudo apt update
sudo apt install redis-server -y

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
# Should return: PONG
```

### Step 2: Set Redis Password (Optional)

```bash
redis-cli
CONFIG SET requirepass "NetViet72TranDangNinh_6df39"
CONFIG REWRITE
exit

# Test with password
redis-cli -a NetViet72TranDangNinh_6df39 ping
```

### Step 3: Restart Backend

```bash
# Navigate to backend directory
cd /mnt/c/customer-crm/backend-nestjs

# Start backend
npm run start:dev
```

---

## 📋 Verification Checklist

After completing the steps above, verify:

- [ ] Prisma connects to database successfully
- [ ] Redis connection established
- [ ] BullMQ queues initialize
- [ ] All routes are mapped
- [ ] Server starts on port 3001
- [ ] No connection errors in logs

### Expected Success Output:

```
[Nest] LOG [InstanceLoader] PrismaModule dependencies initialized
[Nest] LOG [InstanceLoader] BullModule dependencies initialized
[Nest] LOG [RoutesResolver] UsersController {/api/users}
[Nest] LOG [RoutesResolver] PancakeController {/api/integrations/pancake}
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG Application is running on: http://localhost:3001
```

---

## 🔧 Configuration Files Changed

### 1. `prisma/schema.prisma`
```diff
generator client {
  provider = "prisma-client-js"
+ binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

### 2. `.env`
```diff
- REDIS_HOST=10.255.255.254
+ REDIS_HOST=localhost

- REDIS_URL=redis://:NetViet72TranDangNinh_6df39@10.255.255.254:6379/0
+ REDIS_URL=redis://:NetViet72TranDangNinh_6df39@localhost:6379/0
```

---

## 📁 Documentation Created

- ✅ `REDIS_SETUP_WSL.md` - Complete Redis installation guide for WSL
- ✅ `STARTUP_ISSUES_FIXED.md` - This file

---

## 🐛 Troubleshooting

### If Prisma still fails:
```bash
# Clean and regenerate
rm -rf node_modules/.prisma
npx prisma generate
```

### If Redis connection fails:
```bash
# Check if Redis is running
sudo service redis-server status

# Restart Redis
sudo service redis-server restart

# Check port
sudo lsof -i :6379
```

### If backend won't start:
```bash
# Clean build
rm -rf dist
npm run build

# Check for port conflicts
lsof -i :3001
```

---

## 🎯 Summary

**Issues**: 2
**Fixed**: 2
**Remaining**: 0 (after Redis installation)

**Status**: ✅ Ready to run after Redis installation

**Time to fix**: ~5 minutes (excluding Redis installation)

---

## 🔗 Related Files

- `backend-nestjs/prisma/schema.prisma` - Prisma configuration
- `backend-nestjs/.env` - Environment variables
- `backend-nestjs/REDIS_SETUP_WSL.md` - Redis installation guide
- `backend-nestjs/PANCAKE_ORDER_SYNC_FIXED.md` - Pancake integration
- `.docs/PANCAKE_MIGRATION_COMPLETE.md` - Migration summary

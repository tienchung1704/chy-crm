# 🧪 Test Authentication System

## 📋 Quick Test Checklist

Copy checklist này và check từng item khi test:

```
[ ] 1. Login với email/password
[ ] 2. Login với Google OAuth
[ ] 3. Access token auto-refresh (đợi 15 phút)
[ ] 4. Refresh token rotation
[ ] 5. Logout từ 1 device
[ ] 6. Multiple device sessions
[ ] 7. OAuth migration (user cũ)
[ ] 8. Session expired handling
[ ] 9. API calls với auto-refresh
[ ] 10. Error handling
```

---

## 🔬 Detailed Test Cases

### Test 1: Login với Email/Password

**Steps:**
1. Mở http://localhost:3000/login
2. Nhập email/password
3. Click "Đăng nhập"

**Expected:**
- ✅ Redirect to `/portal` (CUSTOMER) hoặc `/admin` (ADMIN/STAFF)
- ✅ Cookies được set:
  - `crm_access_token` (maxAge: 900s = 15 min)
  - `crm_refresh_token` (maxAge: 2592000s = 30 days)
- ✅ Database có 1 record trong `refresh_tokens`

**Verify Cookies:**
```
DevTools → Application → Cookies → localhost:3000
```

**Verify Database:**
```sql
SELECT * FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
-- Should return 1 row
```

---

### Test 2: Login với Google OAuth

**Steps:**
1. Mở http://localhost:3000/login
2. Click "Đăng nhập với Google"
3. Chọn Google account
4. Authorize app

**Expected:**
- ✅ Redirect về `/portal` hoặc `/admin`
- ✅ Cookies được set (giống Test 1)
- ✅ Database có record trong `oauth_accounts`
- ✅ Database có record trong `refresh_tokens`

**Verify OAuth Account:**
```sql
SELECT * FROM oauth_accounts WHERE user_id = 'YOUR_USER_ID';
-- Should return 1 row with provider = 'google'
```

---

### Test 3: Access Token Auto-Refresh

**Mục đích:** Verify user không bị logout sau 15 phút

#### Option A: Đợi 15 phút (Real Test)

**Steps:**
1. Login vào hệ thống
2. Đợi 16 phút (để access token hết hạn)
3. Navigate to bất kỳ page nào (VD: `/portal/customers`)

**Expected:**
- ✅ Page load bình thường
- ✅ Không bị redirect to `/login`
- ✅ Network tab shows:
  - Request to `/portal/customers` → 401
  - Auto request to `/api/auth/refresh` → 200
  - Retry request to `/portal/customers` → 200

#### Option B: Test nhanh (Development)

**Steps:**
1. Thay đổi token expiry trong code:

```typescript
// src/lib/auth.ts
const ACCESS_TOKEN_EXPIRY = '10s'; // Thay vì '15m'
```

2. Restart dev server
3. Login
4. Đợi 11 giây
5. Navigate to page khác

**Expected:** Giống Option A

**Restore sau khi test:**
```typescript
const ACCESS_TOKEN_EXPIRY = '15m'; // Restore
```

---

### Test 4: Refresh Token Rotation

**Mục đích:** Verify token được xoay vòng (old deleted, new created)

**Steps:**
1. Login → Note token ID trong DB:
```sql
SELECT id, token FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
-- Note the ID: abc-123
```

2. Trigger refresh (dùng Test 3 Option B)

3. Check DB lại:
```sql
SELECT id, token FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
-- Should see DIFFERENT ID: xyz-789
-- Old token abc-123 should be DELETED
```

**Expected:**
- ✅ Old token bị xóa
- ✅ New token được tạo
- ✅ User vẫn authenticated

---

### Test 5: Logout từ 1 Device

**Steps:**
1. Login trên Chrome
2. Check DB:
```sql
SELECT COUNT(*) FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
-- Should return 1
```

3. Click "Logout" trên Chrome

4. Check DB lại:
```sql
SELECT COUNT(*) FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
-- Should return 0
```

**Expected:**
- ✅ Redirect to `/login`
- ✅ Cookies bị xóa
- ✅ Refresh tokens bị xóa khỏi DB

---

### Test 6: Multiple Device Sessions

**Steps:**
1. Login trên Chrome → Check DB (1 token)
2. Login trên Firefox → Check DB (2 tokens)
3. Login trên Edge → Check DB (3 tokens)

```sql
SELECT id, created_at FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
-- Should return 3 rows
```

4. Logout trên Chrome → Check DB (2 tokens)

**Expected:**
- ✅ Mỗi device có token riêng
- ✅ Logout 1 device không ảnh hưởng devices khác

**Note:** Hiện tại logout xóa TẤT CẢ tokens (logout all devices). Nếu muốn logout per-device, cần thêm tokenId vào JWT payload.

---

### Test 7: OAuth Migration (User Cũ)

**Mục đích:** Verify user cũ (có `googleId`) được migrate sang `OAuthAccount`

**Setup:**
```sql
-- Tạo user cũ với googleId
INSERT INTO users (id, name, email, google_id, referral_code, role, created_at, updated_at)
VALUES (
  'test-old-user',
  'Old User',
  'olduser@test.com',
  'google-old-123',
  'OLDUSER1',
  'CUSTOMER',
  NOW(),
  NOW()
);

-- Tạo referral closure
INSERT INTO referral_closures (id, ancestor_id, descendant_id, depth)
VALUES (UUID(), 'test-old-user', 'test-old-user', 0);
```

**Steps:**
1. Login bằng Google với email `olduser@test.com`
2. Check DB:

```sql
-- Should find user by googleId
SELECT * FROM users WHERE id = 'test-old-user';

-- Should create OAuthAccount
SELECT * FROM oauth_accounts WHERE user_id = 'test-old-user';
-- Should return 1 row with provider = 'google'
```

**Expected:**
- ✅ User login thành công
- ✅ OAuthAccount được tạo
- ✅ User data không bị mất

**Cleanup:**
```sql
DELETE FROM oauth_accounts WHERE user_id = 'test-old-user';
DELETE FROM referral_closures WHERE ancestor_id = 'test-old-user';
DELETE FROM users WHERE id = 'test-old-user';
```

---

### Test 8: Session Expired Handling

**Mục đích:** Verify redirect khi refresh token hết hạn/invalid

**Steps:**
1. Login vào hệ thống
2. Xóa refresh token trong DB:
```sql
DELETE FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';
```

3. Trigger API call (navigate to page khác)

**Expected:**
- ✅ Auto redirect to `/login?session_expired=1`
- ✅ Error message hiển thị (nếu có)

**Alternative Test:**
```sql
-- Set token expired
UPDATE refresh_tokens 
SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE user_id = 'YOUR_USER_ID';
```

---

### Test 9: API Calls với Auto-Refresh

**Mục đích:** Verify `api-client` hoạt động đúng

**Setup:** Tạo test component

```typescript
// src/app/test-api/page.tsx
'use client';

import { useApi } from '@/hooks/useApi';

export default function TestApiPage() {
  const { data, loading, error, refetch } = useApi('/api/customers');

  return (
    <div>
      <h1>Test API Client</h1>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <button onClick={refetch}>Refetch</button>
    </div>
  );
}
```

**Steps:**
1. Mở http://localhost:3000/test-api
2. Verify data loads
3. Trigger token expiry (Test 3 Option B)
4. Click "Refetch"

**Expected:**
- ✅ Data loads successfully
- ✅ Auto-refresh happens transparently
- ✅ No errors, no logout

**Check Network Tab:**
```
1. GET /api/customers → 401
2. POST /api/auth/refresh → 200
3. GET /api/customers → 200 (retry)
```

---

### Test 10: Error Handling

**Test 10.1: Invalid Credentials**

**Steps:**
1. Login với wrong password
2. Check response

**Expected:**
- ✅ Error message: "Invalid credentials"
- ✅ No cookies set
- ✅ Stay on login page

**Test 10.2: Network Error**

**Steps:**
1. Stop dev server
2. Try to login

**Expected:**
- ✅ Error message: "Network error"
- ✅ Graceful error handling

**Test 10.3: Expired Refresh Token**

**Steps:**
1. Login
2. Set token expired in DB
3. Trigger API call

**Expected:**
- ✅ Redirect to `/login?session_expired=1`
- ✅ No infinite loop

---

## 🔍 Debugging Tools

### 1. Check Cookies

```javascript
// Run in Browser Console
document.cookie.split(';').forEach(c => console.log(c.trim()));
```

### 2. Check JWT Payload

```javascript
// Decode JWT (without verification)
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

// Usage
const accessToken = 'YOUR_ACCESS_TOKEN';
console.log(parseJwt(accessToken));
// { userId: 'xxx', role: 'CUSTOMER', iat: xxx, exp: xxx }
```

### 3. Monitor Refresh Calls

```javascript
// Add to src/lib/api-client.ts for debugging
console.log('[API Client] Calling:', url);
console.log('[API Client] Response:', response.status);
```

### 4. Database Queries

```sql
-- Active sessions
SELECT 
  u.email,
  rt.id as token_id,
  rt.created_at,
  rt.expires_at,
  TIMESTAMPDIFF(MINUTE, NOW(), rt.expires_at) as minutes_until_expiry
FROM refresh_tokens rt
JOIN users u ON u.id = rt.user_id
WHERE rt.expires_at > NOW()
ORDER BY rt.created_at DESC;

-- Expired tokens (should be cleaned up)
SELECT COUNT(*) FROM refresh_tokens WHERE expires_at < NOW();

-- OAuth accounts by provider
SELECT provider, COUNT(*) as count
FROM oauth_accounts
GROUP BY provider;
```

---

## 🐛 Common Issues & Solutions

### Issue: "Invalid or expired refresh token"

**Debug:**
```sql
-- Check if token exists
SELECT * FROM refresh_tokens WHERE user_id = 'YOUR_USER_ID';

-- Check if expired
SELECT * FROM refresh_tokens 
WHERE user_id = 'YOUR_USER_ID' 
AND expires_at > NOW();
```

**Solution:**
- User needs to login again
- Check if logout was called
- Check if token was manually deleted

### Issue: Auto-refresh not working

**Debug:**
1. Check Network tab → Should see `/api/auth/refresh` call
2. Check if using `api-client`:
```typescript
// ❌ BAD
fetch('/api/customers')

// ✅ GOOD
import { api } from '@/lib/api-client';
api.get('/api/customers')
```

**Solution:**
- Replace all `fetch()` with `api.*` methods
- Use `useApi` hook for data fetching

### Issue: Infinite redirect loop

**Debug:**
```javascript
// Check if refresh endpoint is being called repeatedly
// Network tab → Filter: "refresh"
```

**Solution:**
- Check if `/api/auth/refresh` is excluded from interceptor
- Verify refresh endpoint returns 200 on success

### Issue: CORS errors

**Debug:**
```
Access to fetch at 'http://localhost:3000/api/auth/refresh' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
- Ensure `credentials: 'include'` in fetch options
- Check Next.js config for CORS settings

---

## 📊 Performance Monitoring

### Metrics to Track

```sql
-- Average session duration
SELECT 
  AVG(TIMESTAMPDIFF(MINUTE, created_at, expires_at)) as avg_session_minutes
FROM refresh_tokens;

-- Active users
SELECT COUNT(DISTINCT user_id) 
FROM refresh_tokens 
WHERE expires_at > NOW();

-- Login frequency
SELECT 
  DATE(created_at) as date,
  COUNT(*) as logins
FROM refresh_tokens
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

---

## ✅ Test Summary

Sau khi hoàn thành tất cả tests:

```
✅ Login flows work correctly
✅ Tokens are generated and stored properly
✅ Auto-refresh works transparently
✅ Token rotation prevents replay attacks
✅ Multiple devices are supported
✅ OAuth migration works for old users
✅ Error handling is graceful
✅ No security vulnerabilities detected
```

**Sign-off:**
```
Tested by: _______________
Date: _______________
Environment: Development / Staging / Production
Status: PASS / FAIL
Notes: _______________
```

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] Migration file created and tested
- [ ] Environment variables set correctly
- [ ] HTTPS enabled (secure cookies)
- [ ] Rate limiting configured
- [ ] Monitoring/logging set up
- [ ] Backup database before migration
- [ ] Rollback plan prepared
- [ ] Team trained on new system
- [ ] Documentation updated

---

## 📞 Support

Nếu gặp vấn đề:

1. Check logs: `npm run dev` output
2. Check database: Run SQL queries above
3. Check browser console: DevTools → Console
4. Check network: DevTools → Network
5. Review documentation: `AUTH_UPGRADE_GUIDE.md`

**Common Commands:**
```bash
# Reset database (development only!)
npx prisma migrate reset

# Generate Prisma Client
npx prisma generate

# View database
npx prisma studio

# Check migration status
npx prisma migrate status
```

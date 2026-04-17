# 🔄 Migration Examples - Cách Chuyển Đổi Code Cũ

## 📋 Tổng Quan

Tài liệu này hướng dẫn cách chuyển đổi code cũ (dùng `fetch` trực tiếp) sang code mới (dùng `api-client` với auto-refresh).

---

## 🔧 Client Components

### ❌ BEFORE (Code Cũ)

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => {
        setCustomers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {customers.map(c => <div key={c.id}>{c.name}</div>)}
    </div>
  );
}
```

**Vấn đề:**
- ❌ Không auto-refresh khi token hết hạn
- ❌ User bị logout sau 15 phút
- ❌ Phải handle error manually
- ❌ Code dài dòng, lặp lại nhiều

### ✅ AFTER (Code Mới)

```typescript
'use client';

import { useApi } from '@/hooks/useApi';

export default function CustomerList() {
  const { data: customers, loading, error } = useApi('/api/customers');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {customers?.map(c => <div key={c.id}>{c.name}</div>)}
    </div>
  );
}
```

**Lợi ích:**
- ✅ Auto-refresh khi token hết hạn
- ✅ Code ngắn gọn, dễ đọc
- ✅ Error handling tự động
- ✅ TypeScript support

---

## 📝 Form Submissions

### ❌ BEFORE (Code Cũ)

```typescript
'use client';

import { useState } from 'react';

export default function CreateCustomerForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
    };

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to create customer');
      }

      alert('Customer created!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

### ✅ AFTER (Code Mới)

```typescript
'use client';

import { useMutation } from '@/hooks/useApi';

export default function CreateCustomerForm() {
  const { mutate, loading, error } = useMutation('/api/customers', 'POST');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await mutate({
        name: formData.get('name'),
        email: formData.get('email'),
      });
      alert('Customer created!');
    } catch (err) {
      // Error already handled by hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
}
```

---

## 🔄 Manual Fetch (Không dùng Hook)

### ❌ BEFORE (Code Cũ)

```typescript
const handleDelete = async (id: string) => {
  if (!confirm('Are you sure?')) return;

  try {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Failed to delete');
    }

    alert('Deleted!');
    // Refresh list...
  } catch (err) {
    alert('Error: ' + err.message);
  }
};
```

### ✅ AFTER (Code Mới)

```typescript
import { api } from '@/lib/api-client';

const handleDelete = async (id: string) => {
  if (!confirm('Are you sure?')) return;

  try {
    await api.delete(`/api/customers/${id}`);
    alert('Deleted!');
    // Refresh list...
  } catch (err) {
    alert('Error: ' + err.message);
  }
};
```

---

## 🔍 Search/Filter với Debounce

### ❌ BEFORE (Code Cũ)

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers?search=${query}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search customers..."
      />
      {loading && <div>Searching...</div>}
      {results.map(c => <div key={c.id}>{c.name}</div>)}
    </div>
  );
}
```

### ✅ AFTER (Code Mới)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

export default function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/customers?search=${query}`);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <input 
        value={query} 
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search customers..."
      />
      {loading && <div>Searching...</div>}
      {results.map(c => <div key={c.id}>{c.name}</div>)}
    </div>
  );
}
```

**Hoặc tạo custom hook:**

```typescript
// src/hooks/useSearch.ts
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

export function useSearch<T>(url: string, query: string, delay = 300) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<T[]>(`${url}?search=${query}`);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [url, query, delay]);

  return { results, loading };
}

// Usage
const { results, loading } = useSearch('/api/customers', query);
```

---

## 📊 Pagination

### ❌ BEFORE (Code Cũ)

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function CustomerPagination() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ customers: [], total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/customers?page=${page}&limit=10`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, [page]);

  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          {data.customers.map(c => <div key={c.id}>{c.name}</div>)}
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            Previous
          </button>
          <button onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </>
      )}
    </div>
  );
}
```

### ✅ AFTER (Code Mới)

```typescript
'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';

export default function CustomerPagination() {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi(`/api/customers?page=${page}&limit=10`);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {data?.customers.map(c => <div key={c.id}>{c.name}</div>)}
      <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>
        Previous
      </button>
      <button onClick={() => setPage(p => p + 1)}>
        Next
      </button>
    </div>
  );
}
```

---

## 🔄 Refetch/Refresh Data

### ❌ BEFORE (Code Cũ)

```typescript
const [refresh, setRefresh] = useState(0);

useEffect(() => {
  fetch('/api/customers')
    .then(res => res.json())
    .then(setCustomers);
}, [refresh]);

// Trigger refresh
<button onClick={() => setRefresh(r => r + 1)}>Refresh</button>
```

### ✅ AFTER (Code Mới)

```typescript
const { data: customers, refetch } = useApi('/api/customers');

// Trigger refresh
<button onClick={refetch}>Refresh</button>
```

---

## 🎯 Complex Example: CRUD với Optimistic Updates

### ✅ AFTER (Code Mới - Best Practice)

```typescript
'use client';

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/useApi';

interface Customer {
  id: string;
  name: string;
  email: string;
}

export default function CustomerManager() {
  const { data: customers, loading, refetch } = useApi<Customer[]>('/api/customers');
  const { mutate: createCustomer } = useMutation('/api/customers', 'POST');
  const { mutate: deleteCustomer } = useMutation('/api/customers', 'DELETE');
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (formData: FormData) => {
    try {
      await createCustomer({
        name: formData.get('name'),
        email: formData.get('email'),
      });
      refetch(); // Refresh list
    } catch (err) {
      alert('Failed to create customer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    
    try {
      await deleteCustomer(undefined, {
        // Override URL for specific ID
        url: `/api/customers/${id}`,
      });
      refetch(); // Refresh list
    } catch (err) {
      alert('Failed to delete customer');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <form action={handleCreate}>
        <input name="name" required />
        <input name="email" type="email" required />
        <button type="submit">Create</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers?.map(customer => (
            <tr key={customer.id}>
              <td>{customer.name}</td>
              <td>{customer.email}</td>
              <td>
                <button onClick={() => setEditingId(customer.id)}>Edit</button>
                <button onClick={() => handleDelete(customer.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 📝 Checklist Migration

Khi migrate code, check các điểm sau:

### Client Components
- [ ] Thay `fetch()` → `api.get()` / `api.post()` / etc
- [ ] Thay `useEffect` + `fetch` → `useApi` hook
- [ ] Thay form submission → `useMutation` hook
- [ ] Remove manual error handling (hook đã handle)
- [ ] Remove manual loading state (hook đã có)

### Server Components
- [ ] Không cần thay đổi (vẫn dùng `getSession()` như cũ)
- [ ] Server components không bị ảnh hưởng bởi token expiry

### API Routes
- [ ] Không cần thay đổi backend code
- [ ] Refresh endpoint đã được implement sẵn

---

## 🎓 Best Practices

### 1. Dùng Hook cho Data Fetching

```typescript
// ✅ GOOD
const { data, loading, error } = useApi('/api/customers');

// ❌ BAD
useEffect(() => {
  fetch('/api/customers').then(...)
}, []);
```

### 2. Dùng Hook cho Mutations

```typescript
// ✅ GOOD
const { mutate, loading } = useMutation('/api/customers', 'POST');

// ❌ BAD
const [loading, setLoading] = useState(false);
const handleSubmit = async () => {
  setLoading(true);
  await fetch(...);
  setLoading(false);
};
```

### 3. Dùng api.* cho One-off Calls

```typescript
// ✅ GOOD - One-off delete
import { api } from '@/lib/api-client';
await api.delete(`/api/customers/${id}`);

// ❌ BAD - Overkill cho one-off call
const { mutate } = useMutation(`/api/customers/${id}`, 'DELETE');
await mutate();
```

### 4. TypeScript Types

```typescript
// ✅ GOOD
interface Customer {
  id: string;
  name: string;
  email: string;
}

const { data } = useApi<Customer[]>('/api/customers');
// data is typed as Customer[] | null

// ❌ BAD
const { data } = useApi('/api/customers');
// data is typed as any
```

---

## 🚀 Quick Migration Script

Nếu có nhiều file cần migrate, có thể dùng find & replace:

### Step 1: Add imports

```typescript
// Thêm vào đầu file
import { useApi, useMutation } from '@/hooks/useApi';
import { api } from '@/lib/api-client';
```

### Step 2: Replace patterns

```bash
# Find: fetch\('/api/
# Replace: api.get('/api/

# Find: fetch\('/api/.*', \{ method: 'POST'
# Replace: api.post('/api/
```

### Step 3: Manual review

- Review từng file để đảm bảo logic đúng
- Test thoroughly sau khi migrate

---

## ✅ Summary

**Key Changes:**
- `fetch()` → `api.get()` / `api.post()` / etc
- Manual `useEffect` + `fetch` → `useApi` hook
- Manual form handling → `useMutation` hook

**Benefits:**
- ✅ Auto-refresh khi token hết hạn
- ✅ Code ngắn gọn hơn 50%
- ✅ Error handling tự động
- ✅ Loading state tự động
- ✅ TypeScript support tốt hơn
- ✅ Consistent API across codebase

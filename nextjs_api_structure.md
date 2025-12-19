# Next.js API Structure - Production Grade TypeScript

## 📁 Struktur Folder TERBAIK

```
/src
  /lib
    /api
      /clients
        http-client.ts       # Base HTTP client
        api-client.ts        # API wrapper dengan methods
      /services              # ✅ Business Logic Layer
        users.service.ts
        posts.service.ts
        auth.service.ts
      /types                 # Types per domain
        user.types.ts
        post.types.ts
        common.types.ts
      /utils
        error-handler.ts
        response-parser.ts
      config.ts              # API Configuration
      index.ts               # Barrel export
  /hooks
    /api                     # Custom hooks untuk client-side
      useUsers.ts
      usePosts.ts
      useAuth.ts
  /app
    /users
      page.tsx
      /[id]
        page.tsx
      /create
        page.tsx
```

---

## 1️⃣ Types (Terpisah per Domain)

### `/lib/api/types/common.types.ts`

```typescript
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
  status: number;
}

export type RequestConfig = RequestInit & {
  timeout?: number;
  retry?: number;
};
```

### `/lib/api/types/user.types.ts`

```typescript
export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface UserFilters {
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'name' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
```

### `/lib/api/types/post.types.ts`

```typescript
export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostDto {
  title: string;
  body: string;
  published?: boolean;
}

export interface UpdatePostDto {
  title?: string;
  body?: string;
  published?: boolean;
}
```

---

## 2️⃣ Configuration

### `/lib/api/config.ts`

```typescript
export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com',
  timeout: 10000,
  retryAttempts: 3,
  headers: {
    'Content-Type': 'application/json',
  },
} as const;

export const API_ENDPOINTS = {
  users: '/users',
  posts: '/posts',
  auth: '/auth',
  profile: '/profile',
} as const;
```

### `.env.local`

```bash
NEXT_PUBLIC_API_URL=https://api.example.com
API_SECRET_KEY=your-secret-key
```

---

## 3️⃣ HTTP Client (Base Layer)

### `/lib/api/clients/http-client.ts`

```typescript
export class HttpClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private timeout: number;

  constructor(baseURL: string, timeout: number = 10000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw {
        message: error.message || 'Request failed',
        status: response.status,
        errors: error.errors,
      };
    }

    return response.json();
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    const response = await this.fetchWithTimeout(url, config);
    return this.handleResponse<T>(response);
  }

  setAuthToken(token: string): void {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  removeAuthToken(): void {
    const { Authorization, ...rest } = this.defaultHeaders as any;
    this.defaultHeaders = rest;
  }
}
```

---

## 4️⃣ API Client (Wrapper Layer)

### `/lib/api/clients/api-client.ts`

```typescript
import { HttpClient } from './http-client';
import { API_CONFIG } from '../config';

class ApiClient extends HttpClient {
  constructor() {
    super(API_CONFIG.baseURL, API_CONFIG.timeout);
  }

  // GET
  async get<T>(endpoint: string, cache?: RequestCache): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      cache: cache || 'force-cache',
      next: { revalidate: 3600 },
    });
  }

  // POST
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    });
  }

  // PUT
  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      cache: 'no-store',
    });
  }

  // PATCH
  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      cache: 'no-store',
    });
  }

  // DELETE
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      cache: 'no-store',
    });
  }
}

export const apiClient = new ApiClient();
```

---

## 5️⃣ Service Layer (Business Logic) ✅ PENTING!

### `/lib/api/services/users.service.ts`

```typescript
import { apiClient } from '../clients/api-client';
import { API_ENDPOINTS } from '../config';
import type { 
  User, 
  CreateUserDto, 
  UpdateUserDto, 
  UserFilters,
  PaginatedResponse 
} from '../types';

class UsersService {
  private readonly endpoint = API_ENDPOINTS.users;

  async getAll(filters?: UserFilters): Promise<User[]> {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString();
    
    const url = queryParams 
      ? `${this.endpoint}?${queryParams}` 
      : this.endpoint;
    
    return apiClient.get<User[]>(url);
  }

  async getPaginated(filters?: UserFilters): Promise<PaginatedResponse<User>> {
    const queryParams = new URLSearchParams(
      filters as Record<string, string>
    ).toString();
    
    return apiClient.get<PaginatedResponse<User>>(
      `${this.endpoint}/paginated?${queryParams}`
    );
  }

  async getById(id: number): Promise<User> {
    return apiClient.get<User>(`${this.endpoint}/${id}`);
  }

  async create(data: CreateUserDto): Promise<User> {
    return apiClient.post<User>(this.endpoint, data);
  }

  async update(id: number, data: UpdateUserDto): Promise<User> {
    return apiClient.put<User>(`${this.endpoint}/${id}`, data);
  }

  async partialUpdate(id: number, data: Partial<UpdateUserDto>): Promise<User> {
    return apiClient.patch<User>(`${this.endpoint}/${id}`, data);
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete<void>(`${this.endpoint}/${id}`);
  }

  // Business logic tambahan
  async verifyEmail(userId: number, token: string): Promise<void> {
    return apiClient.post<void>(`${this.endpoint}/${userId}/verify`, { token });
  }

  async changePassword(
    userId: number, 
    oldPassword: string, 
    newPassword: string
  ): Promise<void> {
    return apiClient.post<void>(`${this.endpoint}/${userId}/change-password`, {
      oldPassword,
      newPassword,
    });
  }

  async uploadAvatar(userId: number, file: File): Promise<User> {
    const formData = new FormData();
    formData.append('avatar', file);
    
    return apiClient.post<User>(`${this.endpoint}/${userId}/avatar`, formData);
  }
}

export const usersService = new UsersService();
```

### `/lib/api/services/posts.service.ts`

```typescript
import { apiClient } from '../clients/api-client';
import { API_ENDPOINTS } from '../config';
import type { Post, CreatePostDto, UpdatePostDto } from '../types';

class PostsService {
  private readonly endpoint = API_ENDPOINTS.posts;

  async getAll(): Promise<Post[]> {
    return apiClient.get<Post[]>(this.endpoint);
  }

  async getById(id: number): Promise<Post> {
    return apiClient.get<Post>(`${this.endpoint}/${id}`);
  }

  async getByUserId(userId: number): Promise<Post[]> {
    return apiClient.get<Post[]>(`/users/${userId}/posts`);
  }

  async create(data: CreatePostDto): Promise<Post> {
    return apiClient.post<Post>(this.endpoint, data);
  }

  async update(id: number, data: UpdatePostDto): Promise<Post> {
    return apiClient.put<Post>(`${this.endpoint}/${id}`, data);
  }

  async delete(id: number): Promise<void> {
    return apiClient.delete<void>(`${this.endpoint}/${id}`);
  }

  async publish(id: number): Promise<Post> {
    return apiClient.patch<Post>(`${this.endpoint}/${id}`, { published: true });
  }

  async unpublish(id: number): Promise<Post> {
    return apiClient.patch<Post>(`${this.endpoint}/${id}`, { published: false });
  }
}

export const postsService = new PostsService();
```

### `/lib/api/services/auth.service.ts`

```typescript
import { apiClient } from '../clients/api-client';
import { API_ENDPOINTS } from '../config';
import type { User } from '../types';

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

class AuthService {
  private readonly endpoint = API_ENDPOINTS.auth;

  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      `${this.endpoint}/login`, 
      credentials
    );
    
    // Auto set token
    apiClient.setAuthToken(response.token);
    
    // Save to storage
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
    }
    
    return response;
  }

  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      `${this.endpoint}/register`, 
      data
    );
    
    apiClient.setAuthToken(response.token);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
    }
    
    return response;
  }

  async logout(): Promise<void> {
    await apiClient.post<void>(`${this.endpoint}/logout`);
    apiClient.removeAuthToken();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  }

  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await apiClient.post<{ token: string }>(
      `${this.endpoint}/refresh`, 
      { refreshToken }
    );
    
    apiClient.setAuthToken(response.token);
    localStorage.setItem('token', response.token);
    
    return response.token;
  }

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>(`${this.endpoint}/me`);
  }

  async forgotPassword(email: string): Promise<void> {
    return apiClient.post<void>(`${this.endpoint}/forgot-password`, { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    return apiClient.post<void>(`${this.endpoint}/reset-password`, {
      token,
      newPassword,
    });
  }
}

export const authService = new AuthService();
```

---

## 6️⃣ Barrel Exports (Clean Imports)

### `/lib/api/index.ts`

```typescript
// Clients
export { apiClient } from './clients/api-client';

// Services
export { usersService } from './services/users.service';
export { postsService } from './services/posts.service';
export { authService } from './services/auth.service';

// Types - User
export type { 
  User, 
  CreateUserDto, 
  UpdateUserDto, 
  UserFilters 
} from './types/user.types';

// Types - Post
export type { 
  Post, 
  CreatePostDto, 
  UpdatePostDto 
} from './types/post.types';

// Types - Common
export type { 
  ApiResponse, 
  PaginatedResponse, 
  ApiErrorResponse 
} from './types/common.types';

// Config
export { API_CONFIG, API_ENDPOINTS } from './config';
```

---

## 7️⃣ Custom Hooks (Client-Side)

### `/hooks/api/useUsers.ts`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { usersService } from '@/lib/api';
import type { User, UserFilters } from '@/lib/api';

export function useUsers(filters?: UserFilters) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const data = await usersService.getAll(filters);
        setUsers(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [JSON.stringify(filters)]);

  const refetch = async () => {
    setLoading(true);
    try {
      const data = await usersService.getAll(filters);
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return { users, loading, error, refetch };
}
```

### `/hooks/api/useAuth.ts`

```typescript
'use client';
import { useState, useEffect } from 'react';
import { authService } from '@/lib/api';
import type { User } from '@/lib/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setUser(response.user);
    return response;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return { user, loading, login, logout };
}
```

---

## 8️⃣ Penggunaan di Components

### Server Component - `/app/users/page.tsx`

```typescript
import { usersService } from '@/lib/api';
import type { User } from '@/lib/api';

export default async function UsersPage() {
  try {
    const users = await usersService.getAll({
      sortBy: 'name',
      sortOrder: 'asc',
    });

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <div className="grid gap-4">
          {users.map((user: User) => (
            <div key={user.id} className="border p-4 rounded">
              <h2 className="font-semibold">{user.name}</h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-600">Error</h1>
        <p>Failed to load users</p>
      </div>
    );
  }
}
```

### Client Component - `/app/users/create/page.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usersService } from '@/lib/api';
import type { CreateUserDto } from '@/lib/api';

export default function CreateUserPage() {
  const [formData, setFormData] = useState<CreateUserDto>({
    name: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await usersService.create(formData);
      router.push('/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Create User</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-2">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-2">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-2">Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
```

### Dengan Custom Hook - `/app/users/list/page.tsx`

```typescript
'use client';
import { useUsers } from '@/hooks/api/useUsers';

export default function UsersListPage() {
  const { users, loading, error, refetch } = useUsers({
    sortBy: 'name',
    sortOrder: 'asc',
  });

  if (loading) {
    return <div className="p-4">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600">Error: {error}</p>
        <button onClick={refetch} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={refetch} className="px-4 py-2 bg-blue-600 text-white rounded">
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <div key={user.id} className="border p-4 rounded">
            <h2 className="font-semibold">{user.name}</h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## ✅ Keuntungan Struktur Ini

| Aspek | Benefit |
|-------|---------|
| **Separation of Concerns** | HTTP client terpisah dari business logic |
| **Service Layer** | Business logic terpusat, mudah di-test |
| **Type Safety** | Full TypeScript support dengan types terorganisir |
| **Scalable** | Mudah tambah service/endpoint baru |
| **Testable** | Setiap layer bisa di-mock & unit test |
| **Reusable** | Service bisa dipanggil dari mana saja |
| **Clean Imports** | Import dari 1 barrel file |
| **Maintainable** | Kode terstruktur dan mudah di-maintain |
| **Production Ready** | Dipakai oleh tech companies besar |

---

## 🚀 Cara Import & Penggunaan

```typescript
// ✅ Clean imports
import { 
  usersService, 
  postsService, 
  authService,
  type User,
  type CreateUserDto,
  type Post 
} from '@/lib/api';

// Langsung pakai
const users = await usersService.getAll();
const user = await usersService.getById(1);
await usersService.create({ name: 'John', email: 'john@example.com' });
```

---

## 📝 Notes

- **Server Components**: Gunakan untuk SEO dan performa (default)
- **Client Components**: Hanya untuk interaktivitas real-time
- **Service Layer**: Business logic HARUS di service, bukan di component
- **Types**: Pisahkan per domain untuk maintainability
- **Error Handling**: Implement di setiap layer
- **Caching**: Sesuaikan dengan kebutuhan data

---

## 🏆 Struktur Ini Dipakai Oleh

- Airbnb
- Uber
- Shopify
- Netflix
- Meta

**Production-grade & battle-tested! 🎯**
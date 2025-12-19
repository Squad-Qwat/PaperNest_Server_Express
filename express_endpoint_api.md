# PaperNest Express API Documentation

Dokumentasi ini menjelaskan endpoint REST API pada backend PaperNest Express beserta payload (request body / query / params), aturan otorisasi, dan contoh respons.

**Base URL**: `/api`

---

## Format Respons Standar
Semua respons sukses mengikuti struktur JSON berikut:

```json
{
  "success": true,
  "message": "string",
  "data": { /* objek payload */ },
  "meta": { /* pagination, opsional */ }
}
```

Respons error:

```json
{
  "success": false,
  "error": "Error message",
  "errors": [ /* validation errors, opsional */ ]
}
```

---

## Header Umum
- `Authorization`: `Bearer <token>` (untuk endpoint yang terproteksi)
- `Content-Type`: `application/json`

---

**Otorisasi & Role**
- Sistem menggunakan Firebase Auth / custom JWT. Middleware autentikasi melampirkan objek user pada `req.user`.
- Hierarki per-workspace: `owner` > `editor` > `reviewer` > `viewer`.
- Beberapa endpoint memerlukan peran tertentu (lihat tiap endpoint).

---

# Endpoint
Dokumentasi disusun per resource: Authentication, Users, Workspaces, Invitations, Documents, Versions, Citations, Comments, Reviews, Notifications.

**Catatan**: path mengikuti pola di `src/routes/*` (mis. `src/routes/citations.ts`, `documents.ts`, dll.).

## 1. Authentication

### POST /api/auth/register
- Access: Public
- Body:
```json
{
  "email": "string (email, required)",
  "password": "string (min 6, required)",
  "name": "string (required)",
  "username": "string (required)",
  "role": "Student|Lecturer"
}
```
- Response 201:
```json
{
  "success": true,
  "message": "Registration successful",
  "data": { "user": { /* User */ }, "accessToken": "...", "refreshToken": "..." }
}
```

### POST /api/auth/login
- Access: Public
- Body (Firebase flow):
```json
{ "firebaseToken": "string (required)" }
```
- Response 200: user + tokens.

### POST /api/auth/login/email
- Access: Public
- Body:
```json
{ "email": "string", "password": "string" }
```

### POST /api/auth/refresh
- Body: `{ "refreshToken": "string" }`
- Response 200: new access token

### GET /api/auth/me
- Access: Protected
- Response 200: current user object

### POST /api/auth/password/reset
- Body: `{ "email": "string" }`
- Response 200: info message

---

## 2. Users

### GET /api/users/search?q={query}
- Access: Protected
- Query: `q` = string
- Response 200:
```json
{ "data": { "users": [/*User*/], "count": 10 } }
```

### GET /api/users/:userId
- Access: Protected
- Params: `userId`
- Response 200: `{ data: { user: User } }`

### PUT /api/users/:userId
- Access: Protected (user itu sendiri)
- Body (opsional fields):
```json
{ "name": "string", "username": "string", "photoURL": "string" }
```
- Response 200: updated user

### DELETE /api/users/:userId
- Access: Protected (user itu sendiri)
- Response 200/204

---

## 3. Workspaces

### POST /api/workspaces
- Access: Protected
- Body:
```json
{ "title": "string (required)", "description": "string (optional)" }
```
- Response 201: `{ data: { workspace: Workspace } }`

### GET /api/workspaces
- Access: Protected
- Response 200: list of workspaces user terlibat

### GET /api/workspaces/:workspaceId
- Access: Protected (harus punya akses)
- Response 200: workspace + `userRole`

### PUT /api/workspaces/:workspaceId
- Access: Owner/editor
- Body:
```json
{ "title": "string", "description": "string" }
```

### DELETE /api/workspaces/:workspaceId
- Access: Owner
- Response 204

### Members
- GET `/api/workspaces/:workspaceId/members` — daftar members
- POST `/api/workspaces/:workspaceId/members` — invite member
  - Body: `{ "userId": "string", "role": "editor|viewer|reviewer" }`
- PUT `/api/workspaces/:workspaceId/members/:userWorkspaceId` — update role
  - Body: `{ "role": "owner|editor|viewer|reviewer" }`
- DELETE `/api/workspaces/:workspaceId/members/:userWorkspaceId` — remove member

---

## 4. Invitations

### GET /api/invitations
- Access: Protected
- Response: array of invitations

### PUT /api/invitations/:userWorkspaceId
- Access: Protected (invitee)
- Body: `{ "status": "accepted|declined" }`
- Response 200: updated invitation

---

## 5. Documents

### POST /api/workspaces/:workspaceId/documents
- Access: Editor+
- Body:
```json
{ "title": "string (required)", "content": "string (optional)", "message": "string (optional)" }
```
- Response 201: `{ data: { document: Document, initialVersion: DocumentBody } }`

### GET /api/workspaces/:workspaceId/documents
- Access: Workspace members
- Response 200: list of documents

### GET /api/workspaces/:workspaceId/documents/search?q={query}
- Access: Workspace members

### GET /api/workspaces/:workspaceId/documents/:documentId
- Response: document + currentVersion

### PUT /api/workspaces/:workspaceId/documents/:documentId
- Body: `{ "title": "string" }`

### PUT /api/workspaces/:workspaceId/documents/:documentId/content
- Body:
```json
{ "content": "string (required)", "message": "string (optional)" }
```
- Response 200: document + new version

### DELETE /api/workspaces/:workspaceId/documents/:documentId
- Response 204

### GET /api/documents/my-documents
- Access: Protected — semua dokumen milik user across workspaces

---

## 6. Versions

### GET /api/documents/:documentId/versions
- Access: Document access
- Response: array of versions

### GET /api/documents/:documentId/versions/current
- Response: current version

### GET /api/documents/:documentId/versions/:versionNumber
- Response: specific version

### POST /api/documents/:documentId/versions
- Body:
```json
{ "content": "string (required)", "message": "string (required)" }
```
- Response 201: new version

### POST /api/documents/:documentId/versions/:versionNumber/revert
- Access: Editor+
- Response 200: new version (revert)

---

## 7. Citations

### POST /api/documents/:documentId/citations
- Access: Editor+
- Body:
```json
{
  "type": "string (required)",
  "title": "string (required)",
  "author": "string (required)",
  "publicationInfo": "string (optional)",
  "doi": "string (optional)",
  "accessDate": "string (optional)",
  "publicationDate": "string (optional)",
  "url": "string (optional)",
  "cslJson": { }
}
```
- Response 201: `{ data: { citation: Citation } }`

### GET /api/documents/:documentId/citations
- Query: `type` (opsional — filter by jenis)
- Response 200: `{ data: { citations: [Citation], count: number } }`

### GET /api/documents/:documentId/citations/search?q={query}
- Response 200: search results

### GET /api/documents/:documentId/citations/doi/:doi
- Response 200: citation by DOI

### GET /api/documents/:documentId/citations/:citationId
- Response 200: citation

### PUT /api/documents/:documentId/citations/:citationId
- Body: (all fields opsional, minimal 1)
- Response 200: updated citation

### DELETE /api/documents/:documentId/citations/:citationId
- Response 204

---

## 8. Comments

### POST /api/documents/:documentId/comments
- Access: Protected
- Body:
```json
{
  "content": "string (required)",
  "textSelection": {
    "start": 0,
    "end": 10,
    "text": "selected text"
  } | null,
  "parentCommentId": "string | null"
}
```
- Response 201: comment object

### GET /api/documents/:documentId/comments
- Query: `resolved` (boolean, opsional)
- Response 200: list comments

### GET /api/documents/:documentId/comments/root
- Root comments only (tanpa parent)

### GET /api/documents/:documentId/comments/:commentId/replies
- Response 200: replies

### PUT /api/documents/:documentId/comments/:commentId
- Body: `{ "content": "string (required)" }` (owner only)

### PUT /api/documents/:documentId/comments/:commentId/resolve
- Mark resolved (document access)

### DELETE /api/documents/:documentId/comments/:commentId
- Owner only — cascade hapus replies

### GET /api/comments/my-comments
- All comments by current user

---

## 9. Reviews

### POST /api/documents/:documentId/versions/:documentBodyId/reviews
- Access: Protected
- Body:
```json
{ "lecturerUserId": "string (required)", "message": "string (optional)" }
```
- Response 201: review object
- Side effect: notifikasi ke lecturer

### GET /api/reviews
- Query: `status` (opsional)
- Lecturers melihat assigned, students melihat requested

### PUT /api/reviews/:reviewId
- Lecturer only — update message/status
- Body: `{ "message": "string (required)" }`

### POST /api/reviews/:reviewId/approve
- Lecturer only — approve review (opsional message)

### POST /api/reviews/:reviewId/reject
- Lecturer only — reject with message

### POST /api/reviews/:reviewId/request-revision
- Lecturer only — request revision

### DELETE /api/reviews/:reviewId
- Student can delete pending review

---

## 10. Notifications

### GET /api/notifications
- Query: `type`, `isRead` (opsional)
- Response: list of notifications

### GET /api/notifications/unread
- Response: unread notifications + `unreadCount`

### GET /api/notifications/:notificationId
- Own notification only

### PUT /api/notifications/:notificationId/read
- Mark read

### PUT /api/notifications/read-all
- Mark all read

### DELETE /api/notifications/:notificationId
- Delete single

### DELETE /api/notifications
- Delete all

### DELETE /api/notifications/cleanup?days=30
- Delete read notifications older than `days` (default 30)

---

# Data Models (Ringkasan)

## User
```ts
{
  userId: string;
  name: string;
  email: string;
  username: string;
  role: 'Student' | 'Lecturer';
  photoURL?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Workspace
```ts
{ workspaceId: string; title: string; description?: string; ownerId: string; createdAt: string; }
```

## Document
```ts
{ documentId: string; workspaceId: string; title: string; savedContent?: string; currentVersionId?: string; }
```

## DocumentBody (Version)
```ts
{ documentBodyId: string; documentId: string; userId: string; content: string; message: string; versionNumber: number; isCurrentVersion: boolean; }
```

## Citation
```ts
{ citationId: string; documentId: string; type: string; title: string; author: string; publicationInfo?: string; doi?: string | null; url?: string | null; cslJson?: Record<string, any>; }
```

## Comment
```ts
{ commentId: string; documentId: string; userId: string; content: string; textSelection?: { start: number; end: number; text: string } | null; parentCommentId?: string | null; isResolved: boolean; }
```

## Review
```ts
{ reviewId: string; documentBodyId: string; lecturerUserId: string; studentUserId: string; message: string; status: 'pending'|'approved'|'revision_required'|'rejected'; }
```

## Notification
```ts
{ notificationId: string; userId: string; type: string; title: string; message: string; relatedId?: string; isRead: boolean; }
```

---

# Errors & Status Codes
- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Validation Error
- `500` Internal Server Error

Error payloads biasanya menaruh detail validasi pada `errors` array.

---

# Contoh cURL cepat

Membuat citation:

```bash
curl -X POST "https://api.example.com/api/documents/doc-123/citations" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "article-journal",
    "title": "Test Article",
    "author": "Smith, J.",
    "year": "2023",
    "cslJson": {}
  }'
```

---

# Next steps yang direkomendasikan
- Convert file ini ke OpenAPI/Swagger untuk UI interaktif.
- Tambah contoh respons error untuk tiap endpoint.
- Integrasikan generation dari validator (jika tersedia) untuk sinkronisasi schema.

---

Dokumentasi dibuat berdasarkan struktur rute, validator, dan controller di `src/`.


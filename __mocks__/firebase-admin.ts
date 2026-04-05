// Mock Firestore Document Snapshot
export class MockDocumentSnapshot {
  constructor(
    private _id: string,
    private _data: any,
    private _exists: boolean = true
  ) {}

  get id() {
    return this._id;
  }

  get exists() {
    return this._exists;
  }

  data() {
    return this._data;
  }
}

// Mock Query Snapshot
export class MockQuerySnapshot {
  constructor(private docs: MockDocumentSnapshot[]) {}

  get empty() {
    return this.docs.length === 0;
  }

  get size() {
    return this.docs.length;
  }

  forEach(callback: (doc: MockDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

// Mock Document Reference
export class MockDocumentReference {
  private _data: any = null;

  constructor(private _id: string, private _path: string) {}

  get id() {
    return this._id;
  }

  get path() {
    return this._path;
  }

  async get() {
    return new MockDocumentSnapshot(this._id, this._data, this._data !== null);
  }

  async set(data: any) {
    this._data = data;
    return;
  }

  async update(data: any) {
    this._data = { ...this._data, ...data };
    return;
  }

  async delete() {
    this._data = null;
    return;
  }

  collection = jest.fn().mockReturnValue(new MockCollectionReference(''));
}

// Mock Query
export class MockQuery {
  private filters: any[] = [];
  private orderByFields: any[] = [];
  private limitCount: number | null = null;

  constructor(private collectionRef: MockCollectionReference) {}

  where(field: string, operator: string, value: any) {
    this.filters.push({ field, operator, value });
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.orderByFields.push({ field, direction });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async get() {
    const docs = this.collectionRef.getMockDocs();
    return new MockQuerySnapshot(docs);
  }
}

// Mock Collection Reference
export class MockCollectionReference extends MockQuery {
  private mockDocs: MockDocumentSnapshot[] = [];

  constructor(private _path: string) {
    super(null as any);
    (this as any).collectionRef = this;
  }

  doc(id?: string) {
    const docId = id || `mock-${Date.now()}`;
    return new MockDocumentReference(docId, `${this._path}/${docId}`);
  }

  async add(data: any) {
    const id = `mock-${Date.now()}-${Math.random()}`;
    const doc = new MockDocumentSnapshot(id, { id, ...data });
    this.mockDocs.push(doc);
    return new MockDocumentReference(id, `${this._path}/${id}`);
  }

  // Helper method to set mock documents
  setMockDocs(docs: any[]) {
    this.mockDocs = docs.map(
      (doc, idx) =>
        new MockDocumentSnapshot(
          doc.id || `mock-${idx}`,
          doc,
          true
        )
    );
  }

  getMockDocs() {
    return this.mockDocs;
  }
}

// Mock Firestore
export class MockFirestore {
  private collections = new Map<string, MockCollectionReference>();

  collection(path: string) {
    if (!this.collections.has(path)) {
      this.collections.set(path, new MockCollectionReference(path));
    }
    return this.collections.get(path)!;
  }

  // Helper to get collection for testing
  getCollection(path: string) {
    return this.collections.get(path);
  }
}

// Mock Auth
export class MockAuth {
  createUser = jest.fn().mockResolvedValue({ uid: 'mock-user-id' });
  getUser = jest.fn().mockResolvedValue({
    uid: 'mock-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
  });
  updateUser = jest.fn().mockResolvedValue({});
  deleteUser = jest.fn().mockResolvedValue({});
  verifyIdToken = jest.fn().mockResolvedValue({
    uid: 'mock-user-id',
    email: 'test@example.com',
  });
  createCustomToken = jest.fn().mockResolvedValue('mock-custom-token');
  setCustomUserClaims = jest.fn().mockResolvedValue({});
  generatePasswordResetLink = jest.fn().mockResolvedValue('https://reset-link.com');
}

// Mock Storage
export class MockStorage {
  bucket = jest.fn().mockReturnValue({
    file: jest.fn().mockReturnValue({
      save: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      getSignedUrl: jest.fn().mockResolvedValue(['https://mock-url.com']),
    }),
  });
}

// Main mock firebase-admin export
const mockFirestore = new MockFirestore();
const mockAuth = new MockAuth();
const mockStorage = new MockStorage();

export const firestore = jest.fn(() => mockFirestore);
export const auth = jest.fn(() => mockAuth);
export const storage = jest.fn(() => mockStorage);

export const initializeApp = jest.fn();
export const credential = {
  cert: jest.fn(),
  applicationDefault: jest.fn(),
};

export default {
  initializeApp,
  credential,
  firestore,
  auth,
  storage,
};

// Export mock instances for test access
export const __mockFirestore = mockFirestore;
export const __mockAuth = mockAuth;
export const __mockStorage = mockStorage;

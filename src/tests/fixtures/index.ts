import { User, Workspace, Document, Citation, Comment, Review, Notification, DocumentBody, UserWorkspace } from '../../types';

// User Fixtures
export const mockUser: User = {
  userId: 'user-123',
  name: 'John Doe',
  email: 'john.doe@example.com',
  username: 'johndoe',
  role: 'Student',
  photoURL: 'https://example.com/photo.jpg',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockLecturerUser: User = {
  userId: 'lecturer-123',
  name: 'Dr. Jane Smith',
  email: 'jane.smith@example.com',
  username: 'drjane',
  role: 'Lecturer',
  photoURL: 'https://example.com/lecturer-photo.jpg',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockUsers: User[] = [mockUser, mockLecturerUser];

// Workspace Fixtures
export const mockWorkspace: Workspace = {
  workspaceId: 'workspace-123',
  title: 'Research Project 2024',
  description: 'Collaborative research workspace',
  ownerId: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockWorkspaces: Workspace[] = [
  mockWorkspace,
  {
    workspaceId: 'workspace-456',
    title: 'Thesis Work',
    description: 'PhD thesis workspace',
    ownerId: 'lecturer-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// UserWorkspace Fixtures
export const mockUserWorkspace: UserWorkspace = {
  userWorkspaceId: 'uw-123',
  userId: 'user-123',
  workspaceId: 'workspace-123',
  role: 'owner',
  invitationStatus: 'accepted',
  invitedBy: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Document Fixtures
export const mockDocument: Document = {
  documentId: 'doc-123',
  workspaceId: 'workspace-123',
  title: 'Research Paper Draft',
  savedContent: 'This is the content of the research paper.',
  currentVersionId: 'version-1',
  createdBy: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockDocuments: Document[] = [
  mockDocument,
  {
    documentId: 'doc-456',
    workspaceId: 'workspace-123',
    title: 'Literature Review',
    savedContent: 'Literature review content here.',
    currentVersionId: 'version-2',
    createdBy: 'user-123',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
];

// DocumentBody (Version) Fixtures
export const mockDocumentBody: DocumentBody = {
  documentBodyId: 'version-1',
  documentId: 'doc-123',
  userId: 'user-123',
  content: 'This is the content of the research paper.',
  message: 'Initial version',
  versionNumber: 1,
  isCurrentVersion: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockDocumentBodies: DocumentBody[] = [
  mockDocumentBody,
  {
    documentBodyId: 'version-2',
    documentId: 'doc-123',
    userId: 'user-123',
    content: 'Updated content with revisions.',
    message: 'Updated version',
    versionNumber: 2,
    isCurrentVersion: false,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
];

// Citation Fixtures
export const mockCitation: Citation = {
  citationId: 'citation-123',
  documentId: 'doc-123',
  type: 'article',
  title: 'Machine Learning in Healthcare',
  author: 'Smith, J.',
  publicationInfo: 'Journal of AI, 2023',
  doi: '10.1234/example.doi',
  accessDate: '2024-01-01',
  publicationDate: '2023',
  url: null,
  cslJson: { type: 'article', title: 'Machine Learning in Healthcare' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockCitations: Citation[] = [
  mockCitation,
  {
    citationId: 'citation-456',
    documentId: 'doc-123',
    type: 'book',
    title: 'Introduction to AI',
    author: 'Doe, J.',
    publicationInfo: 'Tech Publishers, 2022',
    doi: null,
    accessDate: '2024-01-01',
    publicationDate: '2022',
    url: null,
    cslJson: { type: 'book', title: 'Introduction to AI' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// Comment Fixtures
export const mockComment: Comment = {
  commentId: 'comment-123',
  documentId: 'doc-123',
  userId: 'user-123',
  content: 'This section needs more detail.',
  textSelection: {
    start: 100,
    end: 150,
    text: 'Selected text from document'
  },
  parentCommentId: null,
  isResolved: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockReplyComment: Comment = {
  commentId: 'comment-456',
  documentId: 'doc-123',
  userId: 'lecturer-123',
  content: 'I agree, please expand this part.',
  textSelection: null,
  parentCommentId: 'comment-123',
  isResolved: false,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
};

export const mockComments: Comment[] = [mockComment, mockReplyComment];

// Review Fixtures
export const mockReview: Review = {
  reviewId: 'review-123',
  documentBodyId: 'version-1',
  documentId: 'doc-123',
  lecturerUserId: 'lecturer-123',
  studentUserId: 'user-123',
  status: 'pending',
  message: 'Please review my draft.',
  requestedAt: new Date('2024-01-01'),
  reviewedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockApprovedReview: Review = {
  reviewId: 'review-456',
  documentBodyId: 'version-1',
  documentId: 'doc-123',
  lecturerUserId: 'lecturer-123',
  studentUserId: 'user-123',
  status: 'approved',
  message: 'Looks good!',
  requestedAt: new Date('2024-01-01'),
  reviewedAt: new Date('2024-01-02'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
};

export const mockReviews: Review[] = [mockReview, mockApprovedReview];

// Notification Fixtures
export const mockNotification: Notification = {
  notificationId: 'notif-123',
  userId: 'user-123',
  type: 'comment',
  title: 'New Comment',
  message: 'Jane Smith commented on your document',
  relatedId: 'comment-123',
  isRead: false,
  createdAt: new Date('2024-01-01'),
};

export const mockNotifications: Notification[] = [
  mockNotification,
  {
    notificationId: 'notif-456',
    userId: 'user-123',
    type: 'review_completed',
    title: 'Review Approved',
    message: 'Your document has been approved',
    relatedId: 'review-456',
    isRead: true,
    createdAt: new Date('2024-01-02'),
  },
];

// Request body fixtures for validation
export const mockRegisterBody = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  username: 'johndoe',
  password: 'SecurePass123!',
  role: 'Student',
};

export const mockLoginBody = {
  email: 'john.doe@example.com',
  password: 'SecurePass123!',
};

export const mockCreateDocumentBody = {
  title: 'New Research Paper',
  content: 'Initial content',
};

export const mockCreateCitationBody = {
  type: 'article',
  title: 'Machine Learning in Healthcare',
  author: 'Smith, J.',
  publicationInfo: 'Journal of AI, 2023',
  publicationDate: '2023',
};

export const mockCreateCommentBody = {
  content: 'This needs revision',
  textSelection: {
    start: 100,
    end: 150,
    text: 'Selected text'
  },
};

export const mockCreateWorkspaceBody = {
  title: 'New Workspace',
  description: 'A collaborative workspace',
};

// JWT Token fixtures
export const mockJWTToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.mock';
export const mockFirebaseToken = 'mock-firebase-token-xyz123';

// Mock decoded token
export const mockDecodedToken = {
  userId: 'user-123',
  email: 'john.doe@example.com',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

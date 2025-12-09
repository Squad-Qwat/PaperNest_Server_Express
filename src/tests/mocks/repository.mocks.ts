import { User, Workspace, Document, Citation, Comment, Review, Notification, DocumentBody, UserWorkspace } from '../../types';

// Mock User Repository
export const mockUserRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchByName: jest.fn(),
  searchByEmail: jest.fn(),
};

// Mock Workspace Repository
export const mockWorkspaceRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByOwnerId: jest.fn(),
};

// Mock UserWorkspace Repository
export const mockUserWorkspaceRepository = {
  create: jest.fn(),
  findByUserId: jest.fn(),
  findByWorkspaceId: jest.fn(),
  findByUserAndWorkspace: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateRole: jest.fn(),
  acceptInvitation: jest.fn(),
  declineInvitation: jest.fn(),
  getPendingInvitations: jest.fn(),
};

// Mock Document Repository
export const mockDocumentRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByWorkspaceId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchByTitle: jest.fn(),
  findByUserId: jest.fn(),
};

// Mock DocumentBody Repository
export const mockDocumentBodyRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByDocumentId: jest.fn(),
  getCurrentVersion: jest.fn(),
  getVersionByNumber: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  setCurrentVersion: jest.fn(),
};

// Mock Citation Repository
export const mockCitationRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByDocumentId: jest.fn(),
  findByType: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchByTitle: jest.fn(),
  searchByAuthor: jest.fn(),
  findByDOI: jest.fn(),
};

// Mock Comment Repository
export const mockCommentRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByDocumentId: jest.fn(),
  findByUserId: jest.fn(),
  findReplies: jest.fn(),
  findTopLevelComments: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  markAsResolved: jest.fn(),
  markAsUnresolved: jest.fn(),
  findResolvedComments: jest.fn(),
};

// Mock Review Repository
export const mockReviewRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByDocumentId: jest.fn(),
  findByLecturerId: jest.fn(),
  findByStudentId: jest.fn(),
  findPendingByLecturer: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  requestRevision: jest.fn(),
};

// Mock Notification Repository
export const mockNotificationRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findUnreadByUserId: jest.fn(),
  findByType: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  delete: jest.fn(),
  deleteAll: jest.fn(),
  deleteOldReadNotifications: jest.fn(),
};

// Helper to reset all mocks
export const resetAllRepositoryMocks = () => {
  Object.values(mockUserRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockWorkspaceRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockUserWorkspaceRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockDocumentRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockDocumentBodyRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockCitationRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockCommentRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockReviewRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
  Object.values(mockNotificationRepository).forEach((fn) => {
    if (jest.isMockFunction(fn)) fn.mockReset();
  });
};

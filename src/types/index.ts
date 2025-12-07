// Firebase Firestore Types
export interface User {
  userId: string;
  name: string;
  email: string;
  username: string;
  role: 'Student' | 'Lecturer';
  photoURL: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  workspaceId: string;
  title: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWorkspace {
  userWorkspaceId: string;
  userId: string;
  workspaceId: string;
  role: 'owner' | 'editor' | 'viewer' | 'reviewer';
  invitationStatus: 'pending' | 'accepted' | 'declined';
  invitedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  documentId: string;
  workspaceId: string;
  title: string;
  savedContent: string;
  currentVersionId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentBody {
  documentBodyId: string;
  documentId: string;
  userId: string;
  content: string;
  message: string;
  isCurrentVersion: boolean;
  versionNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Citation {
  citationId: string;
  documentId: string;
  type: 'article' | 'book' | 'website' | string;
  title: string;
  author: string;
  publicationInfo: string;
  doi: string | null;
  accessDate: string;
  publicationDate: string;
  url: string | null;
  cslJson: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  reviewId: string;
  documentBodyId: string;
  documentId: string;
  lecturerUserId: string;
  studentUserId: string;
  message: string;
  status: 'pending' | 'approved' | 'revision_required' | 'rejected';
  requestedAt: Date;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  commentId: string;
  documentId: string;
  userId: string;
  content: string;
  textSelection: {
    start: number;
    end: number;
    text: string;
  } | null;
  parentCommentId: string | null;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  notificationId: string;
  userId: string;
  type: 'invitation' | 'review_request' | 'review_completed' | 'comment' | string;
  title: string;
  message: string;
  relatedId: string;
  isRead: boolean;
  createdAt: Date;
}

export interface Presence {
  userId: string;
  name: string;
  cursorPosition: number;
  selection: {
    start: number;
    end: number;
  } | null;
  lastActive: Date;
}

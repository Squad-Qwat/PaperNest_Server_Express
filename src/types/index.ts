// Firebase Firestore Types
export interface User {
  userId: string;
  name: string;
  email: string;
  username: string;
  role: 'Student' | 'Lecturer';
  photoURL: string | null;
  linkedUids?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  workspaceId: string;
  title: string;
  description: string;
  icon?: string;
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
  description?: string;
  savedContent: any;
  currentVersionId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentBody {
  documentBodyId: string;
  documentId: string;
  userId: string;
  content: any;
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

export interface LiveblocksUser {
  id: string;
  connectionId: string;
  info?: {
    name?: string;
    email?: string;
    [key: string]: any;
  };
}

export interface LiveblocksWebhookEvent {
  type: 'userLeft' | 'userEntered' | 'storageUpdated' | 'notification' | string;
  data?: {
    projectId?: string;
    roomId?: string;
    connectionId?: number;
    userId?: string | null;
    userInfo?: Record<string, unknown> | null;
    enteredAt?: string;
    leftAt?: string;
    numActiveUsers?: number;
  };
}

export interface UserLeftEvent extends LiveblocksWebhookEvent {
  type: 'userLeft';
  data: {
    projectId: string;
    roomId: string;
    connectionId: number;
    userId: string | null;
    userInfo: Record<string, unknown> | null;
    leftAt: string;
    numActiveUsers: number;
  };
}

export interface UserEnteredEvent extends LiveblocksWebhookEvent {
  type: 'userEntered';
  data: {
    projectId: string;
    roomId: string;
    connectionId: number;
    userId: string | null;
    userInfo: Record<string, unknown> | null;
    enteredAt: string;
    numActiveUsers: number;
  };
}

export interface RoomCleanupResult {
  action: 'keep_room' | 'deleted' | 'already_deleted' | 'room_not_found';
  roomId?: string;
  activeUsers?: number;
}

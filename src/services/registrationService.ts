import { db } from '../config/firebase';
import { COLLECTIONS, WORKSPACE_ROLES, INVITATION_STATUS } from '../config/constants';
import logger from '../utils/logger';
import { User, Workspace } from '../types';

export interface PendingRegistration {
  uid: string;
  email: string;
  name: string;
  username: string;
  role: 'Student' | 'Lecturer';
  workspaceData?: {
    title: string;
    description?: string;
    icon?: string;
    mode: 'create' | 'join';
    invitationCode?: string;
  };
  createdAt: Date;
}

class RegistrationService {
  private collection = db.collection('pending_registrations');

  /**
   * Store pending registration data
   */
  async savePending(uid: string, data: Omit<PendingRegistration, 'uid' | 'createdAt'>) {
    await this.collection.doc(uid).set({
      uid,
      ...data,
      createdAt: new Date(),
    });
  }

  /**
   * Get pending registration data
   */
  async getPending(uid: string): Promise<PendingRegistration | null> {
    const doc = await this.collection.doc(uid).get();
    return doc.exists ? (doc.data() as PendingRegistration) : null;
  }

  /**
   * Finalize registration using an atomic transaction
   */
  async finalize(uid: string): Promise<User> {
    return await db.runTransaction(async (transaction) => {
      const pendingRef = this.collection.doc(uid);
      const pendingDoc = await transaction.get(pendingRef);

      if (!pendingDoc.exists) {
        throw new Error('No pending registration found for this user');
      }

      const pending = pendingDoc.data() as PendingRegistration;
      const now = new Date();

      // 1. Prepare User Data
      const userRef = db.collection(COLLECTIONS.USERS).doc(uid);
      const userData: User = {
        userId: uid,
        email: pending.email,
        name: pending.name,
        username: pending.username,
        role: pending.role,
        photoURL: null,
        createdAt: now,
        updatedAt: now,
      };

      // 2. Transactional Writes
      transaction.set(userRef, userData);

      // Handle workspace
      if (pending.workspaceData) {
        if (pending.workspaceData.mode === 'create') {
          const workspaceRef = db.collection(COLLECTIONS.WORKSPACES).doc();
          const workspaceData: Workspace = {
            workspaceId: workspaceRef.id,
            title: pending.workspaceData.title,
            description: pending.workspaceData.description || '',
            ownerId: uid,
            icon: pending.workspaceData.icon || '📚',
            createdAt: now,
            updatedAt: now,
          };

          transaction.set(workspaceRef, workspaceData);

          const mappingRef = db.collection(COLLECTIONS.USER_WORKSPACES).doc();
          transaction.set(mappingRef, {
            userWorkspaceId: mappingRef.id,
            userId: uid,
            workspaceId: workspaceRef.id,
            role: WORKSPACE_ROLES.OWNER,
            invitationStatus: INVITATION_STATUS.ACCEPTED,
            invitedBy: uid,
            createdAt: now,
            updatedAt: now,
          });
        } else if (pending.workspaceData.mode === 'join' && pending.workspaceData.invitationCode) {
          const workspaceId = pending.workspaceData.invitationCode;
          const mappingRef = db.collection(COLLECTIONS.USER_WORKSPACES).doc();
          transaction.set(mappingRef, {
            userWorkspaceId: mappingRef.id,
            userId: uid,
            workspaceId: workspaceId,
            role: WORKSPACE_ROLES.VIEWER,
            invitationStatus: INVITATION_STATUS.ACCEPTED,
            invitedBy: uid,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 3. Cleanup pending data
      transaction.delete(pendingRef);

      return userData;
    });
  }
}

export default new RegistrationService();

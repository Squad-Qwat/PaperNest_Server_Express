import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { User } from '../types';

export class UserRepository {
  private collection = db.collection(COLLECTIONS.USERS);

  /**
   * Create a new user
   */
  async create(userId: string, userData: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const user: User = {
      userId,
      ...userData,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection.doc(userId).set(user);
    return user;
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<User | null> {
    const doc = await this.collection.doc(userId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as User;
  }

  /**
   * Find multiple users by their IDs using batch get
   */
  async findByIds(userIds: string[]): Promise<User[]> {
    if (!userIds || userIds.length === 0) return [];
    
    // Remove duplicates to minimize reads
    const uniqueIds = [...new Set(userIds)];
    
    const refs = uniqueIds.map(id => this.collection.doc(id));
    const snapshots = await db.getAll(...refs);
    
    return snapshots
      .filter(snap => snap.exists)
      .map(snap => snap.data() as User);
  }

  /**
   * Find user by linked UID
   */
  async findByLinkedUid(uid: string): Promise<User | null> {
    const snapshot = await this.collection
      .where('linkedUids', 'array-contains', uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as User;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const snapshot = await this.collection
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as User;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const snapshot = await this.collection
      .where('username', '==', username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as User;
  }

  /**
   * Search users by name or email
   */
  async search(query: string, limit: number = 10): Promise<User[]> {
    const searchTerm = query.toLowerCase();

    // Search by name
    const nameSnapshot = await this.collection
      .where('name', '>=', searchTerm)
      .where('name', '<=', searchTerm + '\uf8ff')
      .limit(limit)
      .get();

    // Search by email
    const emailSnapshot = await this.collection
      .where('email', '>=', searchTerm)
      .where('email', '<=', searchTerm + '\uf8ff')
      .limit(limit)
      .get();

    const users = new Map<string, User>();

    nameSnapshot.docs.forEach(doc => {
      users.set(doc.id, doc.data() as User);
    });

    emailSnapshot.docs.forEach(doc => {
      users.set(doc.id, doc.data() as User);
    });

    return Array.from(users.values()).slice(0, limit);
  }

  /**
   * Update user profile
   */
  async update(userId: string, updates: Partial<Omit<User, 'userId' | 'createdAt'>>): Promise<User> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    await this.collection.doc(userId).update(updateData);

    const updated = await this.findById(userId);
    if (!updated) {
      throw new Error('User not found after update');
    }

    return updated;
  }

  /**
   * Delete user
   */
  async delete(userId: string): Promise<void> {
    await this.collection.doc(userId).delete();
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return user !== null;
  }
}

export default new UserRepository();

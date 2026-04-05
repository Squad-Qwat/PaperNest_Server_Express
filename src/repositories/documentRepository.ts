import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Document } from '../types';

export class DocumentRepository {
  private collection = db.collection(COLLECTIONS.DOCUMENTS);

  /**
   * Create a new document
   */
  async create(documentData: Omit<Document, 'documentId' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const now = new Date();
    const docRef = this.collection.doc();
    
    const document: Document = {
      documentId: docRef.id,
      ...documentData,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(document);
    return document;
  }

  /**
   * Find document by ID
   */
  async findById(documentId: string): Promise<Document | null> {
    const doc = await this.collection.doc(documentId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as Document;
  }

  /**
   * Find all documents in a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<Document[]> {
    const snapshot = await this.collection
      .where('workspaceId', '==', workspaceId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as Document);
  }

  /**
   * Find documents created by user
   */
  async findByCreator(userId: string): Promise<Document[]> {
    const snapshot = await this.collection
      .where('createdBy', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as Document);
  }

  /**
   * Update document
   */
  async update(documentId: string, updates: Partial<Omit<Document, 'documentId' | 'createdAt'>>): Promise<Document> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    await this.collection.doc(documentId).update(updateData);
    
    const updated = await this.findById(documentId);
    if (!updated) {
      throw new Error('Document not found after update');
    }
    
    return updated;
  }

  /**
   * Update document content
   */
  async updateContent(documentId: string, savedContent: any, currentVersionId: string): Promise<Document> {
    return this.update(documentId, { savedContent, currentVersionId });
  }

  /**
   * Delete document
   */
  async delete(documentId: string): Promise<void> {
    await this.collection.doc(documentId).delete();
  }

  /**
   * Check if document exists
   */
  async exists(documentId: string): Promise<boolean> {
    const doc = await this.collection.doc(documentId).get();
    return doc.exists;
  }

  /**
   * Count documents in workspace
   */
  async countByWorkspace(workspaceId: string): Promise<number> {
    const snapshot = await this.collection
      .where('workspaceId', '==', workspaceId)
      .count()
      .get();
    
    return snapshot.data().count;
  }

  /**
   * Search documents by title
   */
  async searchByTitle(workspaceId: string, searchTerm: string, limit: number = 10): Promise<Document[]> {
    const lowerSearch = searchTerm.toLowerCase();
    
    const snapshot = await this.collection
      .where('workspaceId', '==', workspaceId)
      .where('title', '>=', lowerSearch)
      .where('title', '<=', lowerSearch + '\uf8ff')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => doc.data() as Document);
  }
}

export default new DocumentRepository();

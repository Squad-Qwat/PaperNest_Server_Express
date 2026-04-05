import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { DocumentBody } from '../types';

export class DocumentBodyRepository {
  private collection = db.collection(COLLECTIONS.DOCUMENT_BODIES);

  /**
   * Create a new document version
   */
  async create(data: Omit<DocumentBody, 'documentBodyId' | 'createdAt' | 'updatedAt'>): Promise<DocumentBody> {
    const now = new Date();
    const docRef = this.collection.doc();
    
    const documentBody: DocumentBody = {
      documentBodyId: docRef.id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(documentBody);
    return documentBody;
  }

  /**
   * Find document body by ID
   */
  async findById(documentBodyId: string): Promise<DocumentBody | null> {
    const doc = await this.collection.doc(documentBodyId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as DocumentBody;
  }

  /**
   * Find all versions of a document
   */
  async findByDocument(documentId: string): Promise<DocumentBody[]> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .get();
    
    const versions = snapshot.docs.map(doc => doc.data() as DocumentBody);
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  /**
   * Find current version of a document
   */
  async findCurrentVersion(documentId: string): Promise<DocumentBody | null> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .where('isCurrentVersion', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as DocumentBody;
  }

  /**
   * Find version by number
   */
  async findByVersionNumber(documentId: string, versionNumber: number): Promise<DocumentBody | null> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .where('versionNumber', '==', versionNumber)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as DocumentBody;
  }

  /**
   * Get latest version number
   */
  async getLatestVersionNumber(documentId: string): Promise<number> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .get();
    
    if (snapshot.empty) {
      return 0;
    }
    
    let max = 0;
    snapshot.docs.forEach(doc => {
      const v = doc.data().versionNumber;
      if (typeof v === 'number' && v > max) max = v;
    });
    
    return max;
  }

  /**
   * Update document body (should rarely be used as versions are immutable)
   */
  async update(documentBodyId: string, updates: Partial<Omit<DocumentBody, 'documentBodyId' | 'createdAt'>>): Promise<DocumentBody> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    await this.collection.doc(documentBodyId).update(updateData);
    
    const updated = await this.findById(documentBodyId);
    if (!updated) {
      throw new Error('Document body not found after update');
    }
    
    return updated;
  }

  /**
   * Set all versions as not current
   */
  async setAllVersionsNotCurrent(documentId: string): Promise<void> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .where('isCurrentVersion', '==', true)
      .get();
    
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isCurrentVersion: false, updatedAt: new Date() });
    });
    
    await batch.commit();
  }

  /**
   * Set specific version as current
   */
  async setVersionAsCurrent(documentBodyId: string): Promise<void> {
    const documentBody = await this.findById(documentBodyId);
    
    if (!documentBody) {
      throw new Error('Document body not found');
    }
    
    // Set all versions as not current
    await this.setAllVersionsNotCurrent(documentBody.documentId);
    
    // Set this version as current
    await this.update(documentBodyId, { isCurrentVersion: true });
  }

  /**
   * Delete document body
   */
  async delete(documentBodyId: string): Promise<void> {
    await this.collection.doc(documentBodyId).delete();
  }

  /**
   * Delete all versions of a document
   */
  async deleteAllByDocument(documentId: string): Promise<void> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .get();
    
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }

  /**
   * Count versions of a document
   */
  async countByDocument(documentId: string): Promise<number> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .count()
      .get();
    
    return snapshot.data().count;
  }
}

export default new DocumentBodyRepository();

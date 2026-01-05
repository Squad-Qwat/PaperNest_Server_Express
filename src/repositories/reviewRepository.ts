import { db } from '../config/firebase';
import { COLLECTIONS, REVIEW_STATUS } from '../config/constants';
import { Review } from '../types';

export class ReviewRepository {
  private collection = db.collection(COLLECTIONS.REVIEWS);

  /**
   * Create a new review
   */
  async create(reviewData: Omit<Review, 'reviewId' | 'createdAt' | 'updatedAt'>): Promise<Review> {
    const now = new Date();
    const docRef = this.collection.doc();
    
    const review: Review = {
      reviewId: docRef.id,
      ...reviewData,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(review);
    return review;
  }

  /**
   * Find review by ID
   */
  async findById(reviewId: string): Promise<Review | null> {
    const doc = await this.collection.doc(reviewId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as Review;
  }

  /**
   * Find all reviews for a document
   */
  async findByDocument(documentId: string): Promise<Review[]> {
    const snapshot = await this.collection
      .where('documentId', '==', documentId)
      .get();
    
    const reviews = snapshot.docs.map(doc => doc.data() as Review);
    
    // Sort in memory to avoid composite index requirement
    return reviews.sort((a, b) => {
      const getMillis = (d: any) => d.toMillis ? d.toMillis() : new Date(d).getTime();
      return getMillis(b.requestedAt) - getMillis(a.requestedAt);
    });
  }

  /**
   * Find reviews by lecturer
   */
  async findByLecturer(lecturerUserId: string, status?: string): Promise<Review[]> {
    let query = this.collection.where('lecturerUserId', '==', lecturerUserId);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.get();
    
    const reviews = snapshot.docs.map(doc => doc.data() as Review);
    
    // Sort in memory
    return reviews.sort((a, b) => {
      const getMillis = (d: any) => d.toMillis ? d.toMillis() : new Date(d).getTime();
      return getMillis(b.requestedAt) - getMillis(a.requestedAt);
    });
  }

  /**
   * Find reviews by student
   */
  async findByStudent(studentUserId: string, status?: string): Promise<Review[]> {
    let query = this.collection.where('studentUserId', '==', studentUserId);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.get();
    
    const reviews = snapshot.docs.map(doc => doc.data() as Review);
    
    // Sort in memory
    return reviews.sort((a, b) => {
      const getMillis = (d: any) => d.toMillis ? d.toMillis() : new Date(d).getTime();
      return getMillis(b.requestedAt) - getMillis(a.requestedAt);
    });
  }

  /**
   * Find pending reviews for lecturer
   */
  async findPendingByLecturer(lecturerUserId: string): Promise<Review[]> {
    return this.findByLecturer(lecturerUserId, REVIEW_STATUS.PENDING);
  }

  /**
   * Find review for specific document body
   */
  async findByDocumentBody(documentBodyId: string): Promise<Review | null> {
    const snapshot = await this.collection
      .where('documentBodyId', '==', documentBodyId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data() as Review;
  }

  /**
   * Update review
   */
  async update(reviewId: string, updates: Partial<Omit<Review, 'reviewId' | 'createdAt'>>): Promise<Review> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    await this.collection.doc(reviewId).update(updateData);
    
    const updated = await this.findById(reviewId);
    if (!updated) {
      throw new Error('Review not found after update');
    }
    
    return updated;
  }

  /**
   * Update review status
   */
  async updateStatus(reviewId: string, status: string, message?: string): Promise<Review> {
    const updateData: any = {
      status,
      reviewedAt: new Date(),
    };
    
    if (message) {
      updateData.message = message;
    }
    
    return this.update(reviewId, updateData);
  }

  /**
   * Delete review
   */
  async delete(reviewId: string): Promise<void> {
    await this.collection.doc(reviewId).delete();
  }

  /**
   * Delete all reviews for a document
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
   * Count reviews by status
   */
  async countByStatus(status: string): Promise<number> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .count()
      .get();
    
    return snapshot.data().count;
  }

  /**
   * Check if review exists
   */
  async exists(reviewId: string): Promise<boolean> {
    const doc = await this.collection.doc(reviewId).get();
    return doc.exists;
  }
}

export default new ReviewRepository();

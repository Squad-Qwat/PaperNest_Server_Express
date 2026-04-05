import * as admin from 'firebase-admin';

const firestore = admin.firestore();
import { DocumentPermissionRecord, DocumentPermission } from '../types/Permission.types';
import logger from '../utils/logger';

class DocumentPermissionRepository {
	private readonly COLLECTION_NAME = 'documentPermissions';

	/**
	 * Get user's permission for a specific document
	 * Returns: directly granted permission or null
	 */
	async getUserDocumentPermission(
		userId: string,
		documentId: string
	): Promise<DocumentPermission | null> {
		try {
			const snapshot = await firestore
				.collection(this.COLLECTION_NAME)
				.where('userId', '==', userId)
				.where('documentId', '==', documentId)
				.get();

			if (snapshot.empty) {
				return null;
			}

			const record = snapshot.docs[0].data() as DocumentPermissionRecord;
			return record.permission;
		} catch (error) {
			logger.error('Error getting document permission:', error);
			throw error;
		}
	}

	/**
	 * Grant permission to user for a document
	 */
	async grantPermission(
		userId: string,
		documentId: string,
		permission: DocumentPermission,
		grantedBy: string
	): Promise<DocumentPermissionRecord> {
		try {
			const permissionRecord: Omit<DocumentPermissionRecord, 'documentPermissionId'> = {
				userId,
				documentId,
				permission,
				grantedBy,
				grantedAt: admin.firestore.FieldValue.serverTimestamp(),
				updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			};

			const docSnapshot = await firestore.collection(this.COLLECTION_NAME).add(permissionRecord);

			logger.info('Permission granted:', {
				permissionId: docSnapshot.id,
				userId,
				documentId,
				permission,
				grantedBy,
			});

			return {
				documentPermissionId: docSnapshot.id,
				...permissionRecord,
			} as DocumentPermissionRecord;
		} catch (error) {
			logger.error('Error granting permission:', error);
			throw error;
		}
	}

	/**
	 * Update user's permission for a document
	 */
	async updatePermission(
		userId: string,
		documentId: string,
		newPermission: DocumentPermission,
		updatedBy: string
	): Promise<void> {
		try {
			const snapshot = await firestore
				.collection(this.COLLECTION_NAME)
				.where('userId', '==', userId)
				.where('documentId', '==', documentId)
				.get();

			if (snapshot.empty) {
				throw new Error('Permission record not found');
			}

			const permissionDoc = snapshot.docs[0];
			await permissionDoc.ref.update({
				permission: newPermission,
				updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			});

			logger.info('Permission updated:', {
				userId,
				documentId,
				newPermission,
				updatedBy,
			});
		} catch (error) {
			logger.error('Error updating permission:', error);
			throw error;
		}
	}

	/**
	 * Revoke user's permission for a document
	 */
	async revokePermission(userId: string, documentId: string): Promise<void> {
		try {
			const snapshot = await firestore
				.collection(this.COLLECTION_NAME)
				.where('userId', '==', userId)
				.where('documentId', '==', documentId)
				.get();

			if (snapshot.empty) {
				throw new Error('Permission record not found');
			}

			await snapshot.docs[0].ref.delete();

			logger.info('Permission revoked:', { userId, documentId });
		} catch (error) {
			logger.error('Error revoking permission:', error);
			throw error;
		}
	}

	/**
	 * Get all permissions for a document
	 */
	async getDocumentPermissions(documentId: string): Promise<DocumentPermissionRecord[]> {
		try {
			const snapshot = await firestore
				.collection(this.COLLECTION_NAME)
				.where('documentId', '==', documentId)
				.get();

			return snapshot.docs.map(
				(doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>) =>
					({
						documentPermissionId: doc.id,
						...doc.data(),
					} as DocumentPermissionRecord)
			);
		} catch (error) {
			logger.error('Error getting document permissions:', error);
			throw error;
		}
	}

	/**
	 * Check if user has at least minimum permission level for document
	 */
	async hasPermissionLevel(
		userId: string,
		documentId: string,
		minPermission: DocumentPermission
	): Promise<boolean> {
		try {
			const permission = await this.getUserDocumentPermission(userId, documentId);
			if (!permission) {
				return false;
			}

			const HIERARCHY: Record<DocumentPermission, number> = { viewer: 1, editor: 2, admin: 3 };
			return HIERARCHY[permission] >= HIERARCHY[minPermission];
		} catch (error) {
			logger.error('Error checking permission level:', error);
			throw error;
		}
	}
}

export default new DocumentPermissionRepository();

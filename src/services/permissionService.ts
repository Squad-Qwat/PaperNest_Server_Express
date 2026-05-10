import documentPermissionRepository from "../repositories/documentPermissionRepository";
import userWorkspaceRepository from "../repositories/userWorkspaceRepository";
import type { DocumentPermission } from "../types/Permission.types";
import logger from "../utils/logger";

class PermissionService {
	/**
	 * Map workspace role to document permission level
	 */
	private mapWorkspaceRoleToDocumentPermission(
		workspaceRole: string,
	): DocumentPermission {
		switch (workspaceRole) {
			case "owner":
				return "admin";
			case "editor":
				return "editor";
			case "reviewer":
				return "viewer";
			case "viewer":
				return "viewer";
			default:
				return "viewer";
		}
	}

	/**
	 * Initialize default document permissions from workspace membership
	 * Called when document is created
	 * Document creator gets 'admin' permission, inherits workspace membership for others
	 */
	async initializeDefaultDocumentPermissions(
		documentId: string,
		workspaceId: string,
		createdBy: string,
	): Promise<void> {
		try {
			logger.info("Initializing document permissions", {
				documentId,
				workspaceId,
				createdBy,
			});

			// Grant 'admin' permission to document creator
			await documentPermissionRepository.grantPermission(
				createdBy,
				documentId,
				"admin",
				createdBy,
			);

			logger.info("Document creator granted admin permission", {
				documentId,
				userId: createdBy,
			});
		} catch (error) {
			logger.error("Error initializing document permissions:", error);
			throw error;
		}
	}

	/**
	 * Get effective permission for user on document
	 * REQUIRES workspaceId to break circular dependency with documentRepository
	 */
	async getEffectivePermission(
		userId: string,
		documentId: string,
		workspaceId: string,
	): Promise<{
		permission: DocumentPermission;
		source: "direct" | "workspace-inherited";
	} | null> {
		try {
			// Check for direct document permission
			const directPermission =
				await documentPermissionRepository.getUserDocumentPermission(
					userId,
					documentId,
				);

			if (directPermission) {
				return { permission: directPermission, source: "direct" };
			}

			// No direct permission - check workspace membership using provided workspaceId
			const workspaceRole = await userWorkspaceRepository.getUserRole(
				userId,
				workspaceId,
			);
			
			if (!workspaceRole) {
				return null;
			}

			const mappedPermission =
				this.mapWorkspaceRoleToDocumentPermission(workspaceRole);
			return {
				permission: mappedPermission,
				source: "workspace-inherited",
			};
		} catch (error) {
			logger.error("Error getting effective permission:", error);
			throw error;
		}
	}

	/**
	 * Check if user has minimum required permission on document
	 */
	async hasMinimumPermission(
		userId: string,
		documentId: string,
		workspaceId: string,
		minPermission: DocumentPermission,
	): Promise<boolean> {
		try {
			const effective = await this.getEffectivePermission(
				userId,
				documentId,
				workspaceId,
			);
			
			if (!effective) {
				return false;
			}

			const HIERARCHY: Record<DocumentPermission, number> = { 
				viewer: 1, 
				editor: 2, 
				admin: 3 
			};
			
			return HIERARCHY[effective.permission] >= HIERARCHY[minPermission];
		} catch (error) {
			logger.error("Error checking minimum permission:", error);
			return false;
		}
	}
}

export default new PermissionService();

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));

import registrationService from "../../services/registrationService";
import { db } from "../../config/firebase";
import { mockUser } from "../../tests/fixtures";

describe("RegistrationService", () => {
	const mockUid = "user-123";
	const mockRegistrationData = {
		email: "john@example.com",
		name: "John Doe",
		username: "johndoe",
		role: "Student" as const,
		workspaceData: {
			title: "My Workspace",
			mode: "create" as const,
		},
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("savePending", () => {
		it("should save pending registration data", async () => {
			const collection = db.collection("pending_registrations");
			const docSpy = jest.spyOn(collection, "doc");

			await registrationService.savePending(mockUid, mockRegistrationData);

			expect(docSpy).toHaveBeenCalledWith(mockUid);
		});
	});

	describe("getPending", () => {
		it("should return pending data if it exists", async () => {
			const collection = db.collection("pending_registrations");
			const docRef = collection.doc(mockUid);
			const pendingData = { ...mockRegistrationData, uid: mockUid, createdAt: new Date() };
			
			jest.spyOn(docRef, "get").mockResolvedValue({
				exists: true,
				data: () => pendingData,
			} as any);
			
			jest.spyOn(collection, "doc").mockReturnValue(docRef as any);

			const result = await registrationService.getPending(mockUid);

			expect(result).toEqual(pendingData);
		});

		it("should return null if pending data does not exist", async () => {
			const collection = db.collection("pending_registrations");
			const docRef = collection.doc(mockUid);
			
			jest.spyOn(docRef, "get").mockResolvedValue({
				exists: false,
			} as any);
			
			jest.spyOn(collection, "doc").mockReturnValue(docRef as any);

			const result = await registrationService.getPending(mockUid);

			expect(result).toBeNull();
		});
	});

	describe("finalize", () => {
		it("should finalize registration successfully with workspace creation", async () => {
			const pendingData = { ...mockRegistrationData, uid: mockUid, createdAt: new Date() };
			
			const pendingRef = db.collection("pending_registrations").doc(mockUid);
			await pendingRef.set(pendingData);

			const result = await registrationService.finalize(mockUid);

			expect(result).toMatchObject({
				userId: mockUid,
				email: pendingData.email,
				name: pendingData.name,
				username: pendingData.username,
			});
		});

		it("should finalize registration with join workspace mode", async () => {
			const pendingData = {
				...mockRegistrationData,
				uid: mockUid,
				workspaceData: {
					mode: "join" as const,
					invitationCode: "workspace-xyz",
					title: "Existing Workspace",
				},
				createdAt: new Date(),
			};
			
			const pendingRef = db.collection("pending_registrations").doc(mockUid);
			await pendingRef.set(pendingData);

			const result = await registrationService.finalize(mockUid);

			expect(result.userId).toBe(mockUid);
		});

		it("should throw error if pending registration not found", async () => {
			const pendingRef = db.collection("pending_registrations").doc(mockUid);
			await pendingRef.delete();

			await expect(registrationService.finalize(mockUid)).rejects.toThrow("No pending registration found for this user");
		});
	});
});

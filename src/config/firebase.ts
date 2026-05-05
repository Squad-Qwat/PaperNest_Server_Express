import admin from "firebase-admin";
import { env } from "./env";

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
	if (admin.apps.length === 0) {
		try {
			admin.initializeApp({
				credential: admin.credential.cert({
					projectId: env.FIREBASE_PROJECT_ID,
					privateKey: env.FIREBASE_PRIVATE_KEY,
					clientEmail: env.FIREBASE_CLIENT_EMAIL,
				}),
				databaseURL: env.FIREBASE_DATABASE_URL,
				storageBucket: env.FIREBASE_STORAGE_BUCKET,
			});
		} catch (error) {
			console.error("❌ Firebase Admin SDK initialization error:", error);
			throw error;
		}
	}

	return admin;
};

// Export initialized instances
export const firebaseAdmin = initializeFirebase();
export const db: admin.firestore.Firestore = firebaseAdmin.firestore();
export const auth: admin.auth.Auth = firebaseAdmin.auth();
export const storage: admin.storage.Storage = firebaseAdmin.storage();

// Firestore settings
db.settings({
	timestampsInSnapshots: true,
});

export default firebaseAdmin;

import { User } from "./index";

declare global {
	namespace Express {
		interface Request {
			user?: User;
			userId?: string;
			firebaseUid?: string;
		}
	}
}

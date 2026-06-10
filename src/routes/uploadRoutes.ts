import { Router } from "express";
import {
	deleteFile,
	getOverwritePresignedUrl,
	getPresignedUrl,
	proxyDownload,
	renameFile,
} from "../controllers/uploadController";
import { authenticate } from "../middlewares/auth";
import { editFileLimiter, uploadRateLimiter } from "../middlewares/rateLimiter";

const router: Router = Router();

/**
 * @route   POST /api/upload/presigned-url
 * @desc    Generate a pre-signed URL for direct Cloudflare R2 uploads
 * @access  Protected
 */
router.post("/presigned-url", authenticate, uploadRateLimiter, getPresignedUrl);

/**
 * @route   POST /api/upload/overwrite-url
 * @desc    Generate a presigned PUT URL targeting an existing R2 key (in-place overwrite)
 * @access  Protected
 */
router.post(
	"/overwrite-url",
	authenticate,
	editFileLimiter,
	getOverwritePresignedUrl,
);

/**
 * @route   GET /api/upload/download
 * @desc    Proxy asset download to bypass CORS for LaTeX compilation assets
 */
router.get("/download", authenticate, editFileLimiter, proxyDownload);

/**
 * @route   DELETE /api/upload/file/:documentId/:fileId
 * @desc    Delete a file from R2 and Firestore
 * @access  Protected
 */
router.delete("/file/:documentId/:fileId", authenticate, deleteFile);

/**
 * @route   PATCH /api/upload/rename/:documentId/:fileId
 * @desc    Rename/move a file in Firestore
 * @access  Protected
 */
router.patch("/rename/:documentId/:fileId", authenticate, renameFile);

export default router;

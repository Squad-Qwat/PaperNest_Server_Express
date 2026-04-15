import { Router } from 'express';
import { getPresignedUrl, proxyDownload, deleteFile } from '../controllers/uploadController';
import { authenticate } from '../middlewares/auth';

const router: Router = Router();

/**
 * @route   POST /api/upload/presigned-url
 * @desc    Generate a pre-signed URL for direct Cloudflare R2 uploads
 * @access  Protected
 */
router.post(
  '/presigned-url',
  authenticate,
  getPresignedUrl
);

/**
 * @route   GET /api/upload/download
 * @desc    Proxy asset download to bypass CORS for LaTeX compilation assets
 */
router.get(
  '/download',
  authenticate,
  proxyDownload
);

/**
 * @route   DELETE /api/upload/file/:documentId/:fileId
 * @desc    Delete a file from R2 and Firestore
 * @access  Protected
 */
router.delete(
  '/file/:documentId/:fileId',
  authenticate,
  deleteFile
);

export default router;

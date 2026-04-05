import { Request, Response } from 'express';
import { StorageService } from '../services/StorageService';
import axios from 'axios';
import { db } from '../config/firebase';

export const getPresignedUrl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, contentType, folder } = req.body;

    if (!filename || !contentType) {
      res.status(400).json({
        success: false,
        message: 'Filename and contentType are required'
      });
      return;
    }

    // Default to 'latex-assets' if folder isn't provided
    const targetFolder = folder || 'latex-assets';

    const result = await StorageService.generatePresignedUrl(
      filename,
      contentType,
      targetFolder
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate pre-signed URL'
    });
  }
};

export const proxyDownload = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }

    console.log(`[ProxyDownload] Request: ${url}`);
    
    // Check if it's an R2 asset (belongs to our public domain)
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'assets.papernest.com';
    if (url.includes(publicDomain)) {
      try {
        // Extract the key from the URL (everything after the domain//)
        const urlObj = new URL(url);
        let key = urlObj.pathname;
        if (key.startsWith('/')) key = key.substring(1);
        
        console.log(`[ProxyDownload] Authenticated R2 Fetch - Key: ${key}`);
        const response = await StorageService.getObject(key);
        
        if (response.Body) {
          const contentType = response.ContentType || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          
          // Stream the response body if it's a readable stream
          const body = response.Body as any;
          if (typeof body.pipe === 'function') {
            body.pipe(res);
          } else {
            // For other body types (like Uint8Array from SDK v3 in some environments)
            const buffer = Buffer.from(await body.transformToByteArray());
            res.send(buffer);
          }
          return;
        }
      } catch (r2Error: any) {
        console.error(`[ProxyDownload] Authenticated R2 Fetch failed for ${url}:`, r2Error.message);
        // Fallback to public fetch if authenticated fails (just in case)
      }
    }

    // Fallback: Generic fetch with axios (useful for non-R2 assets or if R2 fetch failed)
    console.log(`[ProxyDownload] Generic Axios Fetch: ${url}`);
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(response.data));
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.toString() || error.message;
    console.error(`[ProxyDownload] Error ${status}:`, message);
    
    res.status(status).json({
      success: false,
      message: `Failed to proxy asset download: ${message}`,
      upstreamStatus: status
    });
  }
};

export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId, fileId } = req.params;

    if (!documentId || !fileId) {
      res.status(400).json({ success: false, message: 'Document ID and File ID are required' });
      return;
    }

    console.log(`[DeleteFile] Request to delete file ${fileId} from document ${documentId}`);

    // 1. Get file metadata from Firestore to get the R2 key
    const fileRef = db.collection('documents').doc(documentId).collection('files').doc(fileId);
    const fileSnap = await fileRef.get();

    if (!fileSnap.exists) {
      res.status(404).json({ success: false, message: 'File not found in Firestore' });
      return;
    }

    const fileData = fileSnap.data();
    const r2Key = fileData?.r2Key;

    if (r2Key) {
      // 2. Delete from R2
      try {
        await StorageService.deleteObject(r2Key);
      } catch (r2Error) {
        console.error(`[DeleteFile] Failed to delete from R2 (Key: ${r2Key}):`, r2Error);
      }
    } else {
      console.warn(`[DeleteFile] No r2Key found for file ${fileId}, skipping R2 deletion.`);
    }

    // 3. Delete from Firestore
    await fileRef.delete();

    res.json({
      success: true,
      message: 'File deleted successfully from R2 and Firestore'
    });
  } catch (error: any) {
    console.error(`[DeleteFile] Error:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
};

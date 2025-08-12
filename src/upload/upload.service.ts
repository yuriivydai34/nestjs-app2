import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  async saveFile(file: Express.Multer.File): Promise<{ message: string; path: string }> {
    // Check if file exists and was uploaded successfully
    if (!file) {
      throw new Error('No file uploaded');
    }

    // If using diskStorage (which you are), the file is already saved to disk
    // and file.path contains the path to the saved file
    if (file.path) {
      return {
        message: 'File uploaded successfully',
        path: file.path,
      };
    }

    // Fallback for memory storage (if file.buffer is available)
    if (file.buffer) {
      const uploadDir = './upload';
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, file.originalname);
      await fs.promises.writeFile(filePath, file.buffer);

      return {
        message: 'File saved successfully',
        path: filePath,
      };
    }

    throw new Error('File upload failed: neither path nor buffer available');
  }
}
import { Module } from '@nestjs/common';
import { CommentUploadController } from './comment-upload.controller';
import { CommentUploadService } from './comment-upload.service';
import { PrismaService } from 'src/prisma.service';
import { MulterModule } from '@nestjs/platform-express/multer';
import { extname } from 'path';
import { diskStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './upload',
        filename: (req, file, cb) => {
          const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  ],
  controllers: [CommentUploadController],
  providers: [CommentUploadService, PrismaService],
  exports: [CommentUploadService],
})
export class CommentUploadModule { }

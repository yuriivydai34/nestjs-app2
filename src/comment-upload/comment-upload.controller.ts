
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Public } from '../auth/decorators';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { CommentUploadService, FileData } from './comment-upload.service';

@Controller('comment-upload')
export class CommentUploadController {
  constructor(
    private readonly uploadService: CommentUploadService,
  ) { }

  @Public()
  @Post(':commentId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileForComment(@UploadedFile() file: Express.Multer.File, @Param('commentId') commentId: string): Promise<{ message: string; data?: FileData }> {
    return await this.uploadService.saveFile(file, +commentId);
  }

  @Public()
  @Get(':commentId')
  async getFilesForComment(@Param('commentId') commentId: string) {
    return await this.uploadService.getFilesForComment(+commentId);
  }

  @Public()
  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.uploadService.deleteFile(+id);
  }
}

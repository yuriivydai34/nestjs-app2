
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
import { UploadService, FileData } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
  ) { }

  @Public()
  @Post('for-task/:taskId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileForTask(@UploadedFile() file: Express.Multer.File, @Param('taskId') taskId: string): Promise<{ message: string; data?: FileData }> {
    return await this.uploadService.saveFile(file, +taskId);
  }

  @Public()
  @Get('for-task/:taskId')
  async getFilesForTask(@Param('taskId') taskId: string) {
    return await this.uploadService.getFilesForTask(+taskId);
  }

  @Public()
  @Delete('for-task/:id')
  async deleteFile(@Param('id') id: string) {
    return await this.uploadService.deleteFile(+id);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private fileUploadService: FileUploadService,
  ) { }

  async create(createCommentDto: CreateCommentDto, userId: number) {
    // Convert taskId to number to ensure proper type
    const taskId = Number(createCommentDto.taskId);

    // First check if the task exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    await this.notificationService.sendCommentCreatedNotification(createCommentDto.taskId, userId);

    const fileIds = createCommentDto.files || [];
    const uploadedFiles = await this.fileUploadService.getFilesIds(fileIds);

    const result = await this.prisma.comment.create({
      data: {
        text: createCommentDto.text,
        taskId: taskId,
        userId,
        files: {
          connect: uploadedFiles.map(file => ({ id: file.id })),
        },
      },
    });
    return { ...result, files: uploadedFiles };
  }

  findAll() {
    return this.prisma.comment.findMany();
  }

  findOne(id: number) {
    return this.prisma.comment.findUnique({
      where: { id },
    });
  }

  findByTaskId(taskId: number) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { files: true },
    });
  }

  async update(id: number, updateCommentDto: UpdateCommentDto) {
    // Exclude taskId from the update data as Prisma does not allow updating it
    const { taskId, files, ...rest } = updateCommentDto;
    let data: any = { ...rest };

    if (files) {
      data.files = {
        set: files.map(fileId => ({ id: fileId })),
      };
    }

    return this.prisma.comment.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.comment.delete({
      where: { id },
    });
  }
}

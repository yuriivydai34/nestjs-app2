import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma.service';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService
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

    return this.prisma.comment.create({
      data: {
        text: createCommentDto.text,
        taskId: taskId,
        userId,
      },
    });
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
    });
  }

  update(id: number, updateCommentDto: UpdateCommentDto) {
    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
    });
  }

  remove(id: number) {
    return this.prisma.comment.delete({
      where: { id },
    });
  }
}

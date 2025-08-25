import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma.service';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService, private uploadService: UploadService) { }

  async create(createTaskDto: CreateTaskDto, userIdCreator: number) {
    const userIdAssignee = await this.prisma.user.findUnique({
      where: { id: createTaskDto.userIdAssignee },
    });
    if (!userIdAssignee) {
      throw new Error(`Assignee with ID ${createTaskDto.userIdAssignee} not found`);
    }

    return this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        userCreator: { connect: { id: userIdCreator } },
        userIdAssignee: createTaskDto.userIdAssignee,
      },
    });
  }

  findAll() {
    return this.prisma.task.findMany();
  }

  findOne(id: number) {
    return this.prisma.task.findUnique({
      where: { id },
    });
  }

  findCreatedByUser(userIdCreator: number) {
    return this.prisma.task.findMany({
      where: { userCreator: { id: userIdCreator } },
    });
  }

  findByTitle(title: string) {
    return this.prisma.task.findMany({
      where: {
        title: {
          contains: title
        }
      },
    });
  }

  update(id: number, updateTaskDto: UpdateTaskDto) {
    return this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        completed: updateTaskDto.completed,
        userIdAssignee: updateTaskDto.userIdAssignee,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // First delete all comments associated with this task
      await prisma.comment.deleteMany({
        where: { taskId: id },
      });

      await this.uploadService.deleteFilesForTask(id);

      // Then delete the task
      return prisma.task.delete({
        where: { id },
      });
    });
  }
}

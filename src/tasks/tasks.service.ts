import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma.service';
import { TaskUploadService } from 'src/task-upload/task-upload.service';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private taskUploadService: TaskUploadService,
    private notificationService: NotificationService,
  ) {}

  async create(createTaskDto: CreateTaskDto, userIdCreator: number) {
    const userIdSupervisor = await this.prisma.user.findUnique({
      where: { id: createTaskDto.userIdSupervisor },
    });
    if (!userIdSupervisor) {
      throw new Error(`Supervisor with ID ${createTaskDto.userIdSupervisor} not found`);
    }

    const usersIdAssociate = await this.prisma.user.findMany({
      where: { id: { in: createTaskDto.usersIdAssociate } },
    });
    if (usersIdAssociate.length !== createTaskDto.usersIdAssociate.length) {
      throw new Error(`Some associates not found`);
    }

    this.notificationService.sendTaskCreatedNotification({
      title: createTaskDto.title,
      userIdCreator: userIdCreator,
      userIdSupervisor: createTaskDto.userIdSupervisor,
      usersIdAssociate: createTaskDto.usersIdAssociate,
    });

    return this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        deadline: createTaskDto.deadline,
        userIdCreator: userIdCreator,
        usersIdAssociate: createTaskDto.usersIdAssociate,
        userIdSupervisor: createTaskDto.userIdSupervisor,
      },
    });
  }

  findAll(userId: number) {
    return this.prisma.task.findMany(
      {
        where: {
          OR: [{
            userIdCreator: userId
          },
          {
            usersIdAssociate: {
              hasSome: [userId]
            }
          },
          {
            userIdSupervisor: userId
          }]
        }
      }
    );
  }

  findOne(id: number) {
    return this.prisma.task.findUnique({
      where: { id },
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

  async update(id: number, updateTaskDto: UpdateTaskDto) {
    if (updateTaskDto.userIdSupervisor) {
      const userIdSupervisor = await this.prisma.user.findUnique({
        where: { id: updateTaskDto.userIdSupervisor },
      });
      if (!userIdSupervisor) {
        throw new Error(`Supervisor with ID ${updateTaskDto.userIdSupervisor} not found`);
      }
    }

    if (updateTaskDto.usersIdAssociate) {
      const usersIdAssociate = await this.prisma.user.findMany({
        where: { id: { in: updateTaskDto.usersIdAssociate } },
      });
      if (usersIdAssociate.length !== updateTaskDto.usersIdAssociate.length) {
        throw new Error(`Some associates not found`);
      }
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        deadline: updateTaskDto.deadline,
        completed: updateTaskDto.completed,
        userIdSupervisor: updateTaskDto.userIdSupervisor,
        usersIdAssociate: updateTaskDto.usersIdAssociate,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // First delete all comments associated with this task
      await prisma.comment.deleteMany({
        where: { taskId: id },
      });

      await this.taskUploadService.deleteFilesForTask(id);

      // Then delete the task
      return prisma.task.delete({
        where: { id },
      });
    });
  }
}

import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma.service';
import { TaskUploadService } from 'src/task-upload/task-upload.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService, private taskUploadService: TaskUploadService) { }

  async create(createTaskDto: CreateTaskDto, userIdCreator: number) {
    const userIdSupervisor = await this.prisma.user.findUnique({
      where: { id: createTaskDto.userIdSupervisor },
    });
    if (!userIdSupervisor) {
      throw new Error(`Supervisor with ID ${createTaskDto.userIdSupervisor} not found`);
    }

    const userIdAssociate = await this.prisma.user.findUnique({
      where: { id: createTaskDto.userIdAssociate },
    });
    if (!userIdAssociate) {
      throw new Error(`Associate with ID ${createTaskDto.userIdAssociate} not found`);
    }

    return this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        userIdCreator: userIdCreator,
        userIdAssociate: createTaskDto.userIdAssociate,
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
            userIdAssociate: userId
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

    if (updateTaskDto.userIdAssociate) {
      const userIdAssociate = await this.prisma.user.findUnique({
        where: { id: updateTaskDto.userIdAssociate },
      });
      if (!userIdAssociate) {
        throw new Error(`Associate with ID ${updateTaskDto.userIdAssociate} not found`);
      }
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        completed: updateTaskDto.completed,
        userIdSupervisor: updateTaskDto.userIdSupervisor,
        userIdAssociate: updateTaskDto.userIdAssociate,
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

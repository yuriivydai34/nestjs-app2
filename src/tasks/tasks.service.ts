import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PrismaService } from 'src/prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { TaskQueryDto } from './dto/task-query.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private fileUploadService: FileUploadService,
  ) { }

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

    const fileIds = createTaskDto.files || [];
    const uploadedFiles = await this.fileUploadService.getFilesIds(fileIds);
    const filesToCreate = uploadedFiles.map(file => {
      const { id, ...rest } = file;
      return rest;
    });

    return this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        deadline: createTaskDto.deadline,
        userIdCreator: userIdCreator,
        usersIdAssociate: createTaskDto.usersIdAssociate,
        userIdSupervisor: createTaskDto.userIdSupervisor,
        File: {
          create: filesToCreate,
        },
      },
    });
  }

  findAll(userId: number, query: TaskQueryDto) {
    // Parse sort if it's a string
    let sort: any = query?.sort;
    if (typeof sort === 'string') {
      try {
        sort = JSON.parse(sort);
      } catch (e) {
        sort = null;
      }
    }
    // Default sort if not provided
    if (!sort || !sort.sortBy || !sort.sortOrder) {
      sort = { sortBy: 'createdAt', sortOrder: 'desc' };
    }
    return this.prisma.task.findMany({
      where: {
        OR: [
          { userIdCreator: userId },
          { usersIdAssociate: { hasSome: [userId] } },
          { userIdSupervisor: userId }
        ]
      },
      orderBy: { [sort.sortBy]: sort.sortOrder === 'asc' ? 'asc' : 'desc' },
      include: {
        File: true,
        _count: { select: { Comment: true, TaskChecklist: true } }
      },
    });
  }

  findOne(id: number) {
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        File: true,
        _count: { select: { Comment: true, TaskChecklist: true } }
      },
    });
  }

  findByTitle(title: string) {
    return this.prisma.task.findMany({
      where: {
        title: {
          contains: title
        }
      },
      include: {
        File: true,
        _count: { select: { Comment: true, TaskChecklist: true } }
      },
    });
  }

  async update(id: number, updateTaskDto: UpdateTaskDto, userId: number) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
    });
    if (!existingTask) {
      throw new Error(`Task with ID ${id} not found`);
    }

    if (existingTask.userIdCreator !== userId && existingTask.userIdSupervisor !== userId) {
      throw new Error(`You do not have permission to update this task`);
    }

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


    await this.notificationService.sendTaskUpdatedNotification(id, userId);

    const fileIds = updateTaskDto.files || [];
    const uploadedFiles = await this.fileUploadService.getFilesIds(fileIds);

    return this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        deadline: updateTaskDto.deadline,
        active: updateTaskDto.active,
        userIdSupervisor: updateTaskDto.userIdSupervisor,
        usersIdAssociate: updateTaskDto.usersIdAssociate,
        File: {
          create: uploadedFiles,
        },
      },
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // First delete all comments associated with this task
      await prisma.comment.deleteMany({
        where: { taskId: id },
      });

      // Then delete the task
      return prisma.task.delete({
        where: { id },
      });
    });
  }
}

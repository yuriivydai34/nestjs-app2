import { Injectable } from '@nestjs/common';
import { CreateTaskChecklistDto } from './dto/create-task-checklist.dto';
import { UpdateTaskChecklistDto } from './dto/update-task-checklist.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'generated/prisma';

@Injectable()
export class TaskChecklistsService {
  constructor(private prisma: PrismaService) {}

  create(createTaskChecklistDto: CreateTaskChecklistDto) {
    const data: Prisma.TaskChecklistCreateInput = {
      title: createTaskChecklistDto.title,
      checklistItems: {
        create: createTaskChecklistDto.checklistItems,
      },
      task: {
        connect: { id: createTaskChecklistDto.taskId },
      },
    };
    return this.prisma.taskChecklist.create({
      data,
    });
  }

  findAll() {
    return this.prisma.taskChecklist.findMany();
  }

  findOne(id: number) {
    return this.prisma.taskChecklist.findUnique({
      where: { id },
    });
  }

  update(id: number, updateTaskChecklistDto: UpdateTaskChecklistDto) {
    const { taskId, checklistItems, ...rest } = updateTaskChecklistDto;
    return this.prisma.taskChecklist.update({
      where: { id },
      data: {
        ...rest,
        ...(taskId !== undefined && {
          task: { connect: { id: taskId } }
        }),
        ...(checklistItems !== undefined && {
          checklistItems: {
            set: checklistItems.map(item => ({
              id: item.id
            })),
            update: checklistItems.map(item => ({
              where: { id: item.id },
              data: {
                text: item.text,
                completed: item.completed,
              }
            }))
          }
        }),
      },
    });
  }

  remove(id: number) {
    return this.prisma.taskChecklist.delete({
      where: { id },
    });
  }
}

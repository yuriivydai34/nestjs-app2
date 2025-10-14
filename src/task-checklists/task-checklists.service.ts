import { Injectable } from '@nestjs/common';
import { CreateTaskChecklistDto } from './dto/create-task-checklist.dto';
import { UpdateTaskChecklistDto } from './dto/update-task-checklist.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'generated/prisma';

@Injectable()
export class TaskChecklistsService {
  constructor(private prisma: PrismaService) {}

  create(createTaskChecklistDto: CreateTaskChecklistDto) {
    // Remove 'id' from checklistItems if present
    const checklistItems = createTaskChecklistDto.checklistItems?.map(item => {
      const { id, ...rest } = item;
      return rest;
    });
    const data: Prisma.TaskChecklistCreateInput = {
      title: createTaskChecklistDto.title,
      checklistItems: checklistItems ? { create: checklistItems } : undefined,
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

  findAllForTask(taskId: number) {
    return this.prisma.taskChecklist.findMany({
      where: { taskId },
      include: { checklistItems: true },
    });
  }

  findOne(id: number) {
    return this.prisma.taskChecklist.findUnique({
      where: { id },
    });
  }

  update(id: number, updateTaskChecklistDto: UpdateTaskChecklistDto) {
    const { taskId, checklistItems, ...rest } = updateTaskChecklistDto;
    // Remove any potential id field that might have been passed
    const { id: _, ...safeRest } = rest as any;
    return this.prisma.taskChecklist.update({
      where: { id },
      data: {
        ...safeRest,
        ...(taskId !== undefined && {
          task: { connect: { id: taskId } }
        }),
        ...(checklistItems !== undefined && {
          checklistItems: {
            // Delete all existing items first, then recreate
            deleteMany: {},
            create: checklistItems.map(item => ({
              text: item.text,
              completed: item.completed,
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

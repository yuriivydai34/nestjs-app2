import { Injectable } from '@nestjs/common';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { PrismaService } from 'src/prisma.service';
import { TemplateQueryDto } from './dto/template-query.dto';

@Injectable()
export class TaskTemplateService {
  constructor(private prisma: PrismaService) { }

  create(createTaskTemplateDto: CreateTaskTemplateDto) {
    // Map DTO to Prisma input type if necessary
    const data: CreateTaskTemplateDto = { ...createTaskTemplateDto };
    return this.prisma.taskTemplate.create({
      data,
    });
  }

  findAll(query: TemplateQueryDto) {
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
    return this.prisma.taskTemplate.findMany({
      orderBy: { [sort.sortBy]: sort.sortOrder === 'asc' ? 'asc' : 'desc' }
    });
  }

  findOne(id: number) {
    return this.prisma.taskTemplate.findUnique({
      where: { id },
    });
  }

  update(id: number, updateTaskTemplateDto: UpdateTaskTemplateDto) {
    return this.prisma.taskTemplate.update({
      where: { id },
      data: updateTaskTemplateDto,
    });
  }

  remove(id: number) {
    return this.prisma.taskTemplate.delete({
      where: { id },
    });
  }
}

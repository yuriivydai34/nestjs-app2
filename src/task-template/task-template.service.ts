import { Injectable } from '@nestjs/common';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class TaskTemplateService {
  constructor(private prismaService: PrismaService) {}
  
  create(createTaskTemplateDto: CreateTaskTemplateDto) {
    // Map DTO to Prisma input type if necessary
    const data: CreateTaskTemplateDto = { ...createTaskTemplateDto };
    return this.prismaService.taskTemplate.create({
      data,
    });
  }

  findAll() {
    return this.prismaService.taskTemplate.findMany();
  }

  findOne(id: number) {
    return this.prismaService.taskTemplate.findUnique({
      where: { id },
    });
  }

  update(id: number, updateTaskTemplateDto: UpdateTaskTemplateDto) {
    return this.prismaService.taskTemplate.update({
      where: { id },
      data: updateTaskTemplateDto,
    });
  }

  remove(id: number) {
    return this.prismaService.taskTemplate.delete({
      where: { id },
    });
  }
}

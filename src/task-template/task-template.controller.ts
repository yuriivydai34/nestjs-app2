import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TaskTemplateService } from './task-template.service';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';

@Controller('task-template')
export class TaskTemplateController {
  constructor(private readonly taskTemplateService: TaskTemplateService) {}

  @Post()
  create(@Body() createTaskTemplateDto: CreateTaskTemplateDto) {
    return this.taskTemplateService.create(createTaskTemplateDto);
  }

  @Get()
  findAll() {
    return this.taskTemplateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskTemplateService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskTemplateDto: UpdateTaskTemplateDto) {
    return this.taskTemplateService.update(+id, updateTaskTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskTemplateService.remove(+id);
  }
}

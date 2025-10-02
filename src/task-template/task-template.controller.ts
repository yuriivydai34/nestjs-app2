import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common';
import { TaskTemplateService } from './task-template.service';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { TemplateQueryDto } from './dto/template-query.dto';

@Controller('task-template')
export class TaskTemplateController {
  constructor(private readonly taskTemplateService: TaskTemplateService) {}

  @Post()
  create(@Body() createTaskTemplateDto: CreateTaskTemplateDto) {
    return this.taskTemplateService.create(createTaskTemplateDto);
  }

  @Get()
  findAll(@Query() query: TemplateQueryDto) {
    return this.taskTemplateService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskTemplateService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateTaskTemplateDto: UpdateTaskTemplateDto) {
    return this.taskTemplateService.update(+id, updateTaskTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskTemplateService.remove(+id);
  }
}

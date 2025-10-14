import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Put 
} from '@nestjs/common';
import { TaskChecklistsService } from './task-checklists.service';
import { CreateTaskChecklistDto } from './dto/create-task-checklist.dto';
import { UpdateTaskChecklistDto } from './dto/update-task-checklist.dto';

@Controller('task-checklists')
export class TaskChecklistsController {
  constructor(private readonly taskChecklistsService: TaskChecklistsService) {}

  @Post()
  create(@Body() createTaskChecklistDto: CreateTaskChecklistDto) {
    return this.taskChecklistsService.create(createTaskChecklistDto);
  }

  @Get()
  findAll() {
    return this.taskChecklistsService.findAll();
  }

  @Get('for-task/:taskId')
  findAllForTask(@Param('taskId') taskId: string) {
    return this.taskChecklistsService.findAllForTask(+taskId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskChecklistsService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateTaskChecklistDto: UpdateTaskChecklistDto) {
    return this.taskChecklistsService.update(+id, updateTaskChecklistDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskChecklistsService.remove(+id);
  }
}

import { PartialType } from '@nestjs/swagger';
import { CreateTaskChecklistDto } from './create-task-checklist.dto';

export class UpdateTaskChecklistDto extends PartialType(CreateTaskChecklistDto) { }

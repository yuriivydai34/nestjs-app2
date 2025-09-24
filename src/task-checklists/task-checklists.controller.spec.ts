import { Test, TestingModule } from '@nestjs/testing';
import { TaskChecklistsController } from './task-checklists.controller';
import { TaskChecklistsService } from './task-checklists.service';

describe('TaskChecklistsController', () => {
  let controller: TaskChecklistsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskChecklistsController],
      providers: [TaskChecklistsService],
    }).compile();

    controller = module.get<TaskChecklistsController>(TaskChecklistsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { TaskChecklistsService } from './task-checklists.service';

describe('TaskChecklistsService', () => {
  let service: TaskChecklistsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskChecklistsService],
    }).compile();

    service = module.get<TaskChecklistsService>(TaskChecklistsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

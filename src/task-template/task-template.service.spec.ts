import { Test, TestingModule } from '@nestjs/testing';
import { TaskTemplateService } from './task-template.service';

describe('TaskTemplateService', () => {
  let service: TaskTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskTemplateService],
    }).compile();

    service = module.get<TaskTemplateService>(TaskTemplateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

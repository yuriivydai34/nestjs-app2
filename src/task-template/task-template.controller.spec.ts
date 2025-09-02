import { Test, TestingModule } from '@nestjs/testing';
import { TaskTemplateController } from './task-template.controller';
import { TaskTemplateService } from './task-template.service';

describe('TaskTemplateController', () => {
  let controller: TaskTemplateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskTemplateController],
      providers: [TaskTemplateService],
    }).compile();

    controller = module.get<TaskTemplateController>(TaskTemplateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

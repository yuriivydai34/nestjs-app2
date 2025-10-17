import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

describe('BackupController', () => {
  let controller: BackupController;
  let service: BackupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [
        {
          provide: BackupService,
          useValue: {
            createBackup: jest.fn(),
            getAllBackups: jest.fn(),
            getBackupById: jest.fn(),
            downloadBackup: jest.fn(),
            uploadToCloud: jest.fn(),
            deleteBackup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BackupController>(BackupController);
    service = module.get<BackupService>(BackupService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // TODO: Add more specific tests for backup endpoints
});
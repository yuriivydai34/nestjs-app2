import { Test, TestingModule } from '@nestjs/testing';
import { BackupService } from './backup.service';
import { PrismaService } from '../prisma.service';

describe('BackupService', () => {
  let service: BackupService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: PrismaService,
          useValue: {
            backup: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: Add more specific tests for backup operations
});
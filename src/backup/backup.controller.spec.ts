import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';

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
        RolesGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<BackupController>(BackupController);
    service = module.get<BackupService>(BackupService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Role-based Access Control', () => {
    it('should require admin role for backup operations', () => {
      // The @Roles('admin') decorator should be applied to the controller
      // This ensures all backup endpoints require admin role
      const rolesMetadata = Reflect.getMetadata('roles', BackupController);
      expect(rolesMetadata).toEqual(['admin']);
    });
  });

  // TODO: Add more specific tests for backup endpoints with role mocking
});
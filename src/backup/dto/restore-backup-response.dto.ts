import { ApiProperty } from '@nestjs/swagger';
import { BackupResponseDto } from './backup-response.dto';

export class RestoreBackupResponseDto {
  @ApiProperty({
    description: 'Success message indicating the restore operation result',
    example: 'Database restored successfully from backup: backup_2025-10-17_18-30-00.sql'
  })
  message: string;

  @ApiProperty({
    description: 'Information about the backup that was used for restoration',
    type: BackupResponseDto
  })
  backupInfo: BackupResponseDto;
}
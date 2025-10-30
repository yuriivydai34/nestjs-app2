import { ApiProperty } from '@nestjs/swagger';

export class BackupResponseDto {
  @ApiProperty({
    description: 'Backup ID',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: 'Backup filename',
    example: 'backup_20251017_143022.sql'
  })
  filename: string;

  @ApiProperty({
    description: 'Backup description',
    example: 'Daily backup before maintenance',
    required: false
  })
  description?: string;

  @ApiProperty({
    description: 'Backup file size in bytes',
    example: 1024000
  })
  size: number;

  @ApiProperty({
    description: 'Backup type',
    example: 'full'
  })
  type: string;

  @ApiProperty({
    description: 'Backup status',
    example: 'completed'
  })
  status: string;

  @ApiProperty({
    description: 'Storage URL if uploaded',
    required: false
  })
  url?: string;

  @ApiProperty({
    description: 'Backup creation date',
    example: '2024-10-17T14:30:22.000Z'
  })
  createdAt: Date;
}
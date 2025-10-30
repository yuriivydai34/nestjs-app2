import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateBackupDto {
  @ApiProperty({
    description: 'Optional description for the backup',
    required: false,
    example: 'Daily backup before maintenance'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Backup type',
    required: false,
    example: 'full',
    default: 'full'
  })
  @IsOptional()
  @IsString()
  type?: string = 'full';
}
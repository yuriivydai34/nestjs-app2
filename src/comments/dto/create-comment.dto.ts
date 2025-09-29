import { ApiProperty } from "@nestjs/swagger";

export class CreateCommentDto {
    @ApiProperty()
    text: string;

    @ApiProperty()
    taskId: number;

    @ApiProperty()
    userId: number;

    @ApiProperty()
    createdAt?: string;

    @ApiProperty()
    files?: number[];
}

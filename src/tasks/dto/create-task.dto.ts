import { ApiProperty } from "@nestjs/swagger";

export class CreateTaskDto {
    @ApiProperty()
    title: string;

    @ApiProperty()
    description?: string;

    @ApiProperty()
    completed: boolean;

    @ApiProperty()
    userIdAssignee: number;
}

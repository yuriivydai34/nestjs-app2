import { ApiProperty } from "@nestjs/swagger";

export class CreateTaskDto {
    @ApiProperty()
    title: string;

    @ApiProperty()
    description?: string;

    @ApiProperty()
    completed: boolean;

    @ApiProperty()
    deadline: Date;

    @ApiProperty()
    userIdSupervisor: number;

    @ApiProperty()
    userIdAssociate: number;
}

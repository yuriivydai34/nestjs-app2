import { ApiProperty } from "@nestjs/swagger";

export class CreateTaskTemplateDto {
    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;
}

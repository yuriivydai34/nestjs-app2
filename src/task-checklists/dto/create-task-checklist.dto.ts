import { CheckListItem } from "generated/prisma";

export class CreateTaskChecklistDto {
  title: string;
  taskId: number;
  checklistItems?: CheckListItem[];
}

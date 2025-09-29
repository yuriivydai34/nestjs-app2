export class CreateChatRoomDto {
  name: string;
  createdBy: number;
  members: number[];
  isDirectMessage?: boolean;
}
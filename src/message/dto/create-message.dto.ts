export class CreateMessageDto {
    content: string;
    receiverId: number;
    senderId: number;
    roomId?: string;
    files?: number[];
}

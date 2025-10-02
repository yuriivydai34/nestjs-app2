import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from 'src/message/message.service';

// Define UploadedFile type if not imported from elsewhere
type UploadedFile = {
  filename: string;
  url: string;
  mimetype?: string;
  size?: number;
};

type MessageData = {
  id: number;
  content: string;
  senderId: number;
  timestamp: string;
  roomId?: string;
  receiverId?: number;
  isRead: boolean;
  files?: UploadedFile[];
};

let clients: { [key: string]: number } = {}; // Mapping of socket.id to userId

@WebSocketGateway({ cors: true }) // Configure CORS if needed
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private messageService: MessageService) {}

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    if (client.handshake.auth.userId) {
      clients[client.id] = client.handshake.auth.userId;
      console.log(`Client connected: ${client.id}, userId: ${client.handshake.auth.userId}`);
      console.log(clients);
    }
  }

  handleDisconnect(client: Socket) {
    delete clients[client.id];
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('new_message')
  async handleMessage(@MessageBody() data: MessageData, @ConnectedSocket() client: Socket): Promise<void> {
    console.log(data);
  }
}
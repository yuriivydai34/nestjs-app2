import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from 'src/message/message.service';

type MessageData = {
  content: string;
  senderId: number;
  receiverId: number;
};

@WebSocketGateway({ cors: true }) // Configure CORS if needed
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private messageService: MessageService) {}

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() data: MessageData, @ConnectedSocket() client: Socket): Promise<void> {
    console.log(`Message from ${client.id} with userId ${data.senderId}: ${data.content}, to: ${data.receiverId}`);

    await this.messageService.create(data);

    this.server.emit('receiveMessage', data); // Emit to all connected clients
  }

  // Method to send a message from a service or controller
  sendMessageToClient(event: string, payload: any, clientId?: string): void {
    if (clientId) {
      // Send to a specific client by socket ID
      this.server.to(clientId).emit(event, payload);
    } else {
      // Send to all connected clients
      this.server.emit(event, payload);
    }
  }
}
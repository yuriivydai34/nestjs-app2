import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from 'src/message/message.service';

type MessageData = {
  content: string;
  senderId: number;
  receiverId: number;
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

  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() data: MessageData, @ConnectedSocket() client: Socket): Promise<void> {
    console.log(`Message from ${client.id} with userId ${data.senderId}: ${data.content}, to: ${data.receiverId}`);

    await this.messageService.create(data);

    await this.sendPrivateMessage('receiveMessage', data, [
      data.receiverId.toString(), 
      data.senderId.toString()
    ]); // Emit to the clients
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

  async sendPrivateMessage(event: string, payload: any, clientIds: string[]): Promise<void> {
    console.log(clients);
    clientIds.forEach(clientId => {
      const clientKey = Object.keys(clients).find(key => clients[key] === parseInt(clientId));
      console.log(`Sending private message to client: ${clientKey}`);
      if (clientKey) {
        this.server.to(clientKey).emit(event, payload);
      }
    });
    console.log(`Private message sent: ${event}, ${JSON.stringify(payload)}, to: ${clientIds.join(', ')}`);
  }
}
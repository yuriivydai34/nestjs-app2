import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from 'src/message/message.service';
import { ChatRoomService } from 'src/chat-room/chat-room.service';
import { UsersService } from 'src/users/users.service';
import { Injectable, Logger } from '@nestjs/common';

// Define UploadedFile type if not imported from elsewhere
type UploadedFile = {
  filename: string;
  url: string;
  mimetype?: string;
  size?: number;
};

type MessageData = {
  id?: number;
  content: string;
  senderId: number;
  timestamp?: string;
  roomId?: string;
  receiverId?: number;
  isRead?: boolean;
  files?: number[]; // Array of file IDs
};

type RoomMembersUpdate = {
  roomId: string;
  memberIds: number[];
};

type UserStatusUpdate = {
  userId: number;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
};

// Store connected clients with their user info
let clients: { [socketId: string]: { userId: number; status: string } } = {};

@Injectable()
@WebSocketGateway({ 
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    credentials: true
  },
  namespace: '/'
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private messageService: MessageService,
    private chatRoomService: ChatRoomService,
    private usersService: UsersService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const userId = client.handshake.auth.userId;
      this.logger.log(`🔍 Connection attempt - socketId: ${client.id}, userId: ${userId}`);
      
      if (userId) {
        clients[client.id] = { userId: parseInt(userId), status: 'online' };
        this.logger.log(`✅ Client connected: ${client.id}, userId: ${userId}`);
        this.logger.log(`👥 Current clients:`, Object.keys(clients).map(id => ({
          socketId: id,
          userId: clients[id].userId,
          status: clients[id].status
        })));
        
        // Update user status to online
        try {
          await this.usersService.updateUserStatus(parseInt(userId), 'online');
          this.logger.log(`📊 Updated user ${userId} status to online`);
        } catch (error) {
          this.logger.warn(`Failed to update user status: ${error.message}`);
        }

        // Join user to their personal room for direct messages
        client.join(`user_${userId}`);
        this.logger.log(`🏠 User ${userId} joined personal room: user_${userId}`);
        
        // Notify other clients about user coming online
        this.server.emit('user_status_update', {
          userId: parseInt(userId),
          status: 'online',
          lastSeen: new Date().toISOString()
        });

        // Get user's chat rooms and join them
        try {
          const userRooms = await this.chatRoomService.findUserRooms(parseInt(userId));
          this.logger.log(`🏢 Found ${userRooms.length} rooms for user ${userId}`);
          userRooms.forEach(room => {
            client.join(room.id);
            this.logger.log(`🚪 User ${userId} joined room: ${room.id}`);
          });
        } catch (error) {
          this.logger.warn(`Failed to join user rooms: ${error.message}`);
        }

        this.logger.log(`📈 Total active clients: ${Object.keys(clients).length}`);
      } else {
        this.logger.warn('❌ Client connected without userId - disconnecting');
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(`💥 Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const clientInfo = clients[client.id];
      if (clientInfo) {
        const { userId } = clientInfo;
        
        // Update user status to offline
        try {
          await this.usersService.updateUserStatus(userId, 'offline');
        } catch (error) {
          this.logger.warn(`Failed to update user status on disconnect: ${error.message}`);
        }

        // Notify other clients about user going offline
        this.server.emit('user_status_update', {
          userId,
          status: 'offline',
          lastSeen: new Date().toISOString()
        });

        delete clients[client.id];
        this.logger.log(`Client disconnected: ${client.id}, userId: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`);
    }
  }

  @SubscribeMessage('new_message')
  async handleNewMessage(@MessageBody() data: MessageData, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      this.logger.log('Received new message:', data);
      
      const clientInfo = clients[client.id];
      if (!clientInfo) {
        this.logger.warn('Message from unauthenticated client');
        return;
      }

      // Create message in database - handle optional receiverId properly
      let messageDto: any = {
        content: data.content,
        senderId: clientInfo.userId,
        files: data.files || []
      };

      if (data.roomId) {
        messageDto.roomId = data.roomId;
      }
      
      if (data.receiverId) {
        messageDto.receiverId = data.receiverId;
      }

      const savedMessage = await this.messageService.create(messageDto);
      
      // Emit to room or direct recipient
      if (data.roomId) {
        // Room message - emit to all room members
        this.server.to(data.roomId).emit('message_received', savedMessage);
      } else if (data.receiverId) {
        // Direct message - emit to sender and receiver
        this.server.to(`user_${data.receiverId}`).emit('message_received', savedMessage);
        this.server.to(`user_${clientInfo.userId}`).emit('message_received', savedMessage);
      }

      this.logger.log(`Message sent successfully: ${savedMessage.id}`);
    } catch (error) {
      this.logger.error(`Error handling new message: ${error.message}`);
      client.emit('message_error', { error: 'Failed to send message' });
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(@MessageBody() data: { roomId: string }, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo) return;

      client.join(data.roomId);
      this.logger.log(`User ${clientInfo.userId} joined room ${data.roomId}`);
      
      // Notify room members about user joining
      client.to(data.roomId).emit('user_joined_room', {
        roomId: data.roomId,
        userId: clientInfo.userId
      });
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@MessageBody() data: { roomId: string }, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo) return;

      client.leave(data.roomId);
      this.logger.log(`User ${clientInfo.userId} left room ${data.roomId}`);
      
      // Notify room members about user leaving
      client.to(data.roomId).emit('user_left_room', {
        roomId: data.roomId,
        userId: clientInfo.userId
      });
    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`);
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(@MessageBody() data: { messageIds: number[] }, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo) return;

      // Mark messages as read
      await this.messageService.markAsRead(data.messageIds, clientInfo.userId);
      
      // Notify senders that their messages were read
      for (const messageId of data.messageIds) {
        const message = await this.messageService.findOne(messageId);
        if (message && message.senderId !== clientInfo.userId) {
          this.server.to(`user_${message.senderId}`).emit('message_read_update', {
            messageId,
            readBy: clientInfo.userId,
            readAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(@MessageBody() data: { roomId?: string; receiverId?: number }, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo) return;

      const typingData = {
        userId: clientInfo.userId,
        isTyping: true
      };

      if (data.roomId) {
        client.to(data.roomId).emit('user_typing', { ...typingData, roomId: data.roomId });
      } else if (data.receiverId) {
        this.server.to(`user_${data.receiverId}`).emit('user_typing', { ...typingData, fromUserId: clientInfo.userId });
      }
    } catch (error) {
      this.logger.error(`Error handling typing start: ${error.message}`);
    }
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(@MessageBody() data: { roomId?: string; receiverId?: number }, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo) return;

      const typingData = {
        userId: clientInfo.userId,
        isTyping: false
      };

      if (data.roomId) {
        client.to(data.roomId).emit('user_typing', { ...typingData, roomId: data.roomId });
      } else if (data.receiverId) {
        this.server.to(`user_${data.receiverId}`).emit('user_typing', { ...typingData, fromUserId: clientInfo.userId });
      }
    } catch (error) {
      this.logger.error(`Error handling typing stop: ${error.message}`);
    }
  }

  @SubscribeMessage('room_members_updated')
  async handleRoomMembersUpdated(@MessageBody() data: RoomMembersUpdate, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo) return;

      // Notify all room members about the update
      this.server.to(data.roomId).emit('room_members_changed', {
        roomId: data.roomId,
        memberIds: data.memberIds,
        updatedBy: clientInfo.userId
      });

      // Add new members to the room socket
      data.memberIds.forEach(memberId => {
        const memberSocket = this.getSocketByUserId(memberId);
        if (memberSocket) {
          memberSocket.join(data.roomId);
        }
      });
    } catch (error) {
      this.logger.error(`Error handling room members update: ${error.message}`);
    }
  }

  @SubscribeMessage('user_status_change')
  async handleUserStatusChange(@MessageBody() data: UserStatusUpdate, @ConnectedSocket() client: Socket): Promise<void> {
    try {
      const clientInfo = clients[client.id];
      if (!clientInfo || clientInfo.userId !== data.userId) return;

      // Update status in memory
      clients[client.id].status = data.status;

      // Update in database
      await this.usersService.updateUserStatus(data.userId, data.status);

      // Broadcast status update to all connected clients
      this.server.emit('user_status_update', {
        userId: data.userId,
        status: data.status,
        lastSeen: data.lastSeen || new Date().toISOString()
      });
    } catch (error) {
      this.logger.error(`Error handling user status change: ${error.message}`);
    }
  }

  // Helper method to find socket by user ID
  private getSocketByUserId(userId: number): Socket | null {
    const socketId = Object.keys(clients).find(id => clients[id].userId === userId);
    return socketId ? (this.server.sockets.sockets.get(socketId) || null) : null;
  }

  // Public method to send notification to specific user
  public sendNotificationToUser(userId: number, notification: any): void {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  // Public method to send message to room
  public sendMessageToRoom(roomId: string, message: any): void {
    this.server.to(roomId).emit('message_received', message);
  }

  // Get online users
  public getOnlineUsers(): number[] {
    return Object.values(clients).map(client => client.userId);
  }
}
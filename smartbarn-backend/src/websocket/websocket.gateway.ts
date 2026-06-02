import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Customize this for production
  },
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private redisSub: Redis;
  private readonly logger = new Logger(WebsocketGateway.name);

  afterInit(server: Server) {
    this.logger.log('Websocket Gateway Initialized');
    
    // Connect to Redis to listen for pub/sub events from IoT Hot Path
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisSub = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    this.redisSub.on('error', (err) => {
      this.logger.warn('Websocket Redis subscription offline.');
    });

    // Subscribe to topics
    try {
      this.redisSub.subscribe('websocket:environment', 'websocket:heartrate', 'websocket:temperature', 'websocket:vital-update', 'websocket:windspeed', (err, count) => {
        if (err) {
          this.logger.error('Failed to subscribe to Redis channels', err);
        } else {
          this.logger.log(`Subscribed to ${count} Redis channels`);
        }
      });
    } catch (err) {
      this.logger.error('Redis subscription failed:', err.message);
    }

    // Listen for messages and broadcast them
    this.redisSub.on('message', (channel, message) => {
      // Parse message
      const payload = JSON.parse(message);
      
      if (channel === 'websocket:vital-update') {
        // Emit specifically to the cow's listener (for charts)
        this.server.emit(`vital-update-${payload.cattleId}`, payload);
        // Emit generally (for the livestock list)
        this.server.emit('vital-update', payload);
      } else {
        // Emit to all connected clients for general channels
        this.server.emit(channel, payload);
      }
    });
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}

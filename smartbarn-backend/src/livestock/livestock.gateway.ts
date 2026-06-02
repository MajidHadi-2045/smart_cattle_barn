// src/livestock/livestock.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class LivestockGateway {
  @WebSocketServer()
  server: Server;
}
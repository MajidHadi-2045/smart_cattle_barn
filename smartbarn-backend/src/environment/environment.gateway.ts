// src/environment/environment.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class EnvironmentGateway {
  @WebSocketServer()
  server: Server;
}
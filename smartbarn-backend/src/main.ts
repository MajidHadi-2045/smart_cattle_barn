import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import { PrismaClientExceptionFilter } from './prisma/prisma-client-exception.filter';

import { json, urlencoded } from 'express';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 0. PERBESAR LIMIT PAYLOAD & AKTIFKAN HTTP COMPRESSION
  app.use(compression());
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ limit: '5mb', extended: true }));

  // 1. AKTIFKAN CORS: Agar Frontend bisa memanggil API
  app.enableCors({
    origin: '*', // Di tahap produksi, ganti dengan domain frontend Anda
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 2. AKTIFKAN GLOBAL PREFIX: Agar sesuai dengan VITE_API_BASE_URL di frontend
  app.setGlobalPrefix('api');

  // 3. AKTIFKAN GLOBAL PIPES: Agar input data otomatis divalidasi
  app.useGlobalPipes(new ValidationPipe());

  // 3b. AKTIFKAN GLOBAL FILTERS: Agar error Prisma ditangani secara elegan
  app.useGlobalFilters(new PrismaClientExceptionFilter());

  // 4. KONFIGURASI SWAGGER
  const config = new DocumentBuilder()
    .setTitle('Smart Cattle Barn API')
    .setDescription('The Smart Cattle Barn API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));

  // 5. BACA PORT DARI .env
  const port = process.env.PORT || 3000;

  await app.listen(port);
  console.log(`✅ SmartBarn Backend is running on port: ${port}`);
}
bootstrap();
// trigger restart
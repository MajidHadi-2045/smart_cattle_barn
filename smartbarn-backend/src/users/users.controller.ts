// src/users/users.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- ENDPOINT MANAJEMEN STAF (GAMBAR 6 & 7) ---
  @Get('staff')
  getAllStaff() {
    return this.usersService.getAllStaff();
  }

  @Post('staff')
  createStaff(@Body() data: any) {
    return this.usersService.createStaff(data);
  }

  @Get('profile/:id')
  getProfile(@Param('id') id: string) {
    return this.usersService.getUserProfile(id);
  }

  @Patch('profile/:id/photo')
  updatePhoto(@Param('id') id: string, @Body('photo') photo: string) {
    return this.usersService.updateUserPhoto(id, photo);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.deleteStaff(id);
  }

  // --- Konfirmasi Pendaftaran ---
  @Get('pending')
  getPending() {
    return this.usersService.getPendingUsers();
  }

  @Patch('approve/:id')
  approve(@Param('id') id: string) {
    return this.usersService.approveUser(id);
  }

  @Delete('reject/:id')
  reject(@Param('id') id: string) {
    return this.usersService.rejectUser(id);
  }

  // --- ENDPOINT PERMINTAAN MASUK (GAMBAR 8) ---
  @Get('requests')
  getPendingRequests() {
    return this.usersService.getPendingRequests();
  }

  @Post('requests')
  createRequest(@Body() data: any) {
    return this.usersService.createRequest(data);
  }

  // Aksi tombol Centang (Terima) atau Silang (Tolak)
  // Payload contoh: { "action": "TERIMA" }
  @Patch('requests/:id/process')
  processRequest(
    @Param('id') id: string,
    @Body('action') action: 'TERIMA' | 'TOLAK'
  ) {
    return this.usersService.processRequest(+id, action);
  }
}
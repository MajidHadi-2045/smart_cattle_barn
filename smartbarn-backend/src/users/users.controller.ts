import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- ENDPOINT MANAJEMEN STAF (GAMBAR 6 & 7) ---
  @Get('staff')
  @Roles('SUPER_ADMIN', 'VETERINER', 'STAFF')
  getAllStaff() {
    return this.usersService.getAllStaff();
  }

  @Post('staff')
  @Roles('SUPER_ADMIN')
  createStaff(@Body() data: any) {
    return this.usersService.createStaff(data);
  }

  @Get('profile/:id')
  @Roles('SUPER_ADMIN', 'VETERINER', 'STAFF')
  getProfile(@Param('id') id: string) {
    return this.usersService.getUserProfile(id);
  }

  @Patch('profile/:id/photo')
  @Roles('SUPER_ADMIN', 'VETERINER', 'STAFF')
  updatePhoto(@Param('id') id: string, @Body('photo') photo: string) {
    return this.usersService.updateUserPhoto(id, photo);
  }

  @Patch('profile/:id/update')
  @Roles('SUPER_ADMIN', 'VETERINER', 'STAFF')
  updateProfile(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    // Pastikan user hanya bisa update profilnya sendiri (atau jika dia Super Admin)
    if (req.user.role !== 'SUPER_ADMIN' && req.user.sub !== id) {
      throw new Error('Anda hanya dapat mengubah profil Anda sendiri.');
    }
    return this.usersService.updateProfile(id, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.usersService.deleteStaff(id);
  }

  // --- Konfirmasi Pendaftaran ---
  @Get('pending')
  @Roles('SUPER_ADMIN')
  getPending() {
    return this.usersService.getPendingUsers();
  }

  @Patch('approve/:id')
  @Roles('SUPER_ADMIN')
  approve(@Param('id') id: string) {
    return this.usersService.approveUser(id);
  }

  @Delete('reject/:id')
  @Roles('SUPER_ADMIN')
  reject(@Param('id') id: string) {
    return this.usersService.rejectUser(id);
  }

  // --- ENDPOINT PERMINTAAN MASUK (GAMBAR 8) ---
  @Get('requests')
  @Roles('SUPER_ADMIN')
  getPendingRequests() {
    return this.usersService.getPendingRequests();
  }

  @Post('requests')
  @Roles('SUPER_ADMIN', 'VETERINER', 'STAFF')
  createRequest(@Body() data: any) {
    return this.usersService.createRequest(data);
  }

  // Aksi tombol Centang (Terima) atau Silang (Tolak)
  // Payload contoh: { "action": "TERIMA" }
  @Patch('requests/:id/process')
  @Roles('SUPER_ADMIN')
  processRequest(
    @Param('id') id: string,
    @Body('action') action: 'TERIMA' | 'TOLAK'
  ) {
    return this.usersService.processRequest(+id, action);
  }

  @Patch('change-password')
  @Roles('SUPER_ADMIN', 'VETERINER', 'STAFF')
  changePassword(@Req() req: any, @Body() body: any) {
    return this.usersService.changePassword(req.user.sub, body);
  }

  // --- ADMIN RESET PASSWORD ---
  @Patch('force-reset/:id')
  @Roles('SUPER_ADMIN')
  forceResetPassword(@Param('id') id: string) {
    return this.usersService.forceResetPassword(id);
  }
}
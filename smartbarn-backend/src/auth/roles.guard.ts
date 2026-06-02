import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // Jika tidak dilindungi, biarkan lewat

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Akses ditolak, identitas tidak ditemukan');

    // Cek apakah role user ada di dalam daftar role yang diizinkan
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
        throw new ForbiddenException(`Akses ditolak. Anda login sebagai ${user.role}, halaman ini khusus ${requiredRoles.join(' atau ')}`);
    }

    return true;
  }
}
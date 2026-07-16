import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  VETERINER = 'VETERINER'
}

export class LoginDto {
  @ApiProperty({ description: 'Email atau Username pengguna', example: 'superadmin@barn.com' })
  @IsString()
  @IsNotEmpty()
  email?: string;

  @ApiProperty({ description: 'Username pengguna', required: false, example: 'superadmin' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: 'Password akun', example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ description: 'Peran yang digunakan untuk login', enum: Role, example: Role.SUPER_ADMIN })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;

  @ApiProperty({ description: 'Token Push Notification Firebase/Expo', required: false })
  @IsOptional()
  @IsString()
  pushToken?: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'john.doe' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'john@barn.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '08123456789' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ enum: Role, example: Role.STAFF })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'pegawai@barn.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'token_dari_email_disini' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'PasswordBaru123!' })
  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}

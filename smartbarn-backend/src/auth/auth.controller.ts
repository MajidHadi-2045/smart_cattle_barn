// src/auth/auth.controller.ts
import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: Record<string, any>) {
    const identifier = signInDto.username || signInDto.email;
    return this.authService.login(identifier, signInDto.password, signInDto.role);
  }

  @Post('register')
  signUp(@Body() signUpDto: Record<string, any>) {
    return this.authService.register(signUpDto);
  }
}
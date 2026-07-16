import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateLivestockDto {
  @IsString()
  @IsNotEmpty()
  cattleId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  breed: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsNumber()
  @IsNotEmpty()
  initialWeight: number;

  @IsNumber()
  @IsNotEmpty()
  sectionId: number;

  @IsOptional()
  birthDate?: any;
}

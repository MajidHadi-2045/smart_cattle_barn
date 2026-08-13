import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateLivestockDto {
  @IsString()
  @IsNotEmpty()
  cattleId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  breed: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsNumber()
  @Min(0, { message: 'initialWeight must be a positive number' })
  @IsNotEmpty()
  initialWeight: number;

  @IsNumber()
  @IsNotEmpty()
  sectionId: number;

  @IsOptional()
  birthDate?: any;
}

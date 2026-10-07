import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({
    description: 'Full name of the artisan / user',
    example: 'Sunita Devi',
  })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MaxLength(100)
  fullName!: string;

  @ApiPropertyOptional({
    description: 'Artisan craft studio or business brand name',
    example: 'Mithila Folk Heritage Creations',
  })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Primary traditional craft specialization',
    example: 'Madhubani Hand Painting',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  craftType?: string;

  @ApiPropertyOptional({
    description: 'Artisan geographic region / cluster / district',
    example: 'Madhubani',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional({
    description: 'State of residence',
    example: 'Bihar',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: 'Preferred interface & notification language code (e.g. "hi", "en", "ta", "mr")',
    example: 'hi',
    default: 'en',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  preferredLanguage?: string;

  @ApiPropertyOptional({
    description: 'Personal bio or story of the artisan and their lineage',
    example: '3rd generation artisan practicing traditional Kachni style painting using natural pigments.',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Public URL of the profile avatar in Supabase storage',
    example: 'https://iaitqhnyouqgcmedlony.supabase.co/storage/v1/object/public/avatars/artisan-1.jpg',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User role: ARTISAN or BUYER',
    example: 'ARTISAN',
  })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({
    description: 'Delivery address used at checkout',
    example: '12, Gandhi Road, Vijayawada, Andhra Pradesh 520001',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: 'User phone number',
    example: '+919876543210',
  })
  @IsString()
  @IsOptional()
  phone?: string;
}

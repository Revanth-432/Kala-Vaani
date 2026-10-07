import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateB2BInquiryDto {
  @ApiProperty({
    description: 'UUID of the craft product for wholesale inquiry',
    example: 'd3b07384-d113-46fb-9c8e-a619001e9d1a',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: "Units wanted; must be at least the product's minimum bulk quantity",
    example: 100,
  })
  @IsInt()
  @Min(1)
  requestedQuantity!: number;

  @ApiProperty({
    description: 'Price per unit (INR) the buyer offers',
    example: 350,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  targetPrice!: number;

  @ApiPropertyOptional({
    description: 'Required delivery timeframe',
    example: 'Within 45 days for Diwali gifting',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryTimeline?: string;

  @ApiPropertyOptional({
    description: 'Specific custom branding, packaging, or dimension requirements',
    example: 'Custom packaging with corporate logo stamp on terracotta base.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

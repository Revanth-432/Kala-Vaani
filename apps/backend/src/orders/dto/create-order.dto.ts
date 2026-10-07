import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({
    description: 'UUID of the product craft',
    example: 'd3b07384-d113-46fb-9c8e-a619001e9d1a',
  })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: 'Quantity to purchase',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'List of order items',
    type: [OrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({
    description: 'Delivery address for the order',
    example: '123 MG Road, Bengaluru, Karnataka, 560001',
  })
  @IsOptional()
  @IsString()
  shippingAddress?: string;

  @ApiPropertyOptional({
    description: 'Buyer contact phone number',
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  buyerPhone?: string;

  @ApiPropertyOptional({
    description: 'Special requests or custom specifications',
    example: 'Please wrap carefully as this is a Diwali festive gift.',
  })
  @IsOptional()
  @IsString()
  buyerNotes?: string;

  @ApiPropertyOptional({
    description: 'COD = cash on delivery (default), ONLINE = pay now with Razorpay (UPI / card / net banking)',
    enum: ['COD', 'ONLINE'],
    default: 'COD',
  })
  @IsOptional()
  @IsIn(['COD', 'ONLINE'])
  paymentMethod?: 'COD' | 'ONLINE';

  @ApiPropertyOptional({
    description:
      'Accepted bulk request to pay for. Its product, quantity and agreed price are used instead of items.',
  })
  @IsOptional()
  @IsUUID()
  inquiryId?: string;
}

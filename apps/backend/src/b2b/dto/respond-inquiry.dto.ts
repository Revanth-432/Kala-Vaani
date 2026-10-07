import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SELLER_ACTIONS = ['ACCEPT', 'COUNTER', 'REJECT'] as const;
export type SellerAction = (typeof SELLER_ACTIONS)[number];

/** Seller's answer to a bulk request */
export class RespondInquiryDto {
  @ApiProperty({ enum: SELLER_ACTIONS, example: 'COUNTER' })
  @IsIn(SELLER_ACTIONS)
  action!: SellerAction;

  @ApiPropertyOptional({ description: 'Price per unit (INR), required for COUNTER', example: 420 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  counterPrice?: number;
}

export const BUYER_ACTIONS = ['ACCEPT', 'DECLINE'] as const;
export type BuyerAction = (typeof BUYER_ACTIONS)[number];

/** Buyer's answer to the seller's counter price */
export class BuyerDecisionDto {
  @ApiProperty({ enum: BUYER_ACTIONS, example: 'ACCEPT' })
  @IsIn(BUYER_ACTIONS)
  action!: BuyerAction;
}

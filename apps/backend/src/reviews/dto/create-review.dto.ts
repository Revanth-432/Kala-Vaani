import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A buyer's star rating and comment for a product they received */
export class CreateReviewDto {
  @ApiProperty({ description: 'UUID of the product being reviewed' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Beautiful work, arrived well packed.' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}

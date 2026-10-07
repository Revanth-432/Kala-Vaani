import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBulkSettingsDto {
  @ApiProperty({
    description: 'Smallest number of units a buyer may ask for in a bulk request',
    example: 25,
    minimum: 2,
  })
  @IsInt()
  @Min(2)
  @Max(100000)
  minBulkQty!: number;
}

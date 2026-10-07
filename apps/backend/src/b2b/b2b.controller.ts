import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { B2BService } from './b2b.service';
import { CreateB2BInquiryDto } from './dto/create-inquiry.dto';
import { RespondInquiryDto, BuyerDecisionDto } from './dto/respond-inquiry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('B2B Wholesale')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('b2b')
export class B2BController {
  constructor(private readonly b2bService: B2BService) {}

  @Post('inquiry')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a bulk wholesale inquiry / RFQ',
    description: 'Enables retail chains, boutiques, and export houses to negotiate bulk orders directly with traditional artisans.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'B2B bulk inquiry created successfully.',
  })
  async createInquiry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateB2BInquiryDto,
  ) {
    return this.b2bService.createInquiry(user.id, dto);
  }

  @Get('inquiries/artisan')
  @ApiOperation({
    summary: 'Retrieve bulk wholesale inquiries for the logged-in artisan',
    description: 'Returns all open wholesale requests received from verified B2B buyers.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Wholesale inquiries retrieved successfully.',
  })
  async getArtisanInquiries(@CurrentUser() user: AuthenticatedUser) {
    return this.b2bService.getArtisanInquiries(user.id);
  }

  @Get('inquiries/buyer')
  @ApiOperation({ summary: 'Bulk requests sent by the logged-in buyer' })
  async getBuyerInquiries(@CurrentUser() user: AuthenticatedUser) {
    return this.b2bService.getBuyerInquiries(user.id);
  }

  @Get('inquiries/:id')
  @ApiOperation({ summary: 'One bulk request (its buyer or seller only)' })
  @ApiParam({ name: 'id', description: 'UUID of the bulk inquiry' })
  async getInquiry(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.b2bService.getInquiry(id, user.id);
  }

  @Post('inquiries/:id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seller answers a bulk request',
    description: "ACCEPT the buyer's price, COUNTER with counterPrice, or REJECT. Only while the request is OPEN.",
  })
  @ApiParam({ name: 'id', description: 'UUID of the bulk inquiry' })
  async respondAsSeller(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RespondInquiryDto,
  ) {
    return this.b2bService.respondAsSeller(id, user.id, dto.action, dto.counterPrice);
  }

  @Post('inquiries/:id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Buyer accepts or declines the seller's counter price",
    description: 'Only while the request is COUNTERED. After ACCEPT the buyer pays through POST /orders with inquiryId.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the bulk inquiry' })
  async respondAsBuyer(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BuyerDecisionDto,
  ) {
    return this.b2bService.respondAsBuyer(id, user.id, dto.action);
  }
}

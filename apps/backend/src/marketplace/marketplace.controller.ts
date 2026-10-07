import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Retrieve marketplace feed of published artisan crafts',
    description:
      'Returns a paginated list of crafts showcasing clean studio photos, artisan details, and fair AI pricing.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feed items retrieved successfully.',
  })
  async getFeed(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.marketplaceService.withStats(
      await this.marketplaceService.getFeed(Number(page) || 1, Number(limit) || 20),
    );
  }

  @Get('search')
  @ApiOperation({
    summary: 'Natural language hybrid search (pgvector + full-text search)',
    description:
      'Converts buyer query to 1536-dimensional embedding and executes cosine similarity matching with full-text search ranking.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Natural language search phrase (e.g. "blue handmade silk saree under 2000")',
    example: 'handmade terracotta diya',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results ranked by relevance.',
  })
  async search(
    @Query('q') query: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.marketplaceService.withStats(
      await this.marketplaceService.semanticSearch(query, Number(limit) || 20),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Retrieve detailed craft profile for buyers',
    description:
      'Returns complete craft information including processed studio cutout, marketing assets, transparent AI pricing, and artisan biography for direct inquiry.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the craft product',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product details retrieved successfully.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Craft product not found.',
  })
  async getProduct(@Param('id') id: string) {
    const product = await this.marketplaceService.getProductDetail(id);
    if (!product) {
      throw new NotFoundException(`Craft with ID ${id} not found`);
    }
    return product;
  }
}

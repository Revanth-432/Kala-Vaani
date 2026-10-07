import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CatalogService } from './catalog.service';
import { SmartPublishDto } from './dto/smart-publish.dto';
import { UpdateBulkSettingsDto } from './dto/update-bulk-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ProductStatus } from '@artisan/database';

@ApiTags('Catalog')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('my-crafts')
  @ApiOperation({
    summary: 'Retrieve all catalog crafts uploaded by current artisan',
  })
  async getMyCrafts(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogService.getMyCrafts(user.id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update craft status (e.g. ARCHIVED or PUBLISHED)',
  })
  async updateCraftStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: ProductStatus,
  ) {
    return this.catalogService.updateStatus(id, user.id, status);
  }

  @Patch(':id/bulk-settings')
  @ApiOperation({
    summary: 'Set the minimum quantity buyers must request for a bulk order',
  })
  async updateBulkSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBulkSettingsDto,
  ) {
    return this.catalogService.updateBulkSettings(id, user.id, dto.minBulkQty);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Permanently delete craft belonging to current artisan',
  })
  async deleteCraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.catalogService.deleteCraft(id, user.id);
  }

  @Post('smart-publish')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publish craft item to catalog with photo, voice note, and AI metadata',
    description:
      'Uploads media to Supabase storage, runs pricing engine valuation, and atomically registers product, translation, metadata, media, and pricing in database.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Craft product photographs (1-5). The first one is the main photo.',
        },
        audio: {
          type: 'string',
          format: 'binary',
          description: 'Spoken craft narrative / voice note (optional)',
        },
        payload: {
          type: 'string',
          description:
            'JSON stringified SmartPublishDto containing title, category, craftType, shortDescription, materials, suggestedPriceRange',
        },
      },
      required: ['image'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Craft published to catalog successfully with all relations.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing required image file or invalid payload.',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 5 },
      { name: 'audio', maxCount: 1 },
    ]),
  )
  async smartPublish(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      audio?: Express.Multer.File[];
    },
    @Body() body: Record<string, any>,
  ) {
    let dto: SmartPublishDto;

    if (body.payload) {
      try {
        dto = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload;
      } catch (err) {
        dto = body as SmartPublishDto;
      }
    } else {
      dto = body as SmartPublishDto;
    }

    const imageFiles = files?.image ?? [];
    const audioFile = files?.audio?.[0];

    return this.catalogService.smartPublish(user, dto, imageFiles, audioFile);
  }
}


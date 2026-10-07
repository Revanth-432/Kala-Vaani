import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CatalogRepository } from './catalog.repository';
import { SupabaseStorageService, UploadResult } from '../storage/supabase-storage.service';
import { PricingService } from '../pricing/pricing.service';
import { SmartPublishDto } from './dto/smart-publish.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UserRepository } from '../users/users.repository';
import { EmbeddingService } from '../search/embedding.service';
import { ProductStatus, MediaType } from '@artisan/database';


@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly storageService: SupabaseStorageService,
    private readonly pricingService: PricingService,
    private readonly userRepository: UserRepository,
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Orchestrates smart catalog publishing:
   * 1. Validates user existence (JIT provisions if needed)
   * 2. Uploads image to 'product-images' bucket
   * 3. Uploads audio (if attached) to 'voice-notes' bucket
   * 4. Calculates pricing tiers via PricingService
   * 5. Atomically creates Product, Translation, Metadata, Media, and Pricing
   */
  async smartPublish(
    user: AuthenticatedUser,
    dto: SmartPublishDto,
    imageFiles: Express.Multer.File[],
    audioFile?: Express.Multer.File,
  ) {
    if (!imageFiles.length) {
      throw new BadRequestException('A product craft image file is required for cataloging.');
    }

    this.logger.log(`Starting smart publish for artisan: ${user.id} - ${dto.title}`);

    // Ensure user exists in our database
    await this.userRepository.ensureUserExists(
      user.id,
      user.email,
      user.phone,
    );

    // 1. Upload craft photos to Supabase Storage (order kept: first = main photo)
    const imageUploads: UploadResult[] = await Promise.all(
      imageFiles.map((file) =>
        this.storageService.uploadFile(file, 'product-images', 'products'),
      ),
    );

    // 2. Upload voice note if provided
    let audioUpload: UploadResult | null = null;
    if (audioFile) {
      audioUpload = await this.storageService.uploadFile(
        audioFile,
        'voice-notes',
        'voice-descriptions',
      );
    }

    // 3. Compute pricing breakdown
    const pricing = this.pricingService.calculateFromAiRange(dto.suggestedPriceRange);

    // 4. Execute atomic database transaction
    const product = await this.catalogRepository.createPublishedProduct({
      artisanId: user.id,
      dto,
      imageUploads,
      audioUpload,
      pricing,
    });

    // 5. Generate and store pgvector semantic embedding for search
    this.embeddingService
      .generateAndSaveProductEmbedding(product.id)
      .catch((err) => {
        this.logger.warn(`Async embedding generation error: ${err.message}`);
      });

    // 6. Fetch full details to return
    const completeProduct = await this.catalogRepository.findProductWithDetails(product.id);

    this.logger.log(`Successfully published craft ${product.id} to catalog.`);
    return completeProduct;
  }

  /**
   * Retrieves all crafts owned by the authenticated artisan
   */
  async getMyCrafts(artisanId: string) {
    const products = await this.catalogRepository.findByArtisanId(artisanId);

    return products.map((p) => {
      const translation = p.translations[0];
      const processedPhoto = p.media.find(
        (m) => m.mediaType === MediaType.PROCESSED_PHOTO,
      );
      const originalPhoto = p.media.find(
        (m) => m.mediaType === MediaType.ORIGINAL_PHOTO,
      );
      const marketingAsset = p.media.find(
        (m) => m.mediaType === MediaType.MARKETING_ASSET,
      );

      const thumbnailUrl =
        processedPhoto?.url || originalPhoto?.url || p.media[0]?.url || null;

      return {
        id: p.id,
        title: translation?.title || 'Handcrafted Craft Item',
        category: p.category,
        craftType: p.metadata?.craftType || null,
        shortDescription: translation?.shortDescription || null,
        price: p.pricing?.aiRecommendedPrice
          ? Number(p.pricing.aiRecommendedPrice)
          : null,
        currency: p.pricing?.currency || 'INR',
        thumbnailUrl,
        marketingUrl: marketingAsset?.url || null,
        status: p.status,
        baseStock: p.baseStock,
        createdAt: p.createdAt,
      };

    });
  }

  /**
   * Updates craft status (ARCHIVED or PUBLISHED)
   */
  async updateStatus(productId: string, artisanId: string, status: ProductStatus) {
    try {
      return await this.catalogRepository.updateProductStatus(productId, artisanId, status);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Could not update craft status');
    }
  }

  /**
   * Sets the smallest bulk-request quantity for one of the artisan's crafts
   */
  async updateBulkSettings(productId: string, artisanId: string, minBulkQty: number) {
    const { count } = await this.prisma.product.updateMany({
      where: { id: productId, artisanId },
      data: { minBulkQty },
    });
    if (count === 0) {
      throw new NotFoundException('Craft not found');
    }
    return { id: productId, minBulkQty };
  }

  /**
   * Deletes craft permanently
   */
  async deleteCraft(productId: string, artisanId: string) {
    try {
      return await this.catalogRepository.deleteProduct(productId, artisanId);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Could not delete craft');
    }
  }
}


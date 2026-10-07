import { effectiveMinBulkQty } from '../common/bulk';
import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { MediaType, ProcessingStatus, Media } from '@artisan/database';

@Injectable()
export class PollinationsApiService {
  private readonly logger = new Logger(PollinationsApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  /**
   * Generates a high-resolution marketing lifestyle poster for an artisan craft
   * using Pollinations AI based on the product's title, craft type, and materials.
   */
  async generateMarketingAsset(
    productId: string,
    artisanId: string,
    scenePrompt?: string,
  ): Promise<Media> {
    // 1. Fetch product and metadata
    const product = await this.prisma.product.findFirst({
      where: { id: productId, artisanId },
      include: {
        translations: true,
        metadata: true,
        pricing: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${productId} not found for this artisan.`,
      );
    }

    const title = product.translations[0]?.title || 'handcrafted artisan product';
    const material = product.metadata?.material || 'natural organic heritage materials';
    const craftType = product.metadata?.craftType || 'traditional Indian folk art';

    // 2. Synthesize rich lifestyle photography prompt
    const promptText =
      scenePrompt?.trim() ||
      `A beautifully handcrafted ${title} made of ${material}, ${craftType} style, resting on a rustic wooden table decorated with festive brass lamps and marigold flowers, illuminated by soft warm morning sunlight, professional cinematic product photography, 4k, hyper-realistic, Indian handicrafts catalogue shoot`;

    this.logger.log(`Generating marketing poster via Pollinations AI with prompt: "${promptText}"`);

    const encodedPrompt = encodeURIComponent(promptText);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}&model=flux`;

    let imageBuffer: Buffer;
    try {
      const response = await fetch(pollinationsUrl, {
        headers: {
          'User-Agent': 'KalaVaani/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Pollinations AI service responded with status ${response.status}`,
        );
      }

      const arrayBuf = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuf);
    } catch (err: any) {
      this.logger.error('Failed to download image from Pollinations AI:', err);
      throw new InternalServerErrorException(
        `Pollinations AI generation failed: ${err.message}`,
      );
    }

    // 3. Upload to Supabase Storage 'marketing-assets' bucket
    const uploadResult = await this.storageService.uploadBuffer(
      imageBuffer,
      `${productId}-marketing-${Date.now()}.jpg`,
      'image/jpeg',
      'marketing-assets',
      'lifestyle-posters',
    );

    // 4. Save to Media table as MARKETING_ASSET
    const marketingMedia = await this.prisma.media.create({
      data: {
        productId,
        storageBucket: uploadResult.bucket,
        storagePath: uploadResult.path,
        url: uploadResult.publicUrl,
        mediaType: MediaType.MARKETING_ASSET,
        processingStatus: ProcessingStatus.COMPLETED,
        displayOrder: 3,
        metadata: {
          prompt: promptText,
          engine: 'pollinations.ai/flux',
          generatedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(
      `Created MARKETING_ASSET media record ${marketingMedia.id} for product ${productId}`,
    );

    return marketingMedia;
  }

  /**
   * Fetch all media and marketing assets for a specific product
   */
  async getProductMarketingDetails(productId: string, artisanId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, artisanId },
      include: {
        translations: true,
        metadata: true,
        pricing: true,
        media: {
          orderBy: { createdAt: 'desc' },
        },
        artisan: { include: { profile: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID ${productId} not found for this artisan.`,
      );
    }

    const [stats, reviews] = await Promise.all([
      this.prisma.getProductStats([product.id]),
      this.prisma.getProductReviews(product.id),
    ]);
    const { buyerCount, rating } = stats.get(product.id)!;

    const originals = product.media
      .filter((m) => m.mediaType === MediaType.ORIGINAL_PHOTO)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const originalPhoto = product.media.find(
      (m) => m.mediaType === MediaType.ORIGINAL_PHOTO,
    );
    const processedPhotos = product.media
      .filter((m) => m.mediaType === MediaType.PROCESSED_PHOTO)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const processedPhoto = processedPhotos[0] || null;
    const marketingAssets = product.media.filter(
      (m) => m.mediaType === MediaType.MARKETING_ASSET,
    );

    return {
      product: {
        id: product.id,
        category: product.category,
        status: product.status,
        title: product.translations[0]?.title || 'Handmade Craft',
        shortDescription: product.translations[0]?.shortDescription || '',
        craftType: product.metadata?.craftType,
        materials: product.metadata?.material,
        pricing: product.pricing,
        buyerCount,
        rating,
        reviews,
        minBulkQty: effectiveMinBulkQty(product.minBulkQty),
      },
      artisan: {
        name: product.artisan.profile?.fullName || null,
        businessName: product.artisan.profile?.businessName || null,
        region: product.artisan.profile?.region || null,
        state: product.artisan.profile?.state || null,
      },
      media: {
        original: originals[0] || originalPhoto || null,
        originals,
        processed: processedPhoto || null,
        processedPhotos,
        marketingAssets,
      },
    };
  }
}

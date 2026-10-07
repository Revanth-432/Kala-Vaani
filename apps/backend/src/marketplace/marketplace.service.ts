import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmbeddingService } from '../search/embedding.service';
import { ProductStatus, MediaType } from '@artisan/database';
import { effectiveMinBulkQty } from '../common/bulk';

export interface FeedItem {
  id: string;
  title: string;
  category: string;
  craftType?: string | null;
  shortDescription?: string | null;
  materials?: string | null;
  artisanName: string;
  artisanRegion?: string | null;
  price?: number | null;
  currency: string;
  thumbnailUrl: string | null;
  marketingUrl?: string | null;
  similarityScore?: number;
  status: string;
  baseStock?: number;
  buyerCount?: number;
  rating?: { average: number | null; count: number };
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Adds the buyer count and star rating to each feed/search card.
   */
  async withStats(items: FeedItem[]): Promise<FeedItem[]> {
    const stats = await this.prisma.getProductStats(items.map((i) => i.id));
    return items.map((item) => ({ ...item, ...stats.get(item.id) }));
  }

  /**
   * Returns a paginated list of published crafts for the marketplace feed.
   */
  async getFeed(page: number = 1, limit: number = 20): Promise<FeedItem[]> {
    const skip = (page - 1) * limit;

    const products = await this.prisma.product.findMany({
      where: {
        status: {
          in: [ProductStatus.PUBLISHED, ProductStatus.IN_REVIEW],
        },
      },
      include: {
        translations: true,
        metadata: true,
        pricing: true,
        media: {
          orderBy: { displayOrder: 'asc' },
        },
        artisan: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

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
        title: translation?.title || 'Handcrafted Artisan Item',
        category: p.category,
        craftType: p.metadata?.craftType,
        shortDescription: translation?.shortDescription,
        materials: p.metadata?.material,
        artisanName: p.artisan.profile?.fullName || 'Heritage Artisan',
        artisanRegion: p.artisan.profile?.region,
        price: p.pricing?.aiRecommendedPrice
          ? Number(p.pricing.aiRecommendedPrice)
          : null,
        currency: p.pricing?.currency || 'INR',
        thumbnailUrl,
        marketingUrl: marketingAsset?.url || null,
        similarityScore: undefined,
        status: p.status,
        baseStock: p.baseStock,
      };
    });
  }


  /**
   * Executes hybrid search combining natural language vector similarity (pgvector <=>)
   * with exact keyword full-text matching.
   */
  async semanticSearch(query: string, limit: number = 20): Promise<FeedItem[]> {
    if (!query || !query.trim()) {
      return this.getFeed(1, limit);
    }

    const trimmedQuery = query.trim();
    this.logger.log(`Performing hybrid semantic search for query: "${trimmedQuery}"`);

    // 1. Generate query embedding vector
    const queryVector = await this.embeddingService.generateEmbedding(trimmedQuery);
    const vectorString = `[${queryVector.join(',')}]`;

    // 2. Attempt raw SQL hybrid query with pgvector cosine distance
    try {
      const rawResults: any[] = await this.prisma.$queryRawUnsafe(
        `
        SELECT 
          p.id,
          p.category,
          p.status,
          p.base_stock,
          pt.title,
          pt.short_description,
          pm.craft_type,
          pm.material,
          pr.ai_recommended_price,
          pr.currency,
          prof.full_name as artisan_name,
          prof.region as artisan_region,
          (
            SELECT m.url FROM media m 
            WHERE m.product_id = p.id 
            ORDER BY 
              CASE 
                WHEN m.media_type = 'PROCESSED_PHOTO' THEN 1 
                WHEN m.media_type = 'ORIGINAL_PHOTO' THEN 2 
                ELSE 3 
              END 
            LIMIT 1
          ) as thumbnail_url,
          (
            SELECT m.url FROM media m 
            WHERE m.product_id = p.id AND m.media_type = 'MARKETING_ASSET'
            LIMIT 1
          ) as marketing_url,
          CASE 
            WHEN pm.embedding IS NOT NULL THEN (1 - (pm.embedding <=> $1::vector))
            ELSE 0.0
          END as similarity_score
        FROM products p
        JOIN product_translations pt ON pt.product_id = p.id AND pt.language_code = 'en'
        LEFT JOIN product_metadata pm ON pm.product_id = p.id
        LEFT JOIN pricings pr ON pr.product_id = p.id
        JOIN users u ON u.id = p.artisan_id
        LEFT JOIN profiles prof ON prof.user_id = u.id
        WHERE 
          p.status IN ('PUBLISHED', 'IN_REVIEW')
          AND (
            pt.title ILIKE ('%' || $2 || '%')
            OR pt.short_description ILIKE ('%' || $2 || '%')
            OR pm.craft_type ILIKE ('%' || $2 || '%')
            OR pm.material ILIKE ('%' || $2 || '%')
            OR p.category ILIKE ('%' || $2 || '%')
            OR (pm.embedding IS NOT NULL AND (1 - (pm.embedding <=> $1::vector)) > 0.2)
          )
        ORDER BY 
          similarity_score DESC,
          p.created_at DESC
        LIMIT $3;
        `,
        vectorString,
        trimmedQuery,
        limit,
      );

      if (rawResults && rawResults.length > 0) {
        return rawResults.map((row) => ({
          id: row.id,
          title: row.title || 'Handcrafted Craft',
          category: row.category,
          craftType: row.craft_type,
          shortDescription: row.short_description,
          materials: row.material,
          artisanName: row.artisan_name || 'Traditional Artisan',
          artisanRegion: row.artisan_region,
          price: row.ai_recommended_price ? Number(row.ai_recommended_price) : null,
          currency: row.currency || 'INR',
          thumbnailUrl: row.thumbnail_url || null,
          marketingUrl: row.marketing_url || null,
          similarityScore: row.similarity_score ? Number(row.similarity_score) : 0,
          status: row.status,
          baseStock: row.base_stock ? Number(row.base_stock) : 10,
        }));
      }
    } catch (sqlErr: any) {
      this.logger.warn(`pgvector raw query notice (falling back to Prisma search): ${sqlErr.message}`);
    }

    // 3. Resilient fallback to Prisma keyword query
    const fallbackProducts = await this.prisma.product.findMany({
      where: {
        status: {
          in: [ProductStatus.PUBLISHED, ProductStatus.IN_REVIEW],
        },
        OR: [
          { category: { contains: trimmedQuery, mode: 'insensitive' } },
          {
            translations: {
              some: {
                OR: [
                  { title: { contains: trimmedQuery, mode: 'insensitive' } },
                  { shortDescription: { contains: trimmedQuery, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            metadata: {
              OR: [
                { craftType: { contains: trimmedQuery, mode: 'insensitive' } },
                { material: { contains: trimmedQuery, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      include: {
        translations: true,
        metadata: true,
        pricing: true,
        media: { orderBy: { displayOrder: 'asc' } },
        artisan: { include: { profile: true } },
      },
      take: limit,
    });

    return fallbackProducts.map((p) => {
      const translation = p.translations[0];
      const thumbnail =
        p.media.find((m) => m.mediaType === MediaType.PROCESSED_PHOTO)?.url ||
        p.media.find((m) => m.mediaType === MediaType.ORIGINAL_PHOTO)?.url ||
        p.media[0]?.url ||
        null;
      const marketing =
        p.media.find((m) => m.mediaType === MediaType.MARKETING_ASSET)?.url || null;

      return {
        id: p.id,
        title: translation?.title || 'Handcrafted Craft Item',
        category: p.category,
        craftType: p.metadata?.craftType,
        shortDescription: translation?.shortDescription,
        materials: p.metadata?.material,
        artisanName: p.artisan.profile?.fullName || 'Traditional Artisan',
        artisanRegion: p.artisan.profile?.region,
        price: p.pricing?.aiRecommendedPrice
          ? Number(p.pricing.aiRecommendedPrice)
          : null,
        currency: p.pricing?.currency || 'INR',
        thumbnailUrl: thumbnail,
        marketingUrl: marketing,
        similarityScore: 0.85,
        status: p.status,
        baseStock: p.baseStock,
      };
    });
  }

  /**
   * Retrieves full product detail for buyers including media gallery, pricing breakdown, and artisan bio.
   */
  async getProductDetail(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        translations: true,
        metadata: true,
        pricing: true,
        media: {
          orderBy: { displayOrder: 'asc' },
        },
        artisan: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    const [stats, reviews] = await Promise.all([
      this.prisma.getProductStats([product.id]),
      this.prisma.getProductReviews(product.id),
    ]);
    const { buyerCount, rating } = stats.get(product.id)!;

    const enTranslation =
      product.translations.find((t) => t.languageCode === 'en') ||
      product.translations[0];

    const processedPhotos = product.media
      .filter((m) => m.mediaType === MediaType.PROCESSED_PHOTO)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const processedPhoto = processedPhotos[0] || null;
    const originalPhoto = product.media.find(
      (m) => m.mediaType === MediaType.ORIGINAL_PHOTO,
    );
    const marketingAssets = product.media.filter(
      (m) => m.mediaType === MediaType.MARKETING_ASSET,
    );

    return {
      id: product.id,
      title: enTranslation?.title || 'Handcrafted Artisan Craft',
      description: enTranslation?.longDescription || enTranslation?.shortDescription || 'Authentic traditional handmade craft.',
      shortDescription: enTranslation?.shortDescription,
      story: enTranslation?.story,
      category: product.category,
      craftType: product.metadata?.craftType,
      material: product.metadata?.material,
      culturalOrigin: product.metadata?.culturalOrigin,
      pattern: product.metadata?.pattern,
      colorPalette: product.metadata?.colorPalette || [],
      dimensions: product.metadata?.dimensions,
      weight: product.metadata?.weight,
      status: product.status,
      baseStock: product.baseStock,
      buyerCount,
      rating,
      reviews,
      minBulkQty: effectiveMinBulkQty(product.minBulkQty),
      createdAt: product.createdAt,

      pricing: {
        recommendedPrice: product.pricing?.aiRecommendedPrice
          ? Number(product.pricing.aiRecommendedPrice)
          : null,
        currency: product.pricing?.currency || 'INR',
        labourHours: product.pricing?.labourHours
          ? Number(product.pricing.labourHours)
          : null,
        labourCost: product.pricing?.labourCost
          ? Number(product.pricing.labourCost)
          : null,
        materialCost: product.pricing?.materialCost
          ? Number(product.pricing.materialCost)
          : null,
      },
      media: {
        thumbnail:
          processedPhoto?.url || originalPhoto?.url || product.media[0]?.url || null,
        processedPhotoUrl: processedPhoto?.url || null,
        processedPhotos: processedPhotos.map((m) => ({
          id: m.id,
          url: m.url,
          angle: (m.metadata as any)?.angle || 'FRONT_CLEAN',
          angleLabel: (m.metadata as any)?.angleLabel || 'Studio Clean Cutout',
        })),
        originalPhotoUrl: originalPhoto?.url || null,
        originalPhotos: product.media
          .filter((m) => m.mediaType === MediaType.ORIGINAL_PHOTO)
          .map((m) => ({ id: m.id, url: m.url })),
        marketingAssets: marketingAssets.map((m) => ({ id: m.id, url: m.url })),
        all: product.media.map((m) => ({
          id: m.id,
          url: m.url,
          mediaType: m.mediaType,
        })),
      },
      artisan: {
        id: product.artisan.id,
        name: product.artisan.profile?.fullName || 'Master Artisan',
        businessName: product.artisan.profile?.businessName,
        bio: product.artisan.profile?.bio,
        region: product.artisan.profile?.region || 'India',
        state: product.artisan.profile?.state,
        craftType: product.artisan.profile?.craftType,
        avatarUrl: product.artisan.profile?.avatarUrl,
        phone: product.artisan.phone || null,
      },
    };
  }
}



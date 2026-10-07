import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@artisan/database';

export interface ProductStats {
  buyerCount: number;
  rating: { average: number | null; count: number };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.includes('[YOUR-PASSWORD]')) {
      this.logger.warn(
        'DATABASE_URL contains placeholder "[YOUR-PASSWORD]". Skipping eager DB connection on boot.',
      );
      this.logger.warn(
        'Update apps/backend/.env with your real Supabase PostgreSQL password to enable live database queries.',
      );
      return;
    }

    try {
      await this.$connect();
      this.logger.log('Prisma connected to PostgreSQL / Supabase successfully.');
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL / Supabase via Prisma:', error);
    }
  }

  /**
   * Buyer count and star rating for each product, in two queries however many
   * products there are. A buyer is counted once per product; cancelled orders
   * and online checkouts that were never paid are not counted.
   */
  async getProductStats(productIds: string[]): Promise<Map<string, ProductStats>> {
    const stats = new Map<string, ProductStats>();
    if (productIds.length === 0) return stats;
    for (const id of productIds) {
      stats.set(id, { buyerCount: 0, rating: { average: null, count: 0 } });
    }

    const [buyerRows, ratingRows] = await Promise.all([
      this.$queryRaw<Array<{ product_id: string; buyers: number }>>`
        SELECT oi.product_id::text AS product_id, COUNT(DISTINCT o.buyer_id)::int AS buyers
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = ANY(${productIds}::uuid[])
          AND o.status <> 'CANCELLED'
          AND (o.razorpay_order_id IS NULL OR o.razorpay_payment_id IS NOT NULL)
        GROUP BY oi.product_id`,
      this.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    for (const row of buyerRows) {
      const s = stats.get(row.product_id);
      if (s) s.buyerCount = Number(row.buyers);
    }
    for (const row of ratingRows) {
      const s = stats.get(row.productId);
      if (s && row._avg.rating !== null) {
        s.rating = {
          average: Math.round(row._avg.rating * 10) / 10,
          count: row._count._all,
        };
      }
    }
    return stats;
  }

  /** Latest reviews for a product, newest first */
  async getProductReviews(productId: string, take = 20) {
    const reviews = await this.review.findMany({
      where: { productId },
      orderBy: { updatedAt: 'desc' },
      take,
      include: { buyer: { include: { profile: true } } },
    });
    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      buyerName: r.buyer.profile?.fullName || 'Buyer',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL / Supabase.');
  }
}

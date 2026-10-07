import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@artisan/database';
import { PrismaService } from '../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Saves the buyer's review. Only buyers whose order for this product was
   * delivered can review it; posting again replaces their earlier review.
   */
  async upsertReview(buyerId: string, dto: CreateReviewDto) {
    const delivered = await this.prisma.order.findFirst({
      where: {
        buyerId,
        status: OrderStatus.DELIVERED,
        items: { some: { productId: dto.productId } },
      },
      select: { id: true },
    });
    if (!delivered) {
      throw new ForbiddenException('You can review an item once it has been delivered to you.');
    }

    const comment = dto.comment?.trim() || null;
    const review = await this.prisma.review.upsert({
      where: { productId_buyerId: { productId: dto.productId, buyerId } },
      create: { productId: dto.productId, buyerId, rating: dto.rating, comment },
      update: { rating: dto.rating, comment },
    });

    this.logger.log(`Review saved for product ${dto.productId} by buyer ${buyerId} (${dto.rating}★)`);
    return review;
  }
}

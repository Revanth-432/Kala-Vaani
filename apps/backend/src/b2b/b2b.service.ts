import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateB2BInquiryDto } from './dto/create-inquiry.dto';
import { BuyerAction, SellerAction } from './dto/respond-inquiry.dto';
import { InquiryStatus, MediaType, ProductStatus } from '@artisan/database';
import { effectiveMinBulkQty } from '../common/bulk';

const INQUIRY_INCLUDE = {
  product: { include: { translations: true, media: true, pricing: true } },
  b2bBuyer: { include: { profile: true } },
  artisan: { include: { profile: true } },
} as const;

/**
 * Bulk orders are negotiated before they become orders:
 *   buyer sends request (OPEN)
 *     -> seller accepts (ACCEPTED) | rejects (REJECTED) | counters (COUNTERED)
 *   COUNTERED -> buyer accepts (ACCEPTED) | declines (DECLINED)
 *   ACCEPTED -> buyer pays at the agreed price (ORDERED, see OrdersService)
 */
@Injectable()
export class B2BService {
  private readonly logger = new Logger(B2BService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createInquiry(buyerId: string, dto: CreateB2BInquiryDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.status === ProductStatus.ARCHIVED) {
      throw new NotFoundException(`Craft product with ID ${dto.productId} not found`);
    }
    if (product.artisanId === buyerId) {
      throw new BadRequestException('You cannot send a bulk request for your own item.');
    }

    const minQty = effectiveMinBulkQty(product.minBulkQty);
    if (dto.requestedQuantity < minQty) {
      throw new BadRequestException(`Bulk orders for this item start at ${minQty} units.`);
    }

    const inquiry = await this.prisma.b2BInquiry.create({
      data: {
        b2bBuyerId: buyerId,
        artisanId: product.artisanId,
        productId: dto.productId,
        requestedQuantity: dto.requestedQuantity,
        targetPrice: dto.targetPrice,
        deliveryTimeline: dto.deliveryTimeline?.trim() || null,
        message: dto.message?.trim() || null,
        status: InquiryStatus.OPEN,
      },
      include: INQUIRY_INCLUDE,
    });

    this.logger.log(
      `B2B Inquiry created: ${inquiry.id} for artisan ${product.artisanId}, qty: ${dto.requestedQuantity} @ ₹${dto.targetPrice}`,
    );
    return this.formatInquiryResponse(inquiry);
  }

  async getArtisanInquiries(artisanId: string) {
    const inquiries = await this.prisma.b2BInquiry.findMany({
      where: { artisanId },
      include: INQUIRY_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return inquiries.map((inq) => this.formatInquiryResponse(inq));
  }

  async getBuyerInquiries(buyerId: string) {
    const inquiries = await this.prisma.b2BInquiry.findMany({
      where: { b2bBuyerId: buyerId },
      include: INQUIRY_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return inquiries.map((inq) => this.formatInquiryResponse(inq));
  }

  /** One request, visible to its buyer and its seller */
  async getInquiry(inquiryId: string, userId: string) {
    const inquiry = await this.prisma.b2BInquiry.findUnique({
      where: { id: inquiryId },
      include: INQUIRY_INCLUDE,
    });
    if (!inquiry || (inquiry.b2bBuyerId !== userId && inquiry.artisanId !== userId)) {
      throw new NotFoundException('Bulk request not found');
    }
    return this.formatInquiryResponse(inquiry);
  }

  /** Seller accepts the buyer's price, counters with their own, or rejects */
  async respondAsSeller(
    inquiryId: string,
    artisanId: string,
    action: SellerAction,
    counterPrice?: number,
  ) {
    const inquiry = await this.findOwned(inquiryId, 'artisanId', artisanId);

    let data: { status: InquiryStatus; counterPrice?: number; agreedPrice?: number };
    if (action === 'ACCEPT') {
      data = { status: InquiryStatus.ACCEPTED, agreedPrice: Number(inquiry.targetPrice) };
    } else if (action === 'COUNTER') {
      if (!counterPrice) {
        throw new BadRequestException('Enter your price per unit.');
      }
      data = { status: InquiryStatus.COUNTERED, counterPrice };
    } else {
      data = { status: InquiryStatus.REJECTED };
    }

    await this.transition(inquiryId, InquiryStatus.OPEN, data);
    this.logger.log(`B2B Inquiry ${inquiryId}: seller ${action}${counterPrice ? ` @ ₹${counterPrice}` : ''}`);
    return this.getInquiry(inquiryId, artisanId);
  }

  /** Buyer accepts or declines the seller's counter price */
  async respondAsBuyer(inquiryId: string, buyerId: string, action: BuyerAction) {
    const inquiry = await this.findOwned(inquiryId, 'b2bBuyerId', buyerId);

    const data =
      action === 'ACCEPT'
        ? { status: InquiryStatus.ACCEPTED, agreedPrice: Number(inquiry.counterPrice) }
        : { status: InquiryStatus.DECLINED };

    await this.transition(inquiryId, InquiryStatus.COUNTERED, data);
    this.logger.log(`B2B Inquiry ${inquiryId}: buyer ${action}`);
    return this.getInquiry(inquiryId, buyerId);
  }

  private async findOwned(inquiryId: string, field: 'artisanId' | 'b2bBuyerId', userId: string) {
    const inquiry = await this.prisma.b2BInquiry.findUnique({ where: { id: inquiryId } });
    if (!inquiry) {
      throw new NotFoundException('Bulk request not found');
    }
    if (inquiry[field] !== userId) {
      throw new ForbiddenException('This bulk request is not yours to answer.');
    }
    return inquiry;
  }

  /** Moves the request on only if it is still in the expected state (no double answers) */
  private async transition(inquiryId: string, from: InquiryStatus, data: Record<string, unknown>) {
    const { count } = await this.prisma.b2BInquiry.updateMany({
      where: { id: inquiryId, status: from },
      data,
    });
    if (count === 0) {
      throw new ConflictException('This request has already been answered. Pull down to refresh.');
    }
  }

  private formatInquiryResponse(inquiry: any) {
    const p = inquiry.product;
    const translation = p?.translations?.[0];
    const thumbnail =
      p?.media?.find((m: any) => m.mediaType === MediaType.PROCESSED_PHOTO)?.url ||
      p?.media?.find((m: any) => m.mediaType === MediaType.ORIGINAL_PHOTO)?.url ||
      p?.media?.[0]?.url ||
      null;
    const money = (v: any) => (v === null || v === undefined ? null : Number(v));

    return {
      id: inquiry.id,
      b2bBuyerId: inquiry.b2bBuyerId,
      artisanId: inquiry.artisanId,
      productId: inquiry.productId,
      productTitle: translation?.title || 'Handcrafted Craft Item',
      thumbnailUrl: thumbnail,
      retailPrice: money(p?.pricing?.aiRecommendedPrice),
      requestedQuantity: inquiry.requestedQuantity,
      targetPrice: money(inquiry.targetPrice),
      counterPrice: money(inquiry.counterPrice),
      agreedPrice: money(inquiry.agreedPrice),
      orderId: inquiry.orderId,
      deliveryTimeline: inquiry.deliveryTimeline,
      message: inquiry.message,
      status: inquiry.status,
      createdAt: inquiry.createdAt,
      updatedAt: inquiry.updatedAt,
      buyerName: inquiry.b2bBuyer?.profile?.fullName || 'Wholesale Buyer',
      buyerBusiness: inquiry.b2bBuyer?.profile?.businessName || null,
      buyerPhone: inquiry.b2bBuyer?.phone || null,
      buyerEmail: inquiry.b2bBuyer?.email || null,
      artisanName: inquiry.artisan?.profile?.fullName || 'Artisan',
      artisanPhone: inquiry.artisan?.phone || null,
    };
  }
}

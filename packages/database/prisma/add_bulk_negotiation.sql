-- Bulk order negotiation: seller threshold, counter/agreed prices, new request states.
-- Additive only; safe to run more than once.
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'COUNTERED';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'ORDERED';

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "min_bulk_qty" INTEGER;

ALTER TABLE "b2b_inquiries" ADD COLUMN IF NOT EXISTS "counter_price" DECIMAL(10,2);
ALTER TABLE "b2b_inquiries" ADD COLUMN IF NOT EXISTS "agreed_price" DECIMAL(10,2);
ALTER TABLE "b2b_inquiries" ADD COLUMN IF NOT EXISTS "order_id" UUID;

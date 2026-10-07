import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

import { StorageModule } from './storage/storage.module';
import { PricingModule } from './pricing/pricing.module';
import { CatalogModule } from './catalog/catalog.module';
import { ImageProcessingModule } from './images/image-processing.module';
import { MarketingModule } from './marketing/marketing.module';
import { SearchModule } from './search/search.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { B2BModule } from './b2b/b2b.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'apps/backend/.env'),
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    StorageModule,
    PricingModule,
    CatalogModule,
    ImageProcessingModule,
    MarketingModule,
    SearchModule,
    MarketplaceModule,
    OrdersModule,
    ReviewsModule,
    B2BModule,
    AdminModule,
  ],
})
export class AppModule {}

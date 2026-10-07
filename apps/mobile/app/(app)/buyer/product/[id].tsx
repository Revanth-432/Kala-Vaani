import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../../src/store/useAuthStore';
import {
  ArrowLeft,
  Share2,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Building2,
} from 'lucide-react-native';
import { getApiBaseUrl } from '../../../../src/lib/api';
import { Text, Button, ScreenHeader, EmptyState, Loading, COLORS } from '../../../../src/components/ui';
import { useT } from '../../../../src/i18n';
import {
  ProductStatsLine,
  ReviewsSection,
  type ProductRating,
  type ProductReview,
} from '../../../../src/components/Reviews';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductDetail {
  id: string;
  title: string;
  description: string;
  shortDescription?: string | null;
  story?: string | null;
  category: string;
  craftType?: string | null;
  material?: string | null;
  culturalOrigin?: string | null;
  pattern?: string | null;
  colorPalette?: string[];
  buyerCount?: number;
  minBulkQty?: number;
  rating?: ProductRating;
  reviews?: ProductReview[];
  pricing: {
    recommendedPrice?: number | null;
    currency: string;
    labourHours?: number | null;
    labourCost?: number | null;
    materialCost?: number | null;
  };
  media: {
    thumbnail: string | null;
    processedPhotoUrl: string | null;
    processedPhotos?: Array<{ id: string; url: string; mediaType?: string; metadata?: any }>;
    originalPhotoUrl: string | null;
    /** The artisan's own photos, main photo first */
    originalPhotos?: Array<{ id: string; url: string }>;
    marketingAssets: Array<{ id: string; url: string }>;
    all: Array<{ id: string; url: string; mediaType: string }>;
  };
  artisan: {
    id: string;
    name: string;
    businessName?: string | null;
    bio?: string | null;
    region?: string | null;
    state?: string | null;
    craftType?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
  };
}

export default function BuyerProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();
  const isFetchingRef = React.useRef(false);

  // Role Protection Guard: If an artisan ever opens buyer product view, send to Artisan Studio
  useEffect(() => {
    if (!isLoading && role === 'ARTISAN') {
      router.replace(`/(app)/product/${id}` as any);
    }
  }, [role, isLoading, id]);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const galleryRef = React.useRef<ScrollView>(null);

  const getBaseApiUrl = () => {
    return getApiBaseUrl();
  };

  useEffect(() => {
    if (!id || isFetchingRef.current) return;
    isFetchingRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const fetchProduct = async () => {
      try {
        const res = await fetch(`${getBaseApiUrl()}/marketplace/${id}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: ProductDetail = await res.json();
          setProduct(data);
        } else {
          Alert.alert(t('common.couldNotLoad'), t('common.checkInternet'));
        }
      } catch (err) {
        console.warn('Failed to fetch product details:', err);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchProduct();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [id]);

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `Look at this authentic handmade craft: ${product.title} by ${product.artisan?.name || 'Traditional Artisan'}! Supporting Indian traditional artisans.`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleContactWhatsApp = () => {
    if (!product) return;
    const phone = product.artisan?.phone || '+919876543210';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = `Namaste! I saw your handcrafted "${product.title}" on the Kala Vaani platform. I would like to inquire about ordering.`;
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback to web WhatsApp or Phone dialer
          return Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`);
        }
      })
      .catch(() => {
        Alert.alert(t('buyer.madeBy'), phone);
      });
  };

  const handleCallArtisan = () => {
    if (!product) return;
    const phone = product.artisan?.phone || '+919876543210';
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-artisan-canvas">
        <ScreenHeader title={t('buyer.item')} onBack={() => router.back()} />
        <Loading />
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 bg-artisan-canvas">
        <ScreenHeader title={t('buyer.item')} onBack={() => router.back()} />
        <View className="flex-1 justify-center p-4">
          <EmptyState
            icon={ShoppingBag}
            title={t('buyer.itemNotFound')}
            action={<Button label={t('common.goBack')} icon={ArrowLeft} onPress={() => router.back()} />}
          />
        </View>
      </View>
    );
  }

  // Gallery: the artisan's real photos first -> studio photos -> older posters
  const galleryImages: Array<{ url: string; label: string; tag: string }> = [];
  const uniqueUrls = new Set<string>();

  const addImageToGallery = (url: string | null | undefined, label: string, tag: string) => {
    if (!url || uniqueUrls.has(url)) return;
    uniqueUrls.add(url);
    galleryImages.push({ url, label, tag });
  };

  (product.media.originalPhotos ?? []).forEach((photo, idx) => {
    addImageToGallery(photo.url, `Photo ${idx + 1}`, 'Original');
  });
  addImageToGallery(product.media.originalPhotoUrl, 'Original', 'Original');

  if (product.media.processedPhotos && product.media.processedPhotos.length > 0) {
    product.media.processedPhotos.forEach((photo, idx) => {
      addImageToGallery(photo.url, `Photo ${idx + 1}`, 'Studio');
    });
  } else if (product.media.processedPhotoUrl) {
    addImageToGallery(product.media.processedPhotoUrl, 'Studio', 'Studio');
  }

  product.media.marketingAssets.forEach((asset, idx) => {
    addImageToGallery(asset.url, `Scene ${idx + 1}`, 'Poster');
  });

  if (galleryImages.length === 0 && product.media.thumbnail) {
    addImageToGallery(product.media.thumbnail, 'Photo', 'Photo');
  }

  const activeImage = galleryImages[selectedImageIndex] || galleryImages[0];

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader
        title={product.title}
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={handleShare}
            accessibilityLabel="Share"
            className="h-12 w-12 items-center justify-center rounded-xl bg-artisan-light"
          >
            <Share2 color={COLORS.ink} size={22} />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" keyboardShouldPersistTaps="handled">
        {/* Main image — swipe for more photos */}
        <View className="w-full bg-stone-100" style={{ height: SCREEN_WIDTH * 0.9 }}>
          {activeImage ? (
            <View key="gallery">
              <ScrollView
                ref={galleryRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setSelectedImageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
                }
              >
                {galleryImages.map((item, index) => (
                  <Image
                    key={item.url}
                    source={{ uri: item.url }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.9 }}
                    resizeMode="contain"
                  />
                ))}
              </ScrollView>
              {galleryImages.length > 1 ? (
                <View
                  key="counter"
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
                    {selectedImageIndex + 1} / {galleryImages.length}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="h-full w-full items-center justify-center bg-artisan-light">
              <ShoppingBag color={COLORS.primary} size={64} />
            </View>
          )}
        </View>

        {/* Thumbnails */}
        {galleryImages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="border-b border-artisan-border bg-white"
            contentContainerStyle={{ padding: 12, gap: 10 }}
          >
            {galleryImages.map((item, index) => {
              const isSelected = index === selectedImageIndex;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setSelectedImageIndex(index);
                    galleryRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
                  }}
                  activeOpacity={0.8}
                  className="overflow-hidden rounded-xl"
                  style={{
                    width: 72,
                    height: 72,
                    borderWidth: 3,
                    borderColor: isSelected ? COLORS.primary : 'transparent',
                  }}
                >
                  <Image source={{ uri: item.url }} className="h-full w-full" resizeMode="cover" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Title + price */}
        <View className="border-b border-artisan-border bg-white p-4">
          <Text className="text-base font-semibold text-artisan-primary">
            {product.craftType || product.category || 'Handmade'}
            {product.culturalOrigin ? ` · ${product.culturalOrigin}` : ''}
          </Text>
          <Text className="mt-1 text-2xl font-bold text-artisan-slate">{product.title}</Text>
          <View className="mt-2 flex-row items-center">
            <Text className="text-3xl font-bold text-artisan-success">
              ₹{product.pricing.recommendedPrice || 499}
            </Text>
            <View className="ml-3 flex-row items-center rounded-full bg-green-50 px-3 py-1">
              <ShieldCheck color={COLORS.success} size={16} />
              <Text className="ml-1 text-sm font-bold text-artisan-success">{t('buyer.fairPrice')}</Text>
            </View>
          </View>
          <View className="mt-2">
            <ProductStatsLine buyerCount={product.buyerCount} rating={product.rating} emptyKey="product.beFirst" />
          </View>

          <Text className="mt-4 text-base leading-6 text-artisan-slate">
            {product.story || product.description || t('buyer.handmadeDefault')}
          </Text>

          {product.material || product.pattern ? (
            <View className="mt-4 rounded-xl bg-stone-50 p-3">
              {product.material ? (
                <View className="flex-row justify-between py-1">
                  <Text className="text-base text-artisan-muted">{t('buyer.material')}</Text>
                  <Text className="ml-4 flex-1 text-right text-base font-semibold text-artisan-slate">
                    {product.material}
                  </Text>
                </View>
              ) : null}
              {product.pattern ? (
                <View className="flex-row justify-between py-1">
                  <Text className="text-base text-artisan-muted">{t('buyer.style')}</Text>
                  <Text className="ml-4 flex-1 text-right text-base font-semibold text-artisan-slate">
                    {product.pattern}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Maker */}
        <View className="mt-3 border-b border-artisan-border bg-white p-4">
          <Text className="text-lg font-bold text-artisan-slate">{t('buyer.madeBy')}</Text>
          <View className="mt-3 flex-row items-center">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-artisan-light">
              <Text className="text-2xl font-bold text-artisan-primary">
                {(product.artisan?.name || 'A').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-lg font-bold text-artisan-slate">
                {product.artisan?.name || 'Artisan'}
              </Text>
              <View className="flex-row items-center">
                <MapPin color={COLORS.primary} size={15} />
                <Text className="ml-1 text-base text-artisan-muted">
                  {product.artisan?.region || 'India'}
                  {product.artisan?.state ? `, ${product.artisan.state}` : ''}
                </Text>
              </View>
            </View>
          </View>
          {product.artisan?.bio ? (
            <Text className="mt-3 text-base text-artisan-muted">{product.artisan.bio}</Text>
          ) : null}

          <View className="mt-4 flex-row" style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={handleContactWhatsApp}
              className="h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 border-green-600 bg-green-50"
            >
              <MessageCircle color={COLORS.success} size={20} />
              <Text className="ml-2 text-base font-bold text-artisan-success">WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCallArtisan}
              className="h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 border-artisan-border bg-white"
            >
              <Phone color={COLORS.ink} size={20} />
              <Text className="ml-2 text-base font-bold text-artisan-slate">{t('orders.call')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reviews */}
        <View className="mt-3 border-b border-artisan-border bg-white p-4">
          <ReviewsSection rating={product.rating} reviews={product.reviews} />
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Sticky actions */}
      <View
        className="flex-row border-t border-artisan-border bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}
      >
        <View className="flex-1">
          <Button
            label={t('buyer.buyPrice', { p: product.pricing.recommendedPrice || 499 })}
            icon={ShoppingBag}
            onPress={() => router.push(`/(app)/buyer/checkout?productId=${product.id}` as any)}
          />
        </View>
        <Button
          label={t('buyer.bulk')}
          sublabel={product.minBulkQty ? t('bulk.fromUnits', { n: product.minBulkQty }) : undefined}
          icon={Building2}
          variant="secondary"
          onPress={() => router.push(`/(app)/buyer/b2b-request?productId=${product.id}` as any)}
        />
      </View>
    </View>
  );
}

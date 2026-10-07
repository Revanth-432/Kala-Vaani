import React, { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Share,
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Sparkles,
  Share2,
  RefreshCw,
  Image as ImageIcon,
  Layers,
  PackageX,
} from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { supabase } from '../../../src/lib/supabase';
import { getApiBaseUrl } from '../../../src/lib/api';
import {
  Text,
  Button,
  ScreenHeader,
  EmptyState,
  Loading,
  StatusChip,
  SectionTitle,
  COLORS,
} from '../../../src/components/ui';
import { useT } from '../../../src/i18n';
import { BulkMinSetting } from '../../../src/components/BulkRequests';
import {
  ProductStatsLine,
  ReviewsSection,
  type ProductRating,
  type ProductReview,
} from '../../../src/components/Reviews';
import { PosterMaker } from '../../../src/components/PosterMaker';

interface MediaItem {
  id: string;
  url: string;
  mediaType: string;
  metadata?: any;
  createdAt: string;
}

interface ProductDetails {
  product: {
    id: string;
    category: string;
    status: string;
    title: string;
    shortDescription: string;
    craftType?: string;
    materials?: string;
    buyerCount?: number;
    minBulkQty?: number;
    rating?: ProductRating;
    reviews?: ProductReview[];
    pricing?: {
      aiMinPrice: number;
      aiRecommendedPrice: number;
      aiPremiumPrice: number;
      currency: string;
    };
  };
  artisan?: {
    name: string | null;
    businessName: string | null;
    region: string | null;
    state: string | null;
  };
  media: {
    original: MediaItem | null;
    /** All of the artisan's own photos, main photo first */
    originals?: MediaItem[];
    processed: MediaItem | null;
    processedPhotos?: MediaItem[];
    marketingAssets: MediaItem[];
  };
}

export default function ProductMarketingScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const { id, poster } = useLocalSearchParams<{ id: string; poster?: string }>();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();

  // Role Protection Guard: Buyers cannot access artisan studio
  useEffect(() => {
    if (!isLoading && role && (role === 'BUYER' || role === 'B2B_BUYER')) {
      setTimeout(() => {
        router.replace(`/(app)/buyer/product/${id}` as any);
      }, 0);
    }
  }, [role, isLoading, id]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'processed'>('original');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState(0);
  const carouselRef = React.useRef<ScrollView>(null);

  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  const [originalIndex, setOriginalIndex] = useState(0);
  const posterAutoOpenedRef = React.useRef(false);
  const isFetchingRef = React.useRef(false);

  const getBaseApiUrl = () => {
    return getApiBaseUrl();
  };

  const getAccessToken = async (): Promise<string | null> => {
    const { session } = useAuthStore.getState();
    if (session?.access_token) return session.access_token;
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token || null;
  };

  const fetchProductDetails = async () => {
    if (!id || isFetchingRef.current) return;
    isFetchingRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      setLoading(true);
      const token = await getAccessToken();
      const apiUrl = `${getBaseApiUrl()}/marketing/${id}`;

      const res = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Failed to load product (status ${res.status})`);
      }

      const json: ProductDetails = await res.json();
      setData(json);

      if (json.media.processed) {
        setActiveTab('processed');
      }
    } catch (err: any) {
      console.error('Fetch product details error:', err);
      Alert.alert(t('common.couldNotLoad'), t('common.checkInternet'));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (role === 'BUYER' || role === 'B2B_BUYER') return;
    fetchProductDetails();
  }, [id, role, isLoading]);

  useEffect(() => {
    if (data && poster === '1' && !posterAutoOpenedRef.current) {
      posterAutoOpenedRef.current = true;
      setIsPosterOpen(true);
    }
  }, [data, poster]);

  // Clean background trigger
  const handleCleanBackground = async () => {
    if (!id) return;

    try {
      setIsProcessingBg(true);
      const token = await getAccessToken();
      const url = `${getBaseApiUrl()}/images/${id}/process-background`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.json();
        throw new Error(errorBody.message || 'Background removal failed');
      }

      Alert.alert(
                t('product.photosReadyTitle'),
        t('product.photosReadyMsg'),
      );
      await fetchProductDetails();
      setActiveTab('processed');
      setSelectedAngleIndex(0);
    } catch (err: any) {
      console.error('Background removal error:', err);
      Alert.alert(t('product.photosFailed'), t('common.tryLater'));
    } finally {
      setIsProcessingBg(false);
    }
  };

  // Share poster via React Native native share
  const handleShare = async (assetUrl: string) => {
    try {
      const title = data?.product.title || 'Handcrafted Craft';
      const craftType = data?.product.craftType || 'Traditional Folk Art';
      const price = data?.product.pricing?.aiRecommendedPrice;

      await Share.share({
        title,
        message: `✨ Look at this authentic handmade craft: "${title}" (${craftType})!\n\n${data?.product.shortDescription || ''}\n\nPrice: ₹${price || 'Fair valuation'}\n\nPhoto link: ${assetUrl}`,
        url: assetUrl,
      });
    } catch (error: any) {
      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-artisan-canvas">
        <ScreenHeader title={t('product.title')} onBack={() => router.back()} />
        <Loading />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-artisan-canvas">
        <ScreenHeader title={t('product.title')} onBack={() => router.back()} />
        <View className="flex-1 justify-center p-4">
          <EmptyState
            icon={PackageX}
            title={t('product.notFound')}
            action={
              <Button label={t('common.goBack')} icon={ArrowLeft} onPress={() => router.back()} />
            }
          />
        </View>
      </View>
    );
  }

  const { product, media } = data;
  const SCREEN_WIDTH = Dimensions.get('window').width;
  const CAROUSEL_WIDTH = Math.min(SCREEN_WIDTH - 32, 420);
  const CAROUSEL_HEIGHT = Math.round(CAROUSEL_WIDTH * 0.85);

  const myPhotos: MediaItem[] =
    media.originals && media.originals.length > 0
      ? media.originals
      : media.original
      ? [media.original]
      : [];

  const studioPhotos =
    media.processedPhotos && media.processedPhotos.length > 0
      ? media.processedPhotos
      : media.processed
      ? [media.processed]
      : [];

  const getAngleBadge = (item: MediaItem, index: number) => {
    const angle = item.metadata?.angle || '';
    if (angle === 'SIDE_VIEW') return { title: t('product.angleSide') };
    if (angle === 'TOP_DOWN') return { title: t('product.angleTop') };
    if (angle === 'CLOSE_UP') return { title: t('product.angleClose') };
    if (angle === 'FRONT_CLEAN') return { title: t('product.angleFront') };
    return { title: t('product.anglePhoto', { n: index + 1 }) };
  };

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader
        title={t('product.title')}
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={fetchProductDetails}
            accessibilityLabel="Refresh"
            className="h-12 w-12 items-center justify-center rounded-xl bg-artisan-light"
          >
            <RefreshCw color={COLORS.ink} size={22} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Photos */}
        <View className="mb-4 overflow-hidden rounded-2xl border border-artisan-border bg-white">
          {activeTab === 'processed' ? (
            studioPhotos.length > 0 ? (
              <View key="studio">
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={CAROUSEL_WIDTH}
                  onMomentumScrollEnd={(e) => {
                    const offsetX = e.nativeEvent.contentOffset.x;
                    const index = Math.round(offsetX / CAROUSEL_WIDTH);
                    if (index >= 0 && index < studioPhotos.length) {
                      setSelectedAngleIndex(index);
                    }
                  }}
                  style={{ width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT }}
                >
                  {studioPhotos.map((photo, idx) => (
                    <View
                      key={photo.id || idx}
                      style={{ width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT }}
                      className="items-center justify-center bg-stone-50"
                    >
                      <Image
                        source={{ uri: photo.url }}
                        style={{ width: CAROUSEL_WIDTH - 24, height: CAROUSEL_HEIGHT - 24 }}
                        resizeMode="contain"
                      />
                      <View className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1">
                        <Text className="text-sm font-bold text-white">
                          {idx + 1} / {studioPhotos.length}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {studioPhotos.length > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="border-t border-artisan-border bg-stone-50"
                    contentContainerStyle={{ padding: 8, gap: 8 }}
                  >
                    {studioPhotos.map((photo, chipIdx) => {
                      const isSelected = selectedAngleIndex === chipIdx;
                      return (
                        <TouchableOpacity
                          key={photo.id || chipIdx}
                          onPress={() => {
                            setSelectedAngleIndex(chipIdx);
                            carouselRef.current?.scrollTo({
                              x: chipIdx * CAROUSEL_WIDTH,
                              animated: true,
                            });
                          }}
                          className="h-11 justify-center rounded-full px-4"
                          style={{
                            backgroundColor: isSelected ? COLORS.primary : '#FFFFFF',
                            borderWidth: 1,
                            borderColor: isSelected ? COLORS.primary : COLORS.border,
                          }}
                        >
                          <Text
                            className="text-base font-semibold"
                            style={{ color: isSelected ? '#FFFFFF' : COLORS.ink }}
                          >
                            {getAngleBadge(photo, chipIdx).title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : null}
              </View>
            ) : (
              <View
                key="no-studio"
                style={{ height: CAROUSEL_HEIGHT }}
                className="items-center justify-center bg-stone-50 p-6"
              >
                <Layers color={COLORS.primary} size={40} />
                <Text className="mt-3 text-center text-lg font-bold text-artisan-slate">
                                    {t('product.noNewPhotos')}
                </Text>
              </View>
            )
          ) : myPhotos.length > 0 ? (
            <View key="original">
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={CAROUSEL_WIDTH}
                onMomentumScrollEnd={(e) =>
                  setOriginalIndex(Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_WIDTH))
                }
                style={{ width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT }}
              >
                {myPhotos.map((photo, idx) => (
                  <View
                    key={photo.id || idx}
                    style={{ width: CAROUSEL_WIDTH, height: CAROUSEL_HEIGHT }}
                    className="items-center justify-center bg-stone-50"
                  >
                    <Image
                      source={{ uri: photo.url }}
                      style={{ width: CAROUSEL_WIDTH - 24, height: CAROUSEL_HEIGHT - 24 }}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
              {myPhotos.length > 1 ? (
                <View
                  key="dots"
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 0,
                    right: 0,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {myPhotos.map((photo, idx) => (
                    <View
                      key={photo.id || idx}
                      style={{
                        width: idx === originalIndex ? 18 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: idx === originalIndex ? COLORS.primary : 'rgba(0,0,0,0.25)',
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View
              key="no-image"
              style={{ height: CAROUSEL_HEIGHT }}
              className="items-center justify-center bg-stone-50"
            >
              <ImageIcon color={COLORS.muted} size={40} />
              <Text className="mt-2 text-base text-artisan-muted">{t('product.noPhoto')}</Text>
            </View>
          )}

          {/* Original vs new photos */}
          <View className="flex-row border-t border-artisan-border bg-stone-50 p-2" style={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setActiveTab('original')}
              className="h-12 flex-1 flex-row items-center justify-center rounded-xl"
              style={{
                backgroundColor: activeTab === 'original' ? '#FFFFFF' : 'transparent',
                borderWidth: 2,
                borderColor: activeTab === 'original' ? COLORS.primary : 'transparent',
              }}
            >
              <ImageIcon color={activeTab === 'original' ? COLORS.primary : COLORS.muted} size={20} />
              <Text
                className="ml-2 text-base font-bold"
                style={{ color: activeTab === 'original' ? COLORS.primary : COLORS.muted }}
              >
                                {t('product.myPhotos', { n: myPhotos.length })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (studioPhotos.length > 0) {
                  setActiveTab('processed');
                } else {
                  Alert.alert(
                                        t('product.noNewPhotos'),
                    t('product.tapMorePhotos'),
                  );
                }
              }}
              className="h-12 flex-1 flex-row items-center justify-center rounded-xl"
              style={{
                backgroundColor: activeTab === 'processed' ? '#FFFFFF' : 'transparent',
                borderWidth: 2,
                borderColor: activeTab === 'processed' ? COLORS.primary : 'transparent',
              }}
            >
              <Layers color={activeTab === 'processed' ? COLORS.primary : COLORS.muted} size={20} />
              <Text
                className="ml-2 text-base font-bold"
                style={{ color: activeTab === 'processed' ? COLORS.primary : COLORS.muted }}
              >
                {t('product.newPhotos', { n: studioPhotos.length })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details */}
        <View className="mb-5 rounded-2xl border border-artisan-border bg-white p-4">
          <StatusChip status={product.status} />
          <Text className="mt-2 text-2xl font-bold text-artisan-slate">{product.title}</Text>
          {product.pricing ? (
            <Text className="mt-1 text-2xl font-bold text-artisan-success">
              ₹{product.pricing.aiMinPrice} – ₹{product.pricing.aiPremiumPrice}
            </Text>
          ) : null}
          <View className="mt-2">
            <ProductStatsLine buyerCount={product.buyerCount} rating={product.rating} emptyKey="product.boughtNone" />
          </View>
          {product.shortDescription ? (
            <Text className="mt-2 text-base leading-6 text-artisan-slate">
              {product.shortDescription}
            </Text>
          ) : null}
          {product.materials ? (
            <Text className="mt-2 text-base text-artisan-muted">{t('product.madeOf', { m: product.materials })}</Text>
          ) : null}
        </View>

        {/* Bulk order threshold */}
        <View className="mb-5 rounded-2xl border border-artisan-border bg-white p-4">
          <BulkMinSetting key={product.id} productId={product.id} initial={product.minBulkQty ?? 10} />
        </View>

        {/* Buyer reviews */}
        <View className="mb-5 rounded-2xl border border-artisan-border bg-white p-4">
          <ReviewsSection rating={product.rating} reviews={product.reviews} />
        </View>

        {/* Actions */}
        <View className="mb-6" style={{ gap: 12 }}>
          <Button
            label={t('product.makePoster')}
            sublabel={t('poster.hint')}
            icon={Sparkles}
            onPress={() => setIsPosterOpen(true)}
          />
          {studioPhotos.length === 0 ? (
            <Button
              key="btn-more-photos"
              label={t('product.morePhotos')}
              icon={Layers}
              variant="secondary"
              loading={isProcessingBg}
              onPress={handleCleanBackground}
            />
          ) : null}
        </View>

        {/* Posters made earlier (older AI posters) */}
        {media.marketingAssets.length === 0 ? null : (
          <View key="posters">
            <SectionTitle title={t('product.posters', { n: media.marketingAssets.length })} />
            {media.marketingAssets.map((asset, index) => (
              <View
                key={asset.id || index}
                className="mb-4 overflow-hidden rounded-2xl border border-artisan-border bg-white"
              >
                <Image source={{ uri: asset.url }} className="h-80 w-full" resizeMode="cover" />
                <View className="p-3">
                  <Button
                    label={t('product.shareWhatsApp')}
                    icon={Share2}
                    variant="success"
                    onPress={() => handleShare(asset.url)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={isPosterOpen}
        animationType="slide"
        onRequestClose={() => setIsPosterOpen(false)}
      >
        {isPosterOpen ? (
          <PosterMaker
            key="poster-maker"
            photos={(myPhotos.length > 0 ? myPhotos : studioPhotos).map((m) => m.url)}
            info={{
              title: product.title,
              price:
                product.pricing?.aiRecommendedPrice != null
                  ? Number(product.pricing.aiRecommendedPrice)
                  : null,
              craftType: product.craftType || null,
              artisanName: data.artisan?.businessName || data.artisan?.name || null,
              place: [data.artisan?.region, data.artisan?.state].filter(Boolean).join(', ') || null,
            }}
            onClose={() => setIsPosterOpen(false)}
          />
        ) : null}
      </Modal>
    </View>
  );
}

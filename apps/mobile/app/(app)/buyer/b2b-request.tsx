import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Building2,
  Package,
  Calendar,
  IndianRupee,
  MessageCircle,
  ShoppingBag,
  Store,
} from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { getApiBaseUrl } from '../../../src/lib/api';
import {
  Text,
  Input,
  IconInput,
  Button,
  Field,
  ScreenHeader,
  Loading,
  COLORS,
} from '../../../src/components/ui';
import { useT } from '../../../src/i18n';

interface ProductDetail {
  id: string;
  title: string;
  category: string;
  craftType?: string | null;
  material?: string | null;
  pricing: {
    recommendedPrice?: number | null;
    b2bWholesalePrice?: number | null;
    minWholesaleQty?: number;
  };
  minBulkQty?: number;
  media: {
    thumbnail: string | null;
  };
  artisan: {
    id: string;
    name: string;
    phone?: string | null;
    region?: string | null;
  };
}

export default function BuyerB2BRequestScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { session, role, isLoading } = useAuthStore();

  // Role Protection Guard
  useEffect(() => {
    if (!isLoading && role === 'ARTISAN') {
      router.replace('/(app)/dashboard');
    }
  }, [role, isLoading, router]);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [requestedQuantity, setRequestedQuantity] = useState('50');
  const [targetPrice, setTargetPrice] = useState('');
  const [deliveryTimeline, setDeliveryTimeline] = useState('Within 30-45 days');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inquiryCreated, setInquiryCreated] = useState<any | null>(null);

  const getBaseApiUrl = () => {
    return getApiBaseUrl();
  };

  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      try {
        const res = await fetch(`${getBaseApiUrl()}/marketplace/${productId}`);
        if (res.ok) {
          const data: ProductDetail = await res.json();
          setProduct(data);
          if (data.minBulkQty) {
            setRequestedQuantity(String(data.minBulkQty));
          }
          if (data.pricing.recommendedPrice) {
            // Suggest ~20% wholesale discount
            const suggestedWholesale = Math.round(data.pricing.recommendedPrice * 0.8);
            setTargetPrice(suggestedWholesale.toString());
          }
        }
      } catch (err) {
        console.warn('Failed to load product for B2B inquiry:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const handleSubmitInquiry = async () => {
    const qty = parseInt(requestedQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      Alert.alert(t('buyer.qtyTitle'), t('buyer.qtyMsg'));
      return;
    }
    if (qty < minQty) {
      Alert.alert(t('bulk.minQtyTitle'), t('bulk.minQtyMsg', { n: minQty }));
      return;
    }

    const price = parseFloat(targetPrice);
    if (!price || price <= 0) {
      Alert.alert(t('bulk.priceTitle'), t('bulk.priceMsg'));
      return;
    }

    if (!session?.access_token) {
      Alert.alert(t('common.loginRequired'), t('common.logInFirst'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseApiUrl()}/b2b/inquiry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: product!.id,
          requestedQuantity: qty,
          targetPrice: Math.round(price * 100) / 100,
          deliveryTimeline: deliveryTimeline.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInquiryCreated(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        Alert.alert(t('buyer.notSent'), errData.message || t('common.somethingWrong'));
      }
    } catch (err) {
      console.warn('B2B Inquiry error:', err);
      Alert.alert(t('common.noConnection'), t('common.checkInternet'));
    } finally {
      setSubmitting(false);
    }
  };

  const minQty = product?.minBulkQty || 10;

  if (loading) {
    return (
      <View className="flex-1 bg-artisan-canvas">
        <ScreenHeader title={t('buyer.bulkOrder')} onBack={() => router.back()} />
        <Loading />
      </View>
    );
  }

  if (inquiryCreated) {
    return (
      <View
        className="flex-1 items-center justify-center bg-artisan-canvas p-4"
        style={{ paddingTop: Math.max(insets.top, 20) }}
      >
        <View className="w-full items-center rounded-2xl border border-artisan-border bg-white p-5">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-artisan-light">
            <Building2 color={COLORS.primary} size={48} />
          </View>
          <Text className="mt-4 text-center text-2xl font-bold text-artisan-slate">{t('buyer.requestSent')}</Text>
          <Text className="mt-1 text-center text-base text-artisan-muted">
                        {t('buyer.willReply')}
          </Text>

          <View className="my-4 w-full rounded-xl bg-stone-50 p-4">
            <View className="flex-row justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('buyer.request')}</Text>
              <Text className="text-base font-bold text-artisan-slate">
                #{inquiryCreated.id.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('buyer.quantity')}</Text>
              <Text className="text-base font-bold text-artisan-slate">
                {inquiryCreated.requestedQuantity}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('buyer.yourPrice')}</Text>
              <Text className="text-base font-bold text-artisan-success">
                {inquiryCreated.targetPrice
                  ? t('buyer.eachPrice', { p: inquiryCreated.targetPrice })
                  : t('buyer.artisanWillQuote')}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('onb.artisan')}</Text>
              <Text className="text-base font-bold text-artisan-slate">{product?.artisan.name}</Text>
            </View>
          </View>

          <Text className="mb-3 text-center text-base text-artisan-muted">{t('bulk.trackHint')}</Text>

          <View className="w-full" style={{ gap: 10 }}>
            <Button
              label={t('bulk.tabRequests')}
              icon={Building2}
              onPress={() => router.replace('/(app)/buyer-orders?tab=bulk' as any)}
            />
            {Boolean(product?.artisan?.phone) ? (
              <Button
                label={t('buyer.chatWhatsApp')}
                icon={MessageCircle}
                variant="success"
                onPress={() => {
                  const text = `Namaste ${product?.artisan.name}! I submitted wholesale RFQ #${inquiryCreated.id.slice(0, 8).toUpperCase()} for ${inquiryCreated.requestedQuantity} units of "${product?.title}". Let's discuss production timeline and sample delivery.`;
                  Linking.openURL(
                    `whatsapp://send?phone=${product?.artisan.phone!.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(text)}`,
                  );
                }}
              />
            ) : null}
            <Button
              label={t('buyer.backToShop')}
              icon={Store}
              variant="ghost"
              onPress={() => router.replace('/(app)/buyer/feed' as any)}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader title={t('buyer.bulkOrder')} subtitle={t('buyer.askPrice')} onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {product ? (
          <View className="mb-4 flex-row items-center rounded-2xl border border-artisan-border bg-white p-3">
            <View className="h-20 w-20 overflow-hidden rounded-xl bg-stone-100">
              {product.media.thumbnail ? (
                <Image source={{ uri: product.media.thumbnail }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center bg-artisan-light">
                  <ShoppingBag color={COLORS.primary} size={28} />
                </View>
              )}
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-lg font-bold text-artisan-slate" numberOfLines={2}>
                {product.title}
              </Text>
              <Text className="text-sm text-artisan-muted">
                {t('common.by', { name: product.artisan.name })} · {product.artisan.region || 'India'}
              </Text>
              <Text className="text-base text-artisan-muted">
                {t('buyer.retailEach', { p: product.pricing.recommendedPrice || 499 })}
              </Text>
            </View>
          </View>
        ) : null}

        <View className="rounded-2xl border border-artisan-border bg-white p-4">
          <Field label={t('buyer.howMany')} hint={t('bulk.fromUnits', { n: minQty })}>
            <IconInput
              icon={Package}
              value={requestedQuantity}
              onChangeText={setRequestedQuantity}
              placeholder={String(minQty)}
              keyboardType="number-pad"
            />
          </Field>
          <Field
            label={t('buyer.pricePerPiece')}
            hint={
              parseFloat(targetPrice) > 0 && parseInt(requestedQuantity, 10) > 0
                ? t('bulk.total', {
                    p: Math.round(parseFloat(targetPrice) * parseInt(requestedQuantity, 10) * 100) / 100,
                  })
                : undefined
            }
          >
            <IconInput
              icon={IndianRupee}
              value={targetPrice}
              onChangeText={setTargetPrice}
              placeholder="e.g. 350"
              keyboardType="number-pad"
            />
          </Field>
          <Field label={t('buyer.neededBy')}>
            <IconInput
              icon={Calendar}
              value={deliveryTimeline}
              onChangeText={setDeliveryTimeline}
              placeholder={t('buyer.neededByPh')}
            />
          </Field>
          <Field label={t('buyer.notesOptional')} className="mb-0">
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder={t('buyer.notesPh')}
              multiline
              numberOfLines={4}
            />
          </Field>
        </View>
      </ScrollView>

      <View
        className="border-t border-artisan-border bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          label={t('buyer.sendRequest')}
          icon={Building2}
          loading={submitting}
          onPress={handleSubmitInquiry}
        />
      </View>
    </View>
  );
}

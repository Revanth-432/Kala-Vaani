import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Image,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ShoppingBag,
  ShieldCheck,
  MapPin,
  Phone,
  CheckCircle2,
  Store,
  Banknote,
  Smartphone,
  Clock,
  type LucideIcon,
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
  Stepper,
  COLORS,
} from '../../../src/components/ui';
import { useT } from '../../../src/i18n';
import {
  RazorpayCheckout,
  type RazorpayPaymentDetails,
  type RazorpaySuccess,
} from '../../../src/components/RazorpayCheckout';

type PaymentMethod = 'COD' | 'ONLINE';

interface ProductDetail {
  id: string;
  title: string;
  category: string;
  craftType?: string | null;
  pricing: {
    recommendedPrice?: number | null;
    currency: string;
    labourHours?: number | null;
  };
  media: {
    thumbnail: string | null;
  };
  baseStock?: number;
  artisan: {
    id: string;
    name: string;
    region?: string | null;
  };
}


export default function BuyerCheckoutScreen() {
  const { productId, inquiryId } = useLocalSearchParams<{ productId?: string; inquiryId?: string }>();
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
  const [quantity, setQuantity] = useState(1);
  // Paying for an agreed bulk request: quantity and price are fixed
  const [bulk, setBulk] = useState<{ id: string; quantity: number; agreedPrice: number } | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  // Online order already saved on the server, waiting for payment
  const [pendingOnline, setPendingOnline] = useState<{ orderId: string; payment: RazorpayPaymentDetails } | null>(null);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [addressFromProfile, setAddressFromProfile] = useState(false);
  const addressEditedRef = useRef(false);

  const getBaseApiUrl = () => {
    return getApiBaseUrl();
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        let id = productId;
        if (inquiryId) {
          const res = await fetch(`${getBaseApiUrl()}/b2b/inquiries/${inquiryId}`, {
            headers: { Authorization: `Bearer ${useAuthStore.getState().session?.access_token}` },
          });
          if (res.ok) {
            const inquiry = await res.json();
            id = inquiry.productId;
            if (inquiry.agreedPrice) {
              setBulk({
                id: inquiry.id,
                quantity: inquiry.requestedQuantity,
                agreedPrice: Number(inquiry.agreedPrice),
              });
              setQuantity(inquiry.requestedQuantity);
            }
          }
        }
        if (!id) return;

        const res = await fetch(`${getBaseApiUrl()}/marketplace/${id}`);
        if (res.ok) {
          const data: ProductDetail = await res.json();
          setProduct(data);
        }
      } catch (err) {
        console.warn('Failed to load product for checkout:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, inquiryId]);

  // Fill address and phone from the buyer's profile (saved from their last order)
  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;

    fetch(`${getBaseApiUrl()}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        const savedAddress: string = me.profile?.address || '';
        const savedPhone: string = me.phone || session?.user?.user_metadata?.phone || '';
        if (savedAddress && !addressEditedRef.current) {
          setShippingAddress(savedAddress);
          setAddressFromProfile(true);
        }
        if (savedPhone) {
          setBuyerPhone((current) => (current.trim() ? current : savedPhone));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const unitPrice = bulk ? bulk.agreedPrice : product?.pricing.recommendedPrice || 499;
  const totalAmount = Math.round(unitPrice * quantity * 100) / 100;

  const handlePlaceOrder = async () => {
    if (!product) return;

    if (!shippingAddress.trim()) {
      Alert.alert(t('buyer.addressTitle'), t('buyer.addressMsg'));
      return;
    }

    if (!buyerPhone.trim()) {
      Alert.alert(t('buyer.phoneTitle'), t('buyer.phoneMsg'));
      return;
    }

    if (!session?.access_token) {
      Alert.alert(t('common.loginRequired'), t('common.logInFirst'));
      return;
    }

    // Order already saved and waiting for payment: don't create a second one
    if (pendingOnline) {
      if (paymentMethod === 'ONLINE') {
        setShowRazorpay(true);
      } else {
        await switchToCashOnDelivery();
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseApiUrl()}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: [
            {
              productId: product.id,
              quantity,
            },
          ],
          shippingAddress: shippingAddress.trim(),
          buyerPhone: buyerPhone.trim(),
          buyerNotes: buyerNotes.trim() || undefined,
          paymentMethod,
          inquiryId: bulk?.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.payment) {
          setPendingOnline({ orderId: data.id, payment: data.payment });
          setShowRazorpay(true);
        } else {
          setOrderConfirmed(data);
        }
      } else if (paymentMethod === 'ONLINE' && res.status === 503) {
        // Razorpay keys missing or Razorpay down: suggest cash on delivery
        setPaymentMethod('COD');
        Alert.alert(t('buyer.payOnline'), t('buyer.onlineNotReady'));
      } else {
        const errorData = await res.json().catch(() => ({}));
        Alert.alert(t('buyer.orderFailed'), errorData.message || t('common.somethingWrong'));
      }
    } catch (err) {
      console.warn('Place order error:', err);
      Alert.alert(t('common.noConnection'), t('common.checkInternet'));
    } finally {
      setSubmitting(false);
    }
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
  });

  const handlePaymentSuccess = async (result: RazorpaySuccess) => {
    setShowRazorpay(false);
    if (!pendingOnline) return;
    setVerifying(true);
    try {
      const res = await fetch(`${getBaseApiUrl()}/orders/${pendingOnline.orderId}/payment/verify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error(`verify failed (${res.status})`);
      const data = await res.json();
      setPendingOnline(null);
      setOrderConfirmed(data);
    } catch (err) {
      console.warn('Payment verification error:', err);
      Alert.alert(t('buyer.paymentNotDone'), t('buyer.paymentVerifyFailed'));
    } finally {
      setVerifying(false);
    }
  };

  const switchToCashOnDelivery = async () => {
    if (!pendingOnline) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseApiUrl()}/orders/${pendingOnline.orderId}/payment/cod`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`switch to COD failed (${res.status})`);
      const data = await res.json();
      setPendingOnline(null);
      setPaymentMethod('COD');
      setOrderConfirmed(data);
    } catch (err) {
      console.warn('Switch to COD error:', err);
      Alert.alert(t('common.noConnection'), t('common.checkInternet'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentDismiss = (message = t('buyer.paymentNotDoneMsg')) => {
    setShowRazorpay(false);
    Alert.alert(t('buyer.paymentNotDone'), message, [
      { text: t('common.tryAgain'), onPress: () => setShowRazorpay(true) },
      { text: t('buyer.cod'), onPress: switchToCashOnDelivery },
      { text: t('profile.cancel'), style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-artisan-canvas">
        <ScreenHeader title={t('buyer.checkout')} onBack={() => router.back()} />
        <Loading />
      </View>
    );
  }

  if (orderConfirmed) {
    return (
      <View
        className="flex-1 items-center justify-center bg-artisan-canvas p-4"
        style={{ paddingTop: Math.max(insets.top, 20) }}
      >
        <View className="w-full items-center rounded-2xl border border-artisan-border bg-white p-5">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 color={COLORS.success} size={56} />
          </View>
          <Text className="mt-4 text-center text-2xl font-bold text-artisan-slate">{t('buyer.orderPlaced')}</Text>
          <Text className="mt-1 text-center text-base text-artisan-muted">
                        {t('buyer.artisanWillConfirm')}
          </Text>

          <View className="mt-4 w-full rounded-xl bg-stone-50 p-4">
            <View className="flex-row justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('buyer.order')}</Text>
              <Text className="text-base font-bold text-artisan-slate">
                #{orderConfirmed.id ? orderConfirmed.id.slice(0, 8).toUpperCase() : 'CONFIRMED'}
              </Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('common.total')}</Text>
              <Text className="text-base font-bold text-artisan-success">
                ₹{orderConfirmed.totalAmount || totalAmount}
              </Text>
            </View>
            <View className="flex-row items-center justify-between py-1">
              <Text className="text-base text-artisan-muted">{t('buyer.payment')}</Text>
              {orderConfirmed.paymentStatus === 'PAID' ? (
                <View key="paid" className="flex-row items-center">
                  <CheckCircle2 color={COLORS.success} size={18} />
                  <Text className="ml-1 text-base font-bold text-artisan-success">{t('buyer.paymentDone')}</Text>
                </View>
              ) : (
                <View key="cod" className="flex-row items-center">
                  <Banknote color={COLORS.ink} size={18} />
                  <Text className="ml-1 text-base font-bold text-artisan-slate">
                    {t('buyer.payOnDelivery', { p: orderConfirmed.totalAmount || totalAmount })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="mt-5 w-full" style={{ gap: 10 }}>
            <Button
              label={t('buyer.viewMyOrders')}
              icon={ShoppingBag}
              onPress={() => router.replace('/(app)/buyer-orders')}
            />
            <Button
              label={t('buyer.keepShopping')}
              icon={Store}
              variant="ghost"
              onPress={() => router.replace('/(app)/buyer/feed')}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader title={t('buyer.checkout')} onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {product ? (
          <View className="mb-4 rounded-2xl border border-artisan-border bg-white p-3">
            <View className="flex-row items-center">
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
                <Text className="text-sm text-artisan-muted">{t('common.by', { name: product.artisan.name })}</Text>
                <Text className="text-xl font-bold text-artisan-success">₹{unitPrice}</Text>
              </View>
            </View>

            {bulk ? (
              <View key="bulk-qty" className="mt-3 border-t border-artisan-border pt-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-artisan-slate">{t('buyer.quantity')}</Text>
                  <Text className="text-xl font-bold text-artisan-slate">{quantity}</Text>
                </View>
                <View className="mt-1 flex-row items-center">
                  <ShieldCheck color={COLORS.success} size={16} />
                  <Text className="ml-1.5 flex-1 text-sm text-artisan-muted">{t('bulk.lockedQty')}</Text>
                </View>
              </View>
            ) : (
            <View key="retail-qty" className="mt-3 flex-row items-center justify-between border-t border-artisan-border pt-3">
                <View>
                  <Text className="text-lg font-bold text-artisan-slate">{t('buyer.quantity')}</Text>
                  {product?.baseStock ? (
                    <Text className="text-sm text-artisan-muted">{t('buyer.max', { n: product.baseStock })}</Text>
                  ) : null}
                </View>
                <Stepper
                  value={quantity}
                  onMinus={() => !pendingOnline && setQuantity(Math.max(1, quantity - 1))}
                  onPlus={() => {
                    if (pendingOnline) return;
                    const limit = product?.baseStock || 10;
                    if (quantity >= limit) {
                      Alert.alert(t('buyer.limitTitle'), t('buyer.limitMsg', { n: limit }));
                      return;
                    }
                    setQuantity(quantity + 1);
                  }}
                />
              </View>
            )}
          </View>
        ) : null}

        <View className="mb-4 rounded-2xl border border-artisan-border bg-white p-4">
          <Text className="mb-3 text-lg font-bold text-artisan-slate">{t('buyer.delivery')}</Text>
          <Field
            label={t('buyer.address')}
            hint={addressFromProfile ? t('buyer.addressFromProfile') : undefined}
          >
            <Input
              value={shippingAddress}
              onChangeText={(text) => {
                addressEditedRef.current = true;
                setShippingAddress(text);
                setAddressFromProfile(false);
              }}
              placeholder={t('buyer.addressPh')}
              multiline
              numberOfLines={3}
            />
          </Field>
          <Field label={t('onb.phone')}>
            <IconInput
              icon={Phone}
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              placeholder="98765 43210"
              keyboardType="phone-pad"
            />
          </Field>
          <Field label={t('buyer.noteOptional')} className="mb-0">
            <IconInput
              icon={MapPin}
              value={buyerNotes}
              onChangeText={setBuyerNotes}
              placeholder={t('buyer.notePh')}
            />
          </Field>
        </View>

        <View className="mb-4 rounded-2xl border border-artisan-border bg-white p-4">
          <Text className="mb-3 text-lg font-bold text-artisan-slate">{t('buyer.howToPay')}</Text>
          <View style={{ gap: 10 }}>
            <PayOption
              icon={Banknote}
              title={t('buyer.cod')}
              subtitle={t('buyer.codSub')}
              selected={paymentMethod === 'COD'}
              onPress={() => setPaymentMethod('COD')}
            />
            <PayOption
              icon={Smartphone}
              title={t('buyer.payOnline')}
              subtitle={t('buyer.payOnlineSub')}
              selected={paymentMethod === 'ONLINE'}
              onPress={() => setPaymentMethod('ONLINE')}
            />
          </View>
          {paymentMethod === 'ONLINE' ? (
            <View key="secured" className="mt-3 flex-row items-center">
              <ShieldCheck color={COLORS.success} size={16} />
              <Text className="ml-1.5 text-sm text-artisan-muted">{t('buyer.securedBy')}</Text>
            </View>
          ) : null}
        </View>

        <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <View className="flex-row justify-between py-1">
            <Text className="text-base text-green-900">
              {quantity} × ₹{unitPrice}
            </Text>
            <Text className="text-base font-semibold text-green-900">₹{totalAmount}</Text>
          </View>
          <View className="flex-row justify-between py-1">
            <Text className="text-base text-green-900">{t('buyer.platformFee')}</Text>
            <Text className="text-base font-semibold text-green-900">₹0</Text>
          </View>
          <View className="mt-2 flex-row items-center justify-between border-t border-green-200 pt-2">
            <Text className="text-lg font-bold text-green-950">{t('common.total')}</Text>
            <Text className="text-2xl font-bold text-green-950">₹{totalAmount}</Text>
          </View>
          <View className="mt-2 flex-row items-center">
            <ShieldCheck color={COLORS.success} size={18} />
            <Text className="ml-1.5 text-sm text-green-900">{t('buyer.toArtisan')}</Text>
          </View>
        </View>
      </ScrollView>

      <View
        className="border-t border-artisan-border bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {pendingOnline ? (
          <View key="pending-note" className="mb-2 flex-row items-center justify-center">
            <Clock color={COLORS.amber} size={16} />
            <Text className="ml-1.5 text-sm font-semibold" style={{ color: COLORS.amber }}>
              {t('pay.pending')}
            </Text>
          </View>
        ) : null}
        <Button
          label={
            verifying
              ? t('buyer.verifying')
              : paymentMethod === 'ONLINE'
              ? t('buyer.payNow', { p: totalAmount })
              : t('buyer.placeOrder', { p: totalAmount })
          }
          icon={paymentMethod === 'ONLINE' ? Smartphone : CheckCircle2}
          variant="success"
          loading={submitting || verifying}
          onPress={handlePlaceOrder}
        />
      </View>

      <Modal
        visible={showRazorpay && !!pendingOnline}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => handlePaymentDismiss()}
      >
        {showRazorpay && pendingOnline ? (
          <RazorpayCheckout
            key={pendingOnline.payment.razorpayOrderId}
            payment={pendingOnline.payment}
            prefill={{
              name: session?.user?.user_metadata?.full_name || undefined,
              email: session?.user?.email || undefined,
              contact: buyerPhone.trim() || undefined,
            }}
            onSuccess={handlePaymentSuccess}
            onDismiss={() => handlePaymentDismiss()}
            onFailure={() => handlePaymentDismiss(t('buyer.onlineNotReady'))}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function PayOption({
  icon: Icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="flex-row items-center rounded-2xl p-3"
      style={{
        borderWidth: 2,
        borderColor: selected ? COLORS.primary : COLORS.border,
        backgroundColor: selected ? '#FFF7F2' : '#FFFFFF',
      }}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: selected ? COLORS.primary : COLORS.light }}
      >
        <Icon color={selected ? '#FFFFFF' : COLORS.primary} size={24} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-lg font-bold text-artisan-slate">{title}</Text>
        <Text className="text-sm text-artisan-muted">{subtitle}</Text>
      </View>
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ borderWidth: 2, borderColor: selected ? COLORS.primary : COLORS.border }}
      >
        {selected ? (
          <View key="dot" className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.primary }} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

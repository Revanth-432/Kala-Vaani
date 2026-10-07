import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Package,
  ShoppingBag,
  MapPin,
  Store,
  Star,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { getApiBaseUrl } from '../../src/lib/api';
import {
  Text,
  Button,
  ScreenHeader,
  EmptyState,
  Loading,
  StatusChip,
  PaymentChip,
  COLORS,
} from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { Stars, RateItemModal } from '../../src/components/Reviews';
import { BulkRequestsList, OrdersTabs } from '../../src/components/BulkRequests';

interface OrderItem {
  id: string;
  productId: string;
  title: string;
  quantity: number;
  priceAtPurchase: number;
  thumbnailUrl: string | null;
  myReview?: { rating: number; comment: string | null } | null;
}

interface BuyerOrder {
  id: string;
  totalAmount: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod?: 'COD' | 'ONLINE';
  paymentStatus?: 'PENDING' | 'PAID';
  shippingAddress?: string | null;
  createdAt: string;
  artisanName: string;
  items: OrderItem[];
}

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();
  const isFetchingRef = React.useRef(false);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<'orders' | 'bulk'>(tab === 'bulk' ? 'bulk' : 'orders');

  useEffect(() => {
    if (tab === 'bulk') setView('bulk');
  }, [tab]);

  // Role Protection Guard
  React.useEffect(() => {
    if (!isLoading && role === 'ARTISAN') {
      router.replace('/(app)/orders');
    }
  }, [role, isLoading, router]);

  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rateTarget, setRateTarget] = useState<OrderItem | null>(null);

  // Show the new rating right away on every order line for that product
  const handleReviewSaved = (review: { rating: number; comment: string | null }) => {
    const productId = rateTarget?.productId;
    setRateTarget(null);
    if (!productId) return;
    setOrders((prev) =>
      prev.map((order) => ({
        ...order,
        items: order.items.map((i) => (i.productId === productId ? { ...i, myReview: review } : i)),
      })),
    );
  };

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isSilent) setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const state = useAuthStore.getState();
      let token = state.session?.access_token;
      if (!token) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData.session?.access_token;
      }

      if (!token) {
        clearTimeout(timeoutId);
        setOrders([]);
        return;
      }

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/orders/buyer`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
        } else {
          setOrders([]);
        }
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      console.warn('Failed to fetch buyer orders:', err?.message || err);
      setOrders([]);
    } finally {
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(true);
  }, [fetchOrders]);

  const renderOrderCard = ({ item }: { item: BuyerOrder }) => (
    <View className="mb-4 rounded-2xl border border-artisan-border bg-white p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-bold text-artisan-slate" numberOfLines={1}>
            {item.artisanName || 'Artisan'}
          </Text>
          <Text className="text-sm text-artisan-muted">#{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={{ gap: 6 }}>
          <StatusChip status={item.status} />
          <PaymentChip method={item.paymentMethod} status={item.paymentStatus} />
        </View>
      </View>

      <View className="mt-3">
        {item.items && item.items.length > 0
          ? item.items.map((orderItem) => (
              <View key={orderItem.id} className="mb-2 flex-row items-center">
                <View className="h-16 w-16 overflow-hidden rounded-xl bg-stone-100">
                  {orderItem.thumbnailUrl ? (
                    <Image source={{ uri: orderItem.thumbnailUrl }} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-artisan-light">
                      <ShoppingBag color={COLORS.primary} size={24} />
                    </View>
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-artisan-slate" numberOfLines={1}>
                    {orderItem.title}
                  </Text>
                  <Text className="text-base text-artisan-muted">
                    {orderItem.quantity} × ₹{orderItem.priceAtPurchase}
                  </Text>
                  {item.status === 'DELIVERED' ? (
                    <TouchableOpacity
                      key="rate"
                      onPress={() => setRateTarget(orderItem)}
                      className="mt-1 flex-row items-center self-start"
                      hitSlop={8}
                    >
                      {orderItem.myReview ? (
                        <>
                          <Stars value={orderItem.myReview.rating} size={16} />
                          <Text className="ml-2 text-sm font-bold text-artisan-primary">{t('reviews.edit')}</Text>
                        </>
                      ) : (
                        <>
                          <Star color={COLORS.primary} size={16} />
                          <Text className="ml-1 text-sm font-bold text-artisan-primary">{t('reviews.rate')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          : null}
      </View>

      {Boolean(item.shippingAddress) ? (
        <View className="mt-1 flex-row items-start rounded-xl bg-stone-50 p-3">
          <MapPin color={COLORS.muted} size={18} />
          <Text className="ml-2 flex-1 text-base text-artisan-slate">{item.shippingAddress}</Text>
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center justify-between border-t border-artisan-border pt-3">
        <Text className="text-base text-artisan-muted">{t('common.total')}</Text>
        <Text className="text-2xl font-bold text-artisan-slate">₹{item.totalAmount}</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader
        title={`${t('buyer.myOrders')} (${orders.length})`}
        onBack={() => router.navigate('/(app)/buyer/feed' as any)}
      />
      <OrdersTabs value={view} onChange={setView} ordersLabel={t('tabs.orders')} />

      {view === 'bulk' ? (
        <View key="bulk" className="flex-1">
          <BulkRequestsList side="buyer" />
        </View>
      ) : loading ? (
        <View key="loading" className="flex-1">
          <Loading />
        </View>
      ) : (
        <FlatList
          key="list"
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={Package}
              title={t('buyer.noOrders')}
              action={
                <Button
                  label={t('buyer.startShopping')}
                  icon={Store}
                  onPress={() => router.navigate('/(app)/buyer/feed' as any)}
                />
              }
            />
          }
        />
      )}

      <RateItemModal
        visible={!!rateTarget}
        productId={rateTarget?.productId ?? ''}
        productTitle={rateTarget?.title ?? ''}
        initialRating={rateTarget?.myReview?.rating ?? 0}
        initialComment={rateTarget?.myReview?.comment ?? ''}
        onClose={() => setRateTarget(null)}
        onSaved={handleReviewSaved}
      />
    </View>
  );
}

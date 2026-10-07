import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Package,
  CheckCircle2,
  Truck,
  Phone,
  MapPin,
  ShoppingBag,
  RefreshCw,
  MessageSquare,
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
import { BulkRequestsList, OrdersTabs } from '../../src/components/BulkRequests';

interface OrderItem {
  id: string;
  productId: string;
  title: string;
  quantity: number;
  priceAtPurchase: number;
  thumbnailUrl: string | null;
}

interface Order {
  id: string;
  buyerName: string;
  buyerPhone?: string | null;
  shippingAddress?: string | null;
  buyerNotes?: string | null;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod?: 'COD' | 'ONLINE';
  paymentStatus?: 'PENDING' | 'PAID';
  createdAt: string;
  items: OrderItem[];
}

export default function ArtisanOrdersScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();
  const isFetchingRef = React.useRef(false);
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<'orders' | 'bulk'>(tab === 'bulk' ? 'bulk' : 'orders');

  // Guard: If a buyer ever navigates here, redirect immediately to buyer orders
  useEffect(() => {
    if (!isLoading && role && (role === 'BUYER' || role === 'B2B_BUYER')) {
      router.replace('/(app)/buyer-orders');
    }
  }, [role, isLoading, router]);

  // ONLY original database values — initialized strictly to empty array
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch only original orders from the backend database (stabilized with empty deps)
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
      const res = await fetch(`${baseUrl}/orders/artisan`, {
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
        console.warn('Orders API returned non-OK status:', res.status);
        setOrders([]);
      }
    } catch (err: any) {
      console.warn('Failed to fetch artisan orders:', err?.message || err);
      setOrders([]);
    } finally {
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch when tab becomes active (guaranteed stable callback)
  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(true);
  }, [fetchOrders]);

  // Status transition handler for authentic database updates
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED',
  ) => {
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );

    const state = useAuthStore.getState();
    let token = state.session?.access_token;
    if (!token) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData.session?.access_token;
    }
    if (!token) return;

    setUpdatingId(orderId);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        console.warn('Failed to update order status on server:', res.status);
        // Refresh to revert to DB state on failure
        fetchOrders(true);
      }
    } catch (err) {
      console.warn('Update order network warning:', err);
      fetchOrders(true);
    } finally {
      setUpdatingId(null);
    }
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const isBusy = updatingId === item.id;

    return (
      <View className="mb-4 rounded-2xl border border-artisan-border bg-white p-4">
        {/* Buyer + status */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-lg font-bold text-artisan-slate" numberOfLines={1}>
              {item.buyerName}
            </Text>
            <Text className="text-sm text-artisan-muted">
              #{item.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <StatusChip status={item.status} />
            <PaymentChip method={item.paymentMethod} status={item.paymentStatus} />
          </View>
        </View>

        {/* Items */}
        <View className="mt-3">
          {item.items && item.items.length > 0 ? (
            item.items.map((orderItem) => (
              <View key={orderItem.id} className="mb-2 flex-row items-center">
                <View className="h-16 w-16 overflow-hidden rounded-xl bg-stone-100">
                  {orderItem.thumbnailUrl ? (
                    <Image
                      source={{ uri: orderItem.thumbnailUrl }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
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
                    {t('common.pieces', { n: orderItem.quantity })} × ₹{orderItem.priceAtPurchase}
                  </Text>
                </View>
              </View>
            ))
          ) : null}
        </View>

        {/* Address & note */}
        {Boolean(item.shippingAddress) || Boolean(item.buyerNotes) ? (
          <View className="mt-1 rounded-xl bg-stone-50 p-3">
            {Boolean(item.shippingAddress) ? (
              <View className="flex-row items-start">
                <MapPin color={COLORS.muted} size={18} />
                <Text className="ml-2 flex-1 text-base text-artisan-slate">
                  {item.shippingAddress}
                </Text>
              </View>
            ) : null}
            {Boolean(item.buyerNotes) ? (
              <View className="mt-1 flex-row items-start">
                <MessageSquare color={COLORS.muted} size={18} />
                <Text className="ml-2 flex-1 text-base text-artisan-muted">
                  {item.buyerNotes}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Total + call */}
        <View className="mt-3 flex-row items-center justify-between border-t border-artisan-border pt-3">
          <View>
            <Text className="text-sm text-artisan-muted">{t('common.total')}</Text>
            <Text className="text-2xl font-bold text-artisan-success">₹{item.totalAmount}</Text>
          </View>
          {item.buyerPhone ? (
            <TouchableOpacity
              onPress={() => {
                if (item.buyerPhone) {
                  Linking.openURL(`tel:${item.buyerPhone}`);
                }
              }}
              activeOpacity={0.8}
              className="h-12 flex-row items-center rounded-xl border-2 border-artisan-success bg-green-50 px-4"
            >
              <Phone color={COLORS.success} size={20} />
              <Text className="ml-2 text-base font-bold text-artisan-success">{t('orders.call')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Next step */}
        <View className="mt-3">
          {item.status === 'PENDING' ? (
            <Button
              key="accept"
              label={t('orders.accept')}
              icon={CheckCircle2}
              loading={isBusy}
              onPress={() => handleUpdateOrderStatus(item.id, 'CONFIRMED')}
            />
          ) : null}
          {item.status === 'CONFIRMED' ? (
            <Button
              key="ship"
              label={t('orders.markSent')}
              icon={Truck}
              loading={isBusy}
              onPress={() => handleUpdateOrderStatus(item.id, 'SHIPPED')}
            />
          ) : null}
          {item.status === 'SHIPPED' ? (
            <Button
              key="deliver"
              label={t('orders.markDelivered')}
              icon={CheckCircle2}
              variant="success"
              loading={isBusy}
              onPress={() => handleUpdateOrderStatus(item.id, 'DELIVERED')}
            />
          ) : null}
          {item.status === 'DELIVERED' ? (
            <View className="h-12 flex-row items-center justify-center rounded-xl bg-green-50">
              <CheckCircle2 color={COLORS.success} size={22} />
              <Text className="ml-2 text-base font-bold text-artisan-success">
                {t('orders.completed')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader
        title={`${t('tabs.orders')} (${orders.length})`}
        onBack={() => router.navigate('/(app)/dashboard')}
      />
      <OrdersTabs value={view} onChange={setView} ordersLabel={t('tabs.orders')} />

      {view === 'bulk' ? (
        <View key="bulk" className="flex-1">
          <BulkRequestsList side="seller" />
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
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 110,
            flexGrow: 1,
          }}
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
              title={t('orders.empty')}
              action={
                <Button
                  label={t('common.refresh')}
                  icon={RefreshCw}
                  variant="secondary"
                  onPress={() => onRefresh()}
                />
              }
            />
          }
        />
      )}
    </View>
  );
}

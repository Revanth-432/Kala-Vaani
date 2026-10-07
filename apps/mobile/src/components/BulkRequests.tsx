import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Building2,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Send,
  Clock,
  CreditCard,
  Phone,
} from 'lucide-react-native';
import { Text, Button, IconInput, Field, EmptyState, Loading, COLORS } from './ui';
import { useT, type TranslateFn } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import { useAuthStore } from '../store/useAuthStore';
import { getApiBaseUrl } from '../lib/api';

export type BulkStatus =
  | 'OPEN'
  | 'COUNTERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DECLINED'
  | 'ORDERED'
  | 'RESPONDED'
  | 'CLOSED';

export interface BulkRequest {
  id: string;
  productId: string;
  productTitle: string;
  thumbnailUrl: string | null;
  retailPrice: number | null;
  requestedQuantity: number;
  targetPrice: number | null;
  counterPrice: number | null;
  agreedPrice: number | null;
  orderId: string | null;
  deliveryTimeline?: string | null;
  message?: string | null;
  status: BulkStatus;
  buyerName: string;
  buyerBusiness?: string | null;
  buyerPhone?: string | null;
  artisanName: string;
  updatedAt: string;
}

type Side = 'seller' | 'buyer';

const STATUS_STYLE: Record<BulkStatus, { seller: TranslationKey; buyer: TranslationKey; color: string; bg: string }> = {
  OPEN: { seller: 'bulk.st.new', buyer: 'bulk.st.waitSeller', color: COLORS.amber, bg: '#FEF3C7' },
  COUNTERED: { seller: 'bulk.st.waitBuyer', buyer: 'bulk.st.countered', color: COLORS.info, bg: '#DBEAFE' },
  ACCEPTED: { seller: 'bulk.st.accepted', buyer: 'bulk.st.accepted', color: COLORS.success, bg: '#DCFCE7' },
  ORDERED: { seller: 'bulk.st.ordered', buyer: 'bulk.st.ordered', color: COLORS.success, bg: '#DCFCE7' },
  REJECTED: { seller: 'bulk.st.rejected', buyer: 'bulk.st.rejected', color: COLORS.error, bg: '#FEE2E2' },
  DECLINED: { seller: 'bulk.st.declined', buyer: 'bulk.st.declined', color: COLORS.error, bg: '#FEE2E2' },
  RESPONDED: { seller: 'bulk.st.waitBuyer', buyer: 'bulk.st.waitSeller', color: COLORS.muted, bg: '#F5F5F4' },
  CLOSED: { seller: 'bulk.st.declined', buyer: 'bulk.st.declined', color: COLORS.muted, bg: '#F5F5F4' },
};

function BulkStatusChip({ status, side }: { status: BulkStatus; side: Side }) {
  const { t } = useT();
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.CLOSED;
  return (
    <View className="self-start rounded-full px-3 py-1" style={{ backgroundColor: style.bg }}>
      <Text className="text-sm font-bold" style={{ color: style.color }}>
        {t(style[side])}
      </Text>
    </View>
  );
}

function PriceRow({ label, price, qty, strong, t }: { label: string; price: number; qty: number; strong?: boolean; t: TranslateFn }) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className="text-base text-artisan-muted">{label}</Text>
      <Text className={`text-base ${strong ? 'font-bold text-artisan-success' : 'font-semibold text-artisan-slate'}`}>
        {t('bulk.each', { p: price })} · {t('bulk.total', { p: Math.round(price * qty * 100) / 100 })}
      </Text>
    </View>
  );
}

async function postJson(path: string, body: unknown) {
  const token = useAuthStore.getState().session?.access_token;
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data as BulkRequest;
}

/** Bulk requests for the seller (to answer) or the buyer (to accept, decline or pay) */
export function BulkRequestsList({ side }: { side: Side }) {
  const { t } = useT();
  const router = useRouter();
  const [requests, setRequests] = useState<BulkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<BulkRequest | null>(null);

  const load = useCallback(async () => {
    const token = useAuthStore.getState().session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/b2b/inquiries/${side === 'seller' ? 'artisan' : 'buyer'}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRequests(data);
      }
    } catch (err: any) {
      console.warn('Failed to load bulk requests:', err?.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [side]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const replace = (updated: BulkRequest) =>
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

  const act = async (request: BulkRequest, path: string, body: unknown) => {
    setBusyId(request.id);
    try {
      const updated = await postJson(`/b2b/inquiries/${request.id}/${path}`, body);
      replace(updated);
      return updated;
    } catch (err: any) {
      Alert.alert(t('common.somethingWrong'), err.message);
      load();
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const goToPayment = (request: BulkRequest) =>
    router.push(`/(app)/buyer/checkout?inquiryId=${request.id}` as any);

  const confirm = (message: string, onYes: () => void) =>
    Alert.alert(message, undefined, [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: onYes },
    ]);

  const renderActions = (r: BulkRequest) => {
    const busy = busyId === r.id;
    if (side === 'seller') {
      if (r.status === 'OPEN') {
        return (
          <View style={{ gap: 8 }}>
            {r.targetPrice ? (
              <Button
                label={t('bulk.accept', { p: r.targetPrice })}
                icon={CheckCircle2}
                variant="success"
                compact
                loading={busy}
                onPress={() => act(r, 'respond', { action: 'ACCEPT' })}
              />
            ) : null}
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <Button
                  label={t('bulk.counter')}
                  icon={IndianRupee}
                  variant="secondary"
                  compact
                  disabled={busy}
                  onPress={() => setCounterFor(r)}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={t('bulk.reject')}
                  icon={XCircle}
                  variant="danger"
                  compact
                  disabled={busy}
                  onPress={() => confirm(t('bulk.rejectConfirm'), () => act(r, 'respond', { action: 'REJECT' }))}
                />
              </View>
            </View>
          </View>
        );
      }
      if (r.status === 'ACCEPTED') {
        return <Note icon={Clock} text={t('bulk.awaitPay')} />;
      }
      return null;
    }

    // Buyer
    if (r.status === 'COUNTERED') {
      return (
        <View className="flex-row" style={{ gap: 8 }}>
          <View className="flex-1">
            <Button
              label={t('bulk.acceptPay')}
              icon={CheckCircle2}
              variant="success"
              compact
              loading={busy}
              onPress={async () => {
                const updated = await act(r, 'decision', { action: 'ACCEPT' });
                if (updated) goToPayment(updated);
              }}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t('bulk.decline')}
              icon={XCircle}
              variant="danger"
              compact
              disabled={busy}
              onPress={() => confirm(t('bulk.declineConfirm'), () => act(r, 'decision', { action: 'DECLINE' }))}
            />
          </View>
        </View>
      );
    }
    if (r.status === 'ACCEPTED' && r.agreedPrice) {
      return (
        <Button
          label={t('bulk.payNow', { p: Math.round(r.agreedPrice * r.requestedQuantity * 100) / 100 })}
          icon={CreditCard}
          variant="success"
          compact
          onPress={() => goToPayment(r)}
        />
      );
    }
    return null;
  };

  const renderCard = ({ item: r }: { item: BulkRequest }) => (
    <View className="mb-4 rounded-2xl border border-artisan-border bg-white p-4">
      <View className="flex-row items-start">
        <View className="h-16 w-16 overflow-hidden rounded-xl bg-stone-100">
          {r.thumbnailUrl ? (
            <Image source={{ uri: r.thumbnailUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-artisan-light">
              <ShoppingBag color={COLORS.primary} size={24} />
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-artisan-slate" numberOfLines={2}>
            {r.productTitle}
          </Text>
          <Text className="text-sm text-artisan-muted" numberOfLines={1}>
            {side === 'seller'
              ? `${r.buyerName}${r.buyerBusiness ? ` · ${r.buyerBusiness}` : ''}`
              : t('common.by', { name: r.artisanName })}
          </Text>
          <Text className="text-base font-bold text-artisan-slate">{t('bulk.units', { n: r.requestedQuantity })}</Text>
        </View>
        <BulkStatusChip status={r.status} side={side} />
      </View>

      <View className="mt-3 rounded-xl bg-stone-50 px-3 py-2">
        {r.targetPrice ? (
          <PriceRow
            label={side === 'seller' ? t('bulk.buyerOffers') : t('bulk.yourOffer')}
            price={r.targetPrice}
            qty={r.requestedQuantity}
            t={t}
          />
        ) : null}
        {r.counterPrice ? (
          <PriceRow
            label={side === 'seller' ? t('bulk.yourCounter') : t('bulk.sellerOffers')}
            price={r.counterPrice}
            qty={r.requestedQuantity}
            strong={r.status === 'COUNTERED'}
            t={t}
          />
        ) : null}
        {r.agreedPrice ? (
          <PriceRow label={t('bulk.agreed')} price={r.agreedPrice} qty={r.requestedQuantity} strong t={t} />
        ) : null}
        {r.retailPrice ? (
          <Text className="pt-0.5 text-sm text-artisan-muted">{t('bulk.retail', { p: r.retailPrice })}</Text>
        ) : null}
      </View>

      {r.deliveryTimeline || r.message ? (
        <Text className="mt-2 text-base text-artisan-slate">
          {[r.deliveryTimeline, r.message].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {side === 'seller' && r.buyerPhone && (r.status === 'OPEN' || r.status === 'ACCEPTED') ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${r.buyerPhone}`)}
          className="mt-2 flex-row items-center self-start"
          hitSlop={8}
        >
          <Phone color={COLORS.primary} size={16} />
          <Text className="ml-1.5 text-base font-bold text-artisan-primary">{t('orders.call')}</Text>
        </TouchableOpacity>
      ) : null}

      <View className="mt-3">{renderActions(r)}</View>
    </View>
  );

  if (loading) return <Loading />;

  return (
    <>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={{ padding: 16, paddingBottom: 110, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={Building2}
            title={t('bulk.empty')}
            subtitle={side === 'buyer' ? t('bulk.emptyBuyer') : undefined}
          />
        }
      />

      <CounterPriceModal
        request={counterFor}
        onClose={() => setCounterFor(null)}
        onSend={async (price) => {
          if (!counterFor) return;
          const updated = await act(counterFor, 'respond', { action: 'COUNTER', counterPrice: price });
          if (updated) setCounterFor(null);
        }}
        sending={!!counterFor && busyId === counterFor.id}
      />
    </>
  );
}

function Note({ icon: Icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <View className="flex-row items-center">
      <Icon color={COLORS.muted} size={16} />
      <Text className="ml-1.5 text-sm text-artisan-muted">{text}</Text>
    </View>
  );
}

function CounterPriceModal({
  request,
  onClose,
  onSend,
  sending,
}: {
  request: BulkRequest | null;
  onClose: () => void;
  onSend: (price: number) => void;
  sending: boolean;
}) {
  const { t } = useT();
  const [price, setPrice] = useState('');

  const send = () => {
    const value = parseFloat(price);
    if (!value || value <= 0) {
      Alert.alert(t('bulk.priceTitle'));
      return;
    }
    onSend(Math.round(value * 100) / 100);
  };

  return (
    <Modal
      visible={!!request}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setPrice(request?.targetPrice ? String(request.targetPrice) : '')}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={sending ? undefined : onClose} />
        <View className="rounded-t-3xl bg-white p-5 pb-8">
          <Text className="text-xl font-bold text-artisan-slate" numberOfLines={2}>
            {request?.productTitle}
          </Text>
          <Text className="mb-4 text-base text-artisan-muted">
            {request ? t('bulk.units', { n: request.requestedQuantity }) : ''}
            {request?.targetPrice ? ` · ${t('bulk.buyerOffers')} ${t('bulk.each', { p: request.targetPrice })}` : ''}
          </Text>
          <Field label={t('bulk.counterTitle')} hint={t('bulk.counterHint')}>
            <IconInput
              icon={IndianRupee}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="e.g. 420"
              autoFocus
            />
          </Field>
          {request && parseFloat(price) > 0 ? (
            <Text className="mb-3 text-base font-bold text-artisan-success">
              {t('bulk.total', { p: Math.round(parseFloat(price) * request.requestedQuantity * 100) / 100 })}
            </Text>
          ) : null}
          <View style={{ gap: 10 }}>
            <Button label={t('bulk.send')} icon={Send} loading={sending} onPress={send} />
            <Button label={t('profile.cancel')} variant="ghost" disabled={sending} onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** "Orders | Bulk requests" switch shown under the Orders screen header */
export function OrdersTabs({
  value,
  onChange,
  ordersLabel,
}: {
  value: 'orders' | 'bulk';
  onChange: (value: 'orders' | 'bulk') => void;
  ordersLabel: string;
}) {
  const { t } = useT();
  const tab = (key: 'orders' | 'bulk', label: string) => {
    const selected = value === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => onChange(key)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        className="h-11 flex-1 items-center justify-center rounded-xl"
        style={{ backgroundColor: selected ? COLORS.primary : 'transparent' }}
      >
        <Text className="text-base font-bold" style={{ color: selected ? '#FFFFFF' : COLORS.ink }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View className="mx-4 mt-3 flex-row rounded-2xl border border-artisan-border bg-white p-1">
      {tab('orders', ordersLabel)}
      {tab('bulk', t('bulk.tabRequests'))}
    </View>
  );
}

/** Seller setting on the product page: smallest quantity buyers may ask a bulk price for */
export function BulkMinSetting({ productId, initial }: { productId: string; initial: number }) {
  const { t } = useT();
  const [value, setValue] = useState(String(initial));
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const qty = parseInt(value, 10);
  const changed = qty !== saved;

  const save = async () => {
    if (!qty || qty < 2) {
      Alert.alert(t('bulk.minInvalid'));
      return;
    }
    setSaving(true);
    try {
      const token = useAuthStore.getState().session?.access_token;
      const res = await fetch(`${getApiBaseUrl()}/catalog/${productId}/bulk-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ minBulkQty: qty }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSaved(qty);
    } catch {
      Alert.alert(t('common.somethingWrong'), t('common.checkInternet'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text className="text-lg font-bold text-artisan-slate">{t('bulk.minSetting')}</Text>
      <Text className="mb-3 text-sm text-artisan-muted">{t('bulk.minSettingHint')}</Text>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-1">
          <IconInput
            icon={Building2}
            value={value}
            onChangeText={(text) => setValue(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="10"
          />
        </View>
        <Button
          label={changed ? t('common.save') : t('bulk.saved')}
          icon={changed ? undefined : CheckCircle2}
          variant={changed ? 'primary' : 'ghost'}
          compact
          loading={saving}
          disabled={!changed}
          onPress={save}
        />
      </View>
    </View>
  );
}

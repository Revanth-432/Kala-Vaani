import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Users, ShoppingBag, IndianRupee, Tag, BarChart3, Info } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { getApiBaseUrl } from '../../src/lib/api';
import { Text, ScreenHeader, StatTile, EmptyState, Loading, COLORS } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { SalesLineChart, compactRupees, type MonthPoint } from '../../src/components/SalesLineChart';

interface Analytics {
  buyerCount: number;
  currentOrders: number;
  totalOrders: number;
  totalRevenue: number;
  avgProductPrice: number | null;
  productCount: number;
  monthly: MonthPoint[];
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AnalyticsScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(0);

  const locale = language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
  const monthName = (month: string, long = false) => {
    const [yr, mo] = month.split('-').map(Number);
    return new Date(yr, mo - 1, 1).toLocaleDateString(locale, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
  };

  const load = useCallback(async () => {
    const token = useAuthStore.getState().session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/orders/artisan/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json: Analytics = await res.json();
      setData(json);
      setFailed(false);
      // Start on the latest month that had sales, else the current month
      const lastWithSales = json.monthly.map((m) => m.orders > 0).lastIndexOf(true);
      setSelected(lastWithSales >= 0 ? lastWithSales : json.monthly.length - 1);
    } catch (err: any) {
      console.warn('Failed to load analytics:', err?.message || err);
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const ordersLabel = (n: number) => (n === 1 ? t('analytics.ordersOne') : t('analytics.ordersMany', { n }));
  const point = data?.monthly[selected];
  const hasSales = !!data && data.monthly.some((m) => m.orders > 0);

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader title={t('analytics.title')} onBack={() => router.navigate('/(app)/dashboard')} />

      {loading ? (
        <Loading />
      ) : !data ? (
        <View className="p-4">
          <EmptyState icon={BarChart3} title={t('common.couldNotLoad')} subtitle={failed ? t('common.checkInternet') : undefined} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
        >
          {/* Headline numbers */}
          <View className="mb-3 flex-row" style={{ gap: 12 }}>
            <StatTile icon={Users} value={data.buyerCount} label={t('analytics.buyers')} />
            <StatTile
              icon={ShoppingBag}
              value={data.currentOrders}
              label={t('analytics.currentOrders')}
              color={COLORS.amber}
              onPress={() => router.navigate('/(app)/orders')}
            />
          </View>
          <View className="mb-5 flex-row" style={{ gap: 12 }}>
            <StatTile icon={IndianRupee} value={compactRupees(data.totalRevenue)} label={t('analytics.revenue')} color={COLORS.success} />
            <StatTile
              icon={Tag}
              value={data.avgProductPrice ? compactRupees(data.avgProductPrice) : '—'}
              label={t('analytics.avgPrice')}
              onPress={() => router.navigate('/(app)/catalog')}
            />
          </View>

          {/* Monthly sales chart */}
          <View className="mb-5 rounded-2xl border border-artisan-border bg-white p-4">
            <Text className="text-lg font-bold text-artisan-slate">{t('analytics.chartTitle')}</Text>
            <Text className="text-sm text-artisan-muted">{t('analytics.chartSub')}</Text>

            {hasSales && point ? (
              <>
                <View className="mb-1 mt-3 flex-row items-end justify-between">
                  <View>
                    <Text className="text-sm font-semibold text-artisan-muted">{monthName(point.month, true)}</Text>
                    <Text className="text-2xl font-bold text-artisan-slate">{rupees(point.revenue)}</Text>
                  </View>
                  <Text className="text-base text-artisan-muted">{ordersLabel(point.orders)}</Text>
                </View>
                <SalesLineChart
                  data={data.monthly}
                  selected={selected}
                  onSelect={setSelected}
                  monthLabel={(m) => monthName(m)}
                  accessibilityLabel={`${t('analytics.chartTitle')}: ${data.monthly
                    .filter((m) => m.orders > 0)
                    .map((m) => `${monthName(m.month, true)} ${rupees(m.revenue)}`)
                    .join(', ')}`}
                />
                <Text className="mt-1 text-center text-xs text-artisan-muted">{t('analytics.tapHint')}</Text>
              </>
            ) : (
              <View className="mt-4 items-center rounded-xl bg-stone-50 px-4 py-8">
                <BarChart3 color={COLORS.muted} size={32} />
                <Text className="mt-2 text-center text-base text-artisan-muted">{t('analytics.noSales')}</Text>
              </View>
            )}
          </View>

          {/* Same numbers as a table */}
          {hasSales ? (
            <View className="mb-4 rounded-2xl border border-artisan-border bg-white px-4 py-2">
              <Text className="py-2 text-lg font-bold text-artisan-slate">{t('analytics.table')}</Text>
              {data.monthly
                .map((m, i) => ({ ...m, i }))
                .filter((m) => m.orders > 0)
                .reverse()
                .map((m) => (
                  <View
                    key={m.month}
                    className="flex-row items-center justify-between border-t border-artisan-border py-3"
                  >
                    <View>
                      <Text className="text-base font-semibold text-artisan-slate">{monthName(m.month, true)}</Text>
                      <Text className="text-sm text-artisan-muted">{ordersLabel(m.orders)}</Text>
                    </View>
                    <Text className="text-base font-bold text-artisan-slate" style={{ fontVariant: ['tabular-nums'] }}>
                      {rupees(m.revenue)}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}

          <View className="flex-row items-start px-1">
            <Info color={COLORS.muted} size={16} />
            <Text className="ml-1.5 flex-1 text-sm text-artisan-muted">{t('analytics.note')}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

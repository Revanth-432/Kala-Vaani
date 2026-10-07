import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  MapPin,
  ShoppingBag,
  LogOut,
  SlidersHorizontal,
  ShoppingCart,
  Zap,
  X,
  RotateCcw,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useCartStore } from '../../../src/store/useCartStore';
import { getApiBaseUrl } from '../../../src/lib/api';
import { Text, Button, Chip, EmptyState, Loading, COLORS } from '../../../src/components/ui';
import { useT } from '../../../src/i18n';
import { ProductStatsLine, type ProductRating } from '../../../src/components/Reviews';

interface FeedItem {
  id: string;
  title: string;
  category: string;
  craftType?: string | null;
  shortDescription?: string | null;
  artisanName: string;
  artisanRegion?: string | null;
  price?: number | null;
  currency: string;
  thumbnailUrl: string | null;
  marketingUrl?: string | null;
  baseStock?: number;
  buyerCount?: number;
  rating?: ProductRating;
}

type PriceFilter = 'ALL' | 'UNDER_1000' | '1000_TO_5000' | 'ABOVE_5000';
type SortOption = 'DEFAULT' | 'PRICE_LOW' | 'PRICE_HIGH';

export default function BuyerFeedScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { signOut, role, isLoading } = useAuthStore();
  const { addToCart, updateQuantity, items: cartItems, getTotalCount } = useCartStore();

  // Role Protection Guard: Artisans must never access Buyer Feed
  useEffect(() => {
    if (!isLoading && role === 'ARTISAN') {
      router.replace('/(app)/dashboard');
    }
  }, [role, isLoading, router]);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addedItemId, setAddedItemId] = useState<string | null>(null);

  // Filter & Sort States (dynamically populated from currently available products)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState<PriceFilter>('ALL');
  const [selectedSort, setSelectedSort] = useState<SortOption>('DEFAULT');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const cartCount = getTotalCount();

  const fetchFeed = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/marketplace/feed`);
      if (res.ok) {
        const data: FeedItem[] = await res.json();
        if (Array.isArray(data)) {
          setItems(data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch marketplace feed from backend:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  // 1. Dynamically extract currently available categories from products in the portal
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const cat = item.craftType || item.category;
      if (cat && cat.trim()) {
        set.add(cat.trim());
      }
    });
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // 2. Filter & Sort products as per user selection
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Category Filter
    if (selectedCategory !== 'ALL') {
      result = result.filter(
        (item) =>
          (item.craftType && item.craftType.trim() === selectedCategory) ||
          (item.category && item.category.trim() === selectedCategory),
      );
    }

    // Price Filter
    if (selectedPriceFilter === 'UNDER_1000') {
      result = result.filter((item) => (item.price || 0) < 1000);
    } else if (selectedPriceFilter === '1000_TO_5000') {
      result = result.filter(
        (item) => (item.price || 0) >= 1000 && (item.price || 0) <= 5000,
      );
    } else if (selectedPriceFilter === 'ABOVE_5000') {
      result = result.filter((item) => (item.price || 0) > 5000);
    }

    // Sorting
    if (selectedSort === 'PRICE_LOW') {
      result.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (selectedSort === 'PRICE_HIGH') {
      result.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return result;
  }, [items, selectedCategory, selectedPriceFilter, selectedSort]);

  const hasActiveFilter =
    selectedCategory !== 'ALL' ||
    selectedPriceFilter !== 'ALL' ||
    selectedSort !== 'DEFAULT';

  const handleResetFilters = () => {
    setSelectedCategory('ALL');
    setSelectedPriceFilter('ALL');
    setSelectedSort('DEFAULT');
  };

  // Quick Add to Cart Handler
  const handleAddToCart = (item: FeedItem) => {
    const maxLimit = item.baseStock || 10;
    addToCart(
      {
        id: item.id,
        title: item.title,
        price: item.price || 499,
        thumbnailUrl: item.thumbnailUrl || item.marketingUrl || null,
        artisanName: item.artisanName,
        category: item.craftType || item.category,
        maxOrderLimit: maxLimit,
      },
      1,
      maxLimit,
    );
  };

  // Quick Order Now Handler
  const handleOrderNow = (item: FeedItem) => {
    router.push({
      pathname: '/(app)/buyer/checkout',
      params: { productId: item.id },
    } as any);
  };

  const renderCraftCard = ({ item }: { item: FeedItem }) => {
    const cartItem = cartItems.find((i) => i.id === item.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const maxLimit = item.baseStock || 10;

    return (
      <View className="mb-4 overflow-hidden rounded-2xl border border-artisan-border bg-white">
        <TouchableOpacity
          onPress={() => router.push(`/(app)/buyer/product/${item.id}` as any)}
          activeOpacity={0.9}
        >
          <View className="h-60 w-full bg-stone-100">
            {item.thumbnailUrl || item.marketingUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl || item.marketingUrl || '' }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-artisan-light">
                <ShoppingBag color={COLORS.primary} size={48} />
              </View>
            )}
            {Boolean(item.artisanRegion) ? (
              <View className="absolute bottom-3 left-3 flex-row items-center rounded-full bg-black/70 px-3 py-1">
                <MapPin color="#FFFFFF" size={14} />
                <Text className="ml-1 text-sm text-white">{item.artisanRegion}</Text>
              </View>
            ) : null}
          </View>

          <View className="px-4 pt-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold text-artisan-slate" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-sm text-artisan-muted" numberOfLines={1}>
                  {t('common.by', { name: item.artisanName || 'Artisan' })} · {item.craftType || item.category}
                </Text>
                <View className="mt-1">
                  <ProductStatsLine buyerCount={item.buyerCount} rating={item.rating} emptyKey="product.beFirst" size="sm" />
                </View>
              </View>
              <Text className="text-2xl font-bold text-artisan-success">₹{item.price || 499}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View className="flex-row items-center p-4" style={{ gap: 10 }}>
          {inCartQty === 0 ? (
            <TouchableOpacity
              key="add"
              onPress={() => handleAddToCart(item)}
              activeOpacity={0.8}
              className="h-12 flex-1 flex-row items-center justify-center rounded-xl border-2 border-artisan-primary bg-white"
            >
              <ShoppingCart color={COLORS.primary} size={20} />
              <Text className="ml-2 text-base font-bold text-artisan-primary">{t('buyer.addToCart')}</Text>
            </TouchableOpacity>
          ) : (
            <View
              key="stepper"
              className="h-12 flex-1 flex-row items-center justify-between rounded-xl border-2 border-artisan-primary bg-artisan-light px-1"
            >
              <TouchableOpacity
                onPress={() => updateQuantity(item.id, inCartQty - 1, maxLimit)}
                accessibilityLabel="Decrease quantity"
                className="h-10 w-10 items-center justify-center rounded-lg bg-white"
              >
                <Minus color={COLORS.primary} size={20} />
              </TouchableOpacity>
              <Text className="text-lg font-bold text-artisan-slate">{inCartQty}</Text>
              <TouchableOpacity
                onPress={() => {
                  if (inCartQty >= maxLimit) {
                    Alert.alert(t('buyer.limitTitle'), t('buyer.limitMsg', { n: maxLimit }));
                    return;
                  }
                  updateQuantity(item.id, inCartQty + 1, maxLimit);
                }}
                accessibilityLabel="Increase quantity"
                className="h-10 w-10 items-center justify-center rounded-lg bg-artisan-primary"
              >
                <Plus color="#FFFFFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => handleOrderNow(item)}
            activeOpacity={0.85}
            className="h-12 flex-1 flex-row items-center justify-center rounded-xl bg-artisan-primary"
          >
            <Zap color="#FFFFFF" size={20} />
            <Text className="ml-2 text-base font-bold text-white">{t('buyer.buyNow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View
      className="flex-1 bg-artisan-canvas"
      style={{ paddingTop: Math.max(insets.top, 20) + 8 }}
    >
      {/* Header */}
      <View className="border-b border-artisan-border bg-white px-4 pb-3 pt-1">
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-artisan-slate">{t('buyer.feedTitle')}</Text>
            <Text className="text-base text-artisan-muted">{t('buyer.feedSub')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.navigate('/(app)/cart')}
            accessibilityLabel="Cart"
            className="mr-2 h-12 w-12 items-center justify-center rounded-xl bg-artisan-light"
            activeOpacity={0.8}
          >
            <ShoppingCart color={COLORS.primary} size={24} />
            {cartCount > 0 ? (
              <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-artisan-primary px-1">
                <Text className="text-xs font-bold text-white">{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => signOut()}
            accessibilityLabel="Log out"
            className="h-12 w-12 items-center justify-center rounded-xl bg-stone-100"
            activeOpacity={0.8}
          >
            <LogOut color={COLORS.muted} size={22} />
          </TouchableOpacity>
        </View>

        <View className="mt-3 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.push('/(app)/buyer/search')}
            activeOpacity={0.85}
            className="mr-2 h-12 flex-1 flex-row items-center rounded-xl border-2 border-artisan-border bg-stone-50 px-4"
          >
            <Search color={COLORS.primary} size={22} />
            <Text className="ml-2 flex-1 text-base text-artisan-muted">{t('buyer.search')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            accessibilityLabel="Filters"
            activeOpacity={0.8}
            className="h-12 w-12 items-center justify-center rounded-xl"
            style={{
              backgroundColor: hasActiveFilter ? COLORS.primary : '#FFFFFF',
              borderWidth: 2,
              borderColor: hasActiveFilter ? COLORS.primary : COLORS.border,
            }}
          >
            <SlidersHorizontal color={hasActiveFilter ? '#FFFFFF' : COLORS.primary} size={22} />
          </TouchableOpacity>
        </View>

        {availableCategories.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingTop: 12 }}
          >
            {availableCategories.map((cat) => (
              <Chip
                key={cat}
                label={cat === 'ALL' ? t('buyer.all') : cat}
                selected={selectedCategory === cat}
                onPress={() => setSelectedCategory(cat)}
              />
            ))}
          </ScrollView>
        ) : null}

        {hasActiveFilter ? (
          <View className="mt-3 flex-row items-center justify-between rounded-xl bg-artisan-light px-3 py-2">
            <Text className="text-base font-semibold text-artisan-slate">
              {t('common.itemsCount', { n: filteredItems.length })}
            </Text>
            <TouchableOpacity onPress={handleResetFilters} className="h-9 flex-row items-center px-2">
              <RotateCcw color={COLORS.primary} size={16} />
              <Text className="ml-1 text-base font-bold text-artisan-primary">{t('buyer.clear')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View key="loading" className="flex-1">
          <Loading />
        </View>
      ) : (
        <FlatList
          key="list"
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderCraftCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
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
              icon={ShoppingBag}
              title={t('buyer.noItemsFound')}
              subtitle={t('buyer.clearFiltersHint')}
              action={
                <Button
                  label={t('buyer.clearFilters')}
                  icon={RotateCcw}
                  variant="secondary"
                  onPress={handleResetFilters}
                />
              }
            />
          }
        />
      )}

      {/* Filters sheet */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[85%] rounded-t-3xl bg-white p-5">
            <View className="flex-row items-center justify-between border-b border-artisan-border pb-3">
              <Text className="text-2xl font-bold text-artisan-slate">{t('buyer.filters')}</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                accessibilityLabel="Close"
                className="h-12 w-12 items-center justify-center rounded-xl bg-stone-100"
              >
                <X color={COLORS.ink} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              <Text className="mb-2 text-lg font-bold text-artisan-slate">{t('capture.category')}</Text>
              <View className="mb-5 flex-row flex-wrap" style={{ gap: 8 }}>
                {availableCategories.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat === 'ALL' ? t('buyer.all') : cat}
                    selected={selectedCategory === cat}
                    onPress={() => setSelectedCategory(cat)}
                  />
                ))}
              </View>

              <Text className="mb-2 text-lg font-bold text-artisan-slate">{t('buyer.price')}</Text>
              <View className="mb-5 flex-row flex-wrap" style={{ gap: 8 }}>
                {[
                  { id: 'ALL', label: t('buyer.priceAny') },
                  { id: 'UNDER_1000', label: t('buyer.under1000') },
                  { id: '1000_TO_5000', label: t('buyer.range1000to5000') },
                  { id: 'ABOVE_5000', label: t('buyer.over5000') },
                ].map((p) => (
                  <Chip
                    key={p.id}
                    label={p.label}
                    selected={selectedPriceFilter === p.id}
                    onPress={() => setSelectedPriceFilter(p.id as PriceFilter)}
                  />
                ))}
              </View>

              <Text className="mb-2 text-lg font-bold text-artisan-slate">{t('buyer.sort')}</Text>
              <View className="mb-6 flex-row flex-wrap" style={{ gap: 8 }}>
                {[
                  { id: 'DEFAULT', label: t('buyer.sortRecommended') },
                  { id: 'PRICE_LOW', label: t('buyer.sortLow') },
                  { id: 'PRICE_HIGH', label: t('buyer.sortHigh') },
                ].map((s) => (
                  <Chip
                    key={s.id}
                    label={s.label}
                    selected={selectedSort === s.id}
                    onPress={() => setSelectedSort(s.id as SortOption)}
                  />
                ))}
              </View>
            </ScrollView>

            <View className="flex-row border-t border-artisan-border pt-3" style={{ gap: 10 }}>
              <Button label={t('buyer.clear')} variant="secondary" onPress={handleResetFilters} className="px-6" />
              <View className="flex-1">
                <Button
                  label={t('buyer.showItems', { n: filteredItems.length })}
                  onPress={() => setFilterModalVisible(false)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/useAuthStore';
import {
  ArrowLeft,
  Search,
  X,
  ShoppingBag,
  ShoppingCart,
  Zap,
  Minus,
  Plus,
} from 'lucide-react-native';
import { getApiBaseUrl } from '../../../src/lib/api';
import { useCartStore } from '../../../src/store/useCartStore';
import { Text, Chip, EmptyState, Loading, COLORS } from '../../../src/components/ui';
import { useT, fontFor } from '../../../src/i18n';
import { ProductStatsLine, type ProductRating } from '../../../src/components/Reviews';

interface SearchResult {
  id: string;
  title: string;
  category: string;
  craftType?: string | null;
  shortDescription?: string | null;
  materials?: string | null;
  artisanName: string;
  artisanRegion?: string | null;
  price?: number | null;
  currency: string;
  thumbnailUrl: string | null;
  marketingUrl?: string | null;
  similarityScore?: number;
  baseStock?: number;
  buyerCount?: number;
  rating?: ProductRating;
}

const QUICK_TAGS = [
  'Terracotta Diya',
  'Silk Banarasi Saree',
  'Dokra Brass Figurine',
  'Madhubani Art',
  'Kashmiri Shawl',
  'Clay Pots',
];

export default function BuyerSearchScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();

  // Role Protection Guard
  useEffect(() => {
    if (!isLoading && role === 'ARTISAN') {
      router.replace('/(app)/dashboard');
    }
  }, [role, isLoading, router]);

  const { addToCart, updateQuantity, items: cartItems } = useCartStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);


  const getBaseApiUrl = () => {
    return getApiBaseUrl();
  };

  const executeSearch = async (text: string) => {
    if (!text || !text.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(
        `${getBaseApiUrl()}/marketplace/search?q=${encodeURIComponent(text.trim())}`,
      );
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.warn('Semantic search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    // Debounce search by 400ms
    searchTimeout.current = setTimeout(() => {
      executeSearch(text);
    }, 400);
  };

  const handleTagPress = (tag: string) => {
    setQuery(tag);
    Keyboard.dismiss();
    executeSearch(tag);
  };

  const renderResultCard = ({ item }: { item: SearchResult }) => {
    const cartItem = cartItems.find((i) => i.id === item.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;
    const maxLimit = item.baseStock || 10;

    return (
      <View className="mb-3 rounded-2xl border border-artisan-border bg-white p-3">
        <TouchableOpacity
          onPress={() => router.push(`/(app)/buyer/product/${item.id}` as any)}
          activeOpacity={0.88}
          className="flex-row"
        >
          <View className="h-24 w-24 overflow-hidden rounded-xl bg-stone-100">
            {item.thumbnailUrl || item.marketingUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl || item.marketingUrl || '' }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-artisan-light">
                <ShoppingBag color={COLORS.primary} size={32} />
              </View>
            )}
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-lg font-bold text-artisan-slate" numberOfLines={2}>
              {item.title}
            </Text>
            <Text className="text-sm text-artisan-muted" numberOfLines={1}>
                            {t('common.by', { name: item.artisanName })}
              {item.artisanRegion ? ` · ${item.artisanRegion}` : ''}
            </Text>
            <Text className="mt-1 text-xl font-bold text-artisan-success">₹{item.price || 499}</Text>
            <ProductStatsLine buyerCount={item.buyerCount} rating={item.rating} emptyKey="product.beFirst" size="sm" />
          </View>
        </TouchableOpacity>

        <View className="mt-3 flex-row" style={{ gap: 10 }}>
          {inCartQty === 0 ? (
            <TouchableOpacity
              key="add"
              onPress={() => {
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
              }}
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
            onPress={() =>
              router.push({
                pathname: '/(app)/buyer/checkout',
                params: { productId: item.id },
              } as any)
            }
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
      <View className="border-b border-artisan-border bg-white px-4 pb-3">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Back"
            className="mr-2 h-12 w-12 items-center justify-center rounded-xl bg-artisan-light"
          >
            <ArrowLeft color={COLORS.ink} size={26} />
          </TouchableOpacity>
          <View className="h-14 flex-1 flex-row items-center rounded-xl border-2 border-artisan-primary bg-white px-3">
            <Search color={COLORS.primary} size={22} />
            <TextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder={t('buyer.searchPlaceholder')}
              placeholderTextColor="#8A817A"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => executeSearch(query)}
              className="ml-2 flex-1 text-lg text-artisan-slate"
              style={{ fontFamily: fontFor(language) }}
            />
            {query.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  setSearched(false);
                }}
                accessibilityLabel="Clear search"
                className="h-10 w-10 items-center justify-center rounded-full bg-stone-100"
              >
                <X color={COLORS.muted} size={20} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {QUICK_TAGS.map((tag) => (
            <Chip key={tag} label={tag} selected={false} onPress={() => handleTagPress(tag)} />
          ))}
        </View>
      </View>

      {loading ? (
        <View key="loading" className="flex-1">
          <Loading label={t('buyer.searching')} />
        </View>
      ) : searched && results.length === 0 ? (
        <View key="empty" className="flex-1 justify-center p-4">
          <EmptyState icon={ShoppingBag} title={t('buyer.nothingFound')} subtitle={t('buyer.noResultsFor', { q: query })} />
        </View>
      ) : (
        <FlatList
          key="results"
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResultCard}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            searched && results.length > 0 ? (
              <Text className="mb-3 text-base font-semibold text-artisan-muted">
                {t('buyer.results', { n: results.length })}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !searched ? (
              <View className="mt-10 items-center">
                <Search color={COLORS.border} size={56} />
                <Text className="mt-3 text-center text-lg text-artisan-muted">
                                    {t('buyer.typeOrTap')}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

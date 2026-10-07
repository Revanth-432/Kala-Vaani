import React from 'react';
import { Tabs, usePathname } from 'expo-router';
import {
  Home,
  Package,
  ShoppingBag,
  User,
  Store,
  ShoppingCart,
} from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useCartStore } from '../../src/store/useCartStore';
import { Text, COLORS } from '../../src/components/ui';
import { useT, fontFor } from '../../src/i18n';

export default function AppLayout() {
  const { role, isLoading } = useAuthStore();
  const isBuyer = role === 'BUYER' || role === 'B2B_BUYER';
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
    const pathname = usePathname();
  const { t, language } = useT();

  // Hide the bottom tab bar when pushed onto full-screen sub-routes (product detail, checkout, quote, search, capture studio)
  const isSubRoute =
    pathname.includes('/buyer/product') ||
    pathname.includes('/buyer/checkout') ||
    pathname.includes('/buyer/b2b-request') ||
    pathname.includes('/buyer/search') ||
    pathname.includes('/product') ||
    pathname.includes('/analytics') ||
    pathname.includes('/capture');

  // NOTE: We must ALWAYS render <Tabs> (never return early with a plain <View>).
  // Expo Router mounts child route screens regardless, and they call useRouter() / useFocusEffect()
  // which require a parent navigator context. Returning a plain View here would leave those
  // child screens without a navigation context -> crash.
  const shouldHideTabs = isLoading || !role || isSubRoute;

  const commonScreenOptions = {
    headerShown: false,
    freezeOnBlur: false,
    detachInactiveScreens: false,
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.muted,
    tabBarHideOnKeyboard: true,
    tabBarStyle: shouldHideTabs
      ? { display: 'none' as const }
      : {
          backgroundColor: '#FFFFFF',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 8,
          elevation: 0,
        },
    tabBarLabelStyle: {
      fontSize: 13,
      fontFamily: fontFor(language, 'semibold'),
    },
  };

  // ─── BUYER TAB NAVIGATOR ───
  if (isBuyer) {
    return (
      <Tabs initialRouteName="buyer" screenOptions={commonScreenOptions}>
        {/* Buyer Tab 1: Explore / बाज़ार */}
        <Tabs.Screen
          name="buyer"
          options={{
            title: t('tabs.shop'),
            tabBarIcon: ({ color, focused }) => (
              <Store
                color={color}
                size={26}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />

        {/* Buyer Tab 2: Cart / कार्ट */}
        <Tabs.Screen
          name="cart"
          options={{
            title: t('tabs.cart'),
            tabBarIcon: ({ color, focused }) => (
              <View className="relative">
                <ShoppingCart
                  color={color}
                  size={26}
                  strokeWidth={focused ? 2.5 : 2}
                />
                {cartCount > 0 ? (
                  <View className="absolute -top-2 -right-3 h-5 min-w-[20px] rounded-full bg-artisan-primary items-center justify-center px-1">
                    <Text className="text-xs font-bold text-white">
                      {cartCount > 9 ? '9+' : cartCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            ),
          }}
        />

        {/* Buyer Tab 3: Orders / मेरे ऑर्डर */}
        <Tabs.Screen
          name="buyer-orders"
          options={{
            title: t('tabs.orders'),
            tabBarIcon: ({ color, focused }) => (
              <Package
                color={color}
                size={26}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />

        {/* Shared Tab: Profile / प्रोफ़ाइल */}
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tabs.profile'),
            tabBarIcon: ({ color, focused }) => (
              <User
                color={color}
                size={26}
                strokeWidth={focused ? 2.5 : 2}
              />
            ),
          }}
        />

        {/* Hidden Seller Routes from Buyer view */}
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="catalog" options={{ href: null }} />
        <Tabs.Screen name="orders" options={{ href: null }} />
        <Tabs.Screen name="capture" options={{ href: null }} />
        <Tabs.Screen name="product" options={{ href: null }} />
        <Tabs.Screen name="analytics" options={{ href: null }} />
      </Tabs>
    );
  }

  // ─── ARTISAN / SELLER TAB NAVIGATOR ───
  return (
    <Tabs initialRouteName="dashboard" screenOptions={commonScreenOptions}>
      {/* Seller Tab 1: Home / मुख्य */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <Home
              color={color}
              size={26}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      {/* Seller Tab 2: Catalog / कैटलॉग */}
      <Tabs.Screen
        name="catalog"
        options={{
          title: t('tabs.myItems'),
          tabBarIcon: ({ color, focused }) => (
            <Package
              color={color}
              size={26}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      {/* Seller Tab 3: Orders / ऑर्डर */}
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color, focused }) => (
            <ShoppingBag
              color={color}
              size={26}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      {/* Shared Tab: Profile / प्रोफ़ाइल */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <User
              color={color}
              size={26}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      {/* Hidden Buyer Routes from Seller view */}
      <Tabs.Screen name="buyer" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="buyer-orders" options={{ href: null }} />
      <Tabs.Screen name="capture" options={{ href: null }} />
      <Tabs.Screen name="product" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
    </Tabs>
  );
}

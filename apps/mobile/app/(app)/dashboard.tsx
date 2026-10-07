import React, { useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Package,
  ShoppingBag,
  Camera,
  ChevronRight,
  BarChart3,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Text, SectionTitle, COLORS } from '../../src/components/ui';
import { useT } from '../../src/i18n';

export default function DashboardScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { user, role, isLoading } = useAuthStore();

  // Guard: If a buyer ever navigates here, redirect immediately to buyer feed
  useEffect(() => {
    if (!isLoading && role && (role === 'BUYER' || role === 'B2B_BUYER')) {
      router.replace('/(app)/buyer/feed');
    }
  }, [role, isLoading, router]);

  // Dynamic uppercase formatted date (e.g., "WED, 9 SEP")
  const currentDateStr = new Date()
    .toLocaleDateString(language === 'te' ? 'te-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase();

  const artisanName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Artisan';

  return (
    <View
      className="flex-1 bg-artisan-canvas"
      style={{ paddingTop: Math.max(insets.top, 20) + 8 }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting + profile */}
        <View className="mb-5 flex-row items-center">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-artisan-muted">{currentDateStr}</Text>
            <Text className="text-2xl font-bold text-artisan-slate" numberOfLines={1}>
              {t('home.greeting', { name: artisanName })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.navigate('/(app)/profile')}
            activeOpacity={0.8}
            accessibilityLabel="Profile"
            className="h-14 w-14 items-center justify-center rounded-full border-2 border-artisan-primary bg-artisan-light"
          >
            <Text className="text-2xl font-bold text-artisan-primary">
              {artisanName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main action */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/capture/image')}
          activeOpacity={0.85}
          className="mb-6 flex-row items-center rounded-2xl bg-artisan-primary p-5"
        >
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <Camera color="#FFFFFF" size={36} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-2xl font-bold text-white">{t('home.addNew')}</Text>
            <Text className="text-base text-white">{t('home.addNewSub')}</Text>
          </View>
          <ChevronRight color="#FFFFFF" size={30} />
        </TouchableOpacity>

        {/* Shortcuts */}
        <SectionTitle title={t('home.goTo')} />
        <ShortcutRow
          icon={Package}
          title={t('tabs.myItems')}
          onPress={() => router.navigate('/(app)/catalog')}
        />
        <ShortcutRow
          icon={ShoppingBag}
          title={t('home.seeOrders')}
          onPress={() => router.navigate('/(app)/orders')}
        />

        {/* Analytics */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/analytics' as any)}
          activeOpacity={0.85}
          className="mt-3 flex-row items-center rounded-2xl p-5"
          style={{ backgroundColor: COLORS.success }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <BarChart3 color="#FFFFFF" size={36} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-2xl font-bold text-white">{t('analytics.view')}</Text>
            <Text className="text-base text-white">{t('analytics.viewSub')}</Text>
          </View>
          <ChevronRight color="#FFFFFF" size={30} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ShortcutRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: typeof Package;
  title: string;
    subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="mb-3 flex-row items-center rounded-2xl border border-artisan-border bg-white p-4"
    >
      <View className="h-14 w-14 items-center justify-center rounded-xl bg-artisan-light">
        <Icon color={COLORS.primary} size={28} />
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-xl font-bold text-artisan-slate">{title}</Text>
        {subtitle ? <Text className="text-base text-artisan-muted">{subtitle}</Text> : null}
      </View>
      <ChevronRight color={COLORS.muted} size={26} />
    </TouchableOpacity>
  );
}

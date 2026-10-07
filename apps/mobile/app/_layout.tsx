import './global.css';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import {
  useFonts,
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
    Mukta_700Bold,
} from '@expo-google-fonts/mukta';
import {
  NotoSansTelugu_400Regular,
  NotoSansTelugu_500Medium,
  NotoSansTelugu_600SemiBold,
  NotoSansTelugu_700Bold,
} from '@expo-google-fonts/noto-sans-telugu';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { enableFreeze, enableScreens } from 'react-native-screens';
import { useAuthStore } from '../src/store/useAuthStore';
import { supabase } from '../src/lib/supabase';
import { useLanguageStore, isAppLanguage } from '../src/store/useLanguageStore';
import { Text, COLORS } from '../src/components/ui';
import { Logo } from '../src/components/Logo';

// Disable react-freeze globally to permanently prevent touch freeze / unresponsive screens on Android
enableScreens(true);
enableFreeze(false);

export default function RootLayout() {
  const { session, role, hasCompletedOnboarding, isLoading, setSession, setLoading } =
    useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [fontsLoaded] = useFonts({
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_600SemiBold,
        Mukta_700Bold,
    NotoSansTelugu_400Regular,
    NotoSansTelugu_500Medium,
    NotoSansTelugu_600SemiBold,
    NotoSansTelugu_700Bold,
  });
  const languageHydrated = useLanguageStore((s) => s.hasHydrated);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const accountLanguage = session?.user?.user_metadata?.language;

  // Apply the language saved on the user's account (set at sign-up or in Profile)
  useEffect(() => {
    if (isAppLanguage(accountLanguage)) {
      setLanguage(accountLanguage);
    }
  }, [accountLanguage, setLanguage]);

  // 1. Synchronize Supabase authentication state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession]);

  // 2. Navigation protection guard
  useEffect(() => {
    if (!rootNavigationState?.key) return; // Wait for navigation state to be ready
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOnboarding = (segments as string[]).includes('onboarding');
    const isBuyer = role === 'BUYER' || role === 'B2B_BUYER';
    const subRoute = (segments as string[])[1];

    if (!session) {
      // No session — always send to login (unless already there)
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (!role) {
      // Session exists but role isn't resolved yet — wait
      return;
    } else if (!hasCompletedOnboarding) {
      // Authenticated user has not finished onboarding -> send to onboarding
      if (!isOnboarding) {
        router.replace('/(auth)/onboarding');
      }
    } else if (inAuthGroup) {
      // Authenticated & onboarded user inside auth screens -> route to respective home
      if (isBuyer) {
        router.replace('/(app)/buyer/feed');
      } else {
        router.replace('/(app)/dashboard');
      }
    } else if (segments[0] === '(app)') {
      // Strict boundary: prevent Seller from being in Buyer tabs and vice-versa
      if (!isBuyer && (subRoute === 'buyer' || subRoute === 'cart' || subRoute === 'buyer-orders')) {
        router.replace('/(app)/dashboard');
      } else if (isBuyer && (subRoute === 'dashboard' || subRoute === 'catalog' || subRoute === 'orders' || subRoute === 'capture' || subRoute === 'product' || subRoute === 'analytics')) {
        router.replace('/(app)/buyer/feed');
      }
    }
  }, [session, role, hasCompletedOnboarding, isLoading, segments]);


  // Splash while auth state or fonts load
    if (isLoading || !fontsLoaded || !languageHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-artisan-canvas px-6">
        <StatusBar style="dark" />
        <Logo size={96} />
        <Text className="mt-6 text-3xl font-bold text-artisan-slate">Kala Vaani</Text>
        <Text className="text-lg text-artisan-muted">कलावाणी · కళావాణి</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 28 }} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          freezeOnBlur: false,
          contentStyle: { backgroundColor: COLORS.canvas },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

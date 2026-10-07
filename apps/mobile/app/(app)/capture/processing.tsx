import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sparkles, AlertCircle, RotateCcw, Edit3 } from 'lucide-react-native';
import { useDraftStore } from '../../../src/store/useDraftStore';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { generateProductCatalog } from '../../../src/lib/gemini';
import { Text, Button, COLORS } from '../../../src/components/ui';
import { useT } from '../../../src/i18n';

export default function ProcessingScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();

  // Role Protection Guard
  useEffect(() => {
    if (!isLoading && role && (role === 'BUYER' || role === 'B2B_BUYER')) {
      setTimeout(() => {
        router.replace('/(app)/buyer/feed');
      }, 0);
    }
  }, [role, isLoading, router]);

  const { imageUri, audioUri, setAiGeneratedData } = useDraftStore();

  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    {
      en: 'Analyzing Craft Photo & Textures...',
      hi: 'शिल्प की फोटो और बनावट का विश्लेषण...',
    },
    {
      en: 'Listening to your Voice Story...',
      hi: 'आपकी आवाज़ और कहानी को समझ रहे हैं...',
    },
    {
      en: 'Extracting Materials & Craft Heritage...',
      hi: 'पारंपरिक कला और सामग्री की पहचान...',
    },
    {
      en: 'Calculating Smart Fair Pricing...',
      hi: 'उचित बाज़ार मूल्य और विवरण तैयार...',
    },
  ];

  const processMediaWithAI = async () => {
    if (!imageUri) {
      setTimeout(() => {
        router.replace('/(app)/capture/image');
      }, 0);
      return;
    }

    try {
      setError(null);
      setLoadingStep(0);

      const stepInterval = setInterval(() => {
        setLoadingStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 1800);

      const catalogData = await generateProductCatalog(imageUri, audioUri);
      clearInterval(stepInterval);

      setAiGeneratedData(catalogData);
      router.replace('/(app)/capture/review');
    } catch (err: any) {
      console.error('AI processing error:', err);
      setError(
        err.message ||
          'Could not analyze craft with AI. Please check your internet or retry.',
      );
    }
  };

  useEffect(() => {
    processMediaWithAI();
  }, [imageUri, audioUri]);

  const handleManualFallback = () => {
    // Provide a default template so the artisan can fill the review form directly
    setAiGeneratedData({
      title: 'Handmade Craft',
      category: 'Traditional Crafts',
      shortDescription: 'Handcrafted piece made with traditional methods.',
      materials: ['Handmade Materials'],
      craftType: 'Traditional Art',
      suggestedPriceRange: '₹500 - ₹800',
    });
    router.replace('/(app)/capture/review');
  };

  return (
    <View
      className="flex-1 bg-artisan-canvas"
      style={{ paddingTop: Math.max(insets.top, 20) }}
    >
      <View className="flex-1 items-center justify-center px-5">
        {!error ? (
          <View key="working" className="w-full items-center">
            <View className="h-28 w-28 items-center justify-center rounded-full bg-artisan-light">
              <Sparkles color={COLORS.primary} size={60} />
            </View>
            <Text className="mt-6 text-center text-2xl font-bold text-artisan-slate">
                            {t('capture.creating')}
            </Text>

            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 28 }} />

            <View className="w-full rounded-2xl border border-artisan-border bg-white p-5">
              <Text className="text-center text-lg font-semibold text-artisan-slate">
                                {[t('capture.step1'), t('capture.step2'), t('capture.step3'), t('capture.step4')][loadingStep]}
              </Text>
            </View>

            <Text className="mt-6 text-center text-base text-artisan-muted">
              {t('common.pleaseWait')}
            </Text>
          </View>
        ) : (
          <View key="error" className="w-full items-center rounded-2xl border-2 border-red-200 bg-white p-5">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-red-50">
              <AlertCircle color={COLORS.error} size={44} />
            </View>
            <Text className="mt-4 text-center text-2xl font-bold text-artisan-slate">
                            {t('capture.notDone')}
            </Text>
            <Text className="mt-1 text-center text-base text-artisan-muted">{t('common.tryLater')}</Text>

            <View className="mt-6 w-full" style={{ gap: 12 }}>
              <Button
                key="btn-retry-ai"
                label={t('common.tryAgain')}
                icon={RotateCcw}
                onPress={processMediaWithAI}
              />
              <Button
                key="btn-manual-fallback"
                label={t('capture.fillMyself')}
                icon={Edit3}
                variant="secondary"
                onPress={handleManualFallback}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

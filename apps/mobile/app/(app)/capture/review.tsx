import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import {
  Layers,
  IndianRupee,
  Palette,
  Package,
  Save,
  Pencil,
} from 'lucide-react-native';

import { useDraftStore } from '../../../src/store/useDraftStore';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { supabase } from '../../../src/lib/supabase';
import { getApiBaseUrl } from '../../../src/lib/api';
import { useT, type TranslateFn } from '../../../src/i18n';
import {
  Text,
  Input,
  IconInput,
  Button,
  Field,
  ScreenHeader,
  StepBar,
  COLORS,
} from '../../../src/components/ui';

interface ReviewFormData {
  title: string;
  category: string;
  craftType: string;
  shortDescription: string;
  materials: string;
  suggestedPriceRange: string;
  maxOrderLimit: string;
}

export default function ReviewScreen() {
  const router = useRouter();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { role, isLoading } = useAuthStore();

  // Role Protection Guard
  useEffect(() => {
    if (!isLoading && role && (role === 'BUYER' || role === 'B2B_BUYER')) {
      router.replace('/(app)/buyer/feed');
    }
  }, [role, isLoading, router]);

  const { imageUri, imageUris, audioUri, aiGeneratedData, resetDraft } = useDraftStore();
  const [loadingState, setLoadingState] = useState<'idle' | 'publishing'>('idle');

  const { control, handleSubmit } = useForm<ReviewFormData>({
    defaultValues: {
      title: aiGeneratedData?.title || 'Handcrafted Craft Piece',
      category: aiGeneratedData?.category || 'Traditional Crafts',
      craftType: aiGeneratedData?.craftType || 'Folk Art',
      shortDescription:
        aiGeneratedData?.shortDescription ||
        'Handmade by traditional artisans with heritage techniques.',
      materials:
        aiGeneratedData?.materials?.join(', ') || 'Natural Materials, Pigments',
      suggestedPriceRange: aiGeneratedData?.suggestedPriceRange || '₹450 - ₹750',
      maxOrderLimit: '10',
    },
  });

  const publishDraftPhase = async (data: ReviewFormData): Promise<string> => {
    if (imageUris.length === 0) throw new Error('Product photo is missing.');

    const { session } = useAuthStore.getState();
    let accessToken = session?.access_token;
    if (!accessToken) {
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData.session?.access_token;
    }

    if (!accessToken) {
      router.replace('/(auth)/login');
      throw new Error('Authentication Required');
    }

    const formData = new FormData();
    // Every photo goes under "image"; the first one is the main photo
    imageUris.forEach((uri, index) => {
      const imageFilename = uri.split('/').pop() || `craft_photo_${index + 1}.jpg`;
      const imageExt = imageFilename.split('.').pop()?.toLowerCase() || 'jpg';
      const imageMime = imageExt === 'png' ? 'image/png' : 'image/jpeg';
      formData.append('image', {
        uri,
        name: imageFilename,
        type: imageMime,
      } as any);
    });

    if (audioUri) {
      const audioFilename = audioUri.split('/').pop() || 'craft_voice.m4a';
      const audioExt = audioFilename.split('.').pop()?.toLowerCase() || 'm4a';
      const audioMime =
        audioExt === 'mp3' ? 'audio/mp3' : audioExt === 'wav' ? 'audio/wav' : 'audio/mp4';
      formData.append('audio', {
        uri: audioUri,
        name: audioFilename,
        type: audioMime,
      } as any);
    }

    const catalogPayload = {
      title: data.title.trim(),
      category: data.category.trim(),
      craftType: data.craftType.trim(),
      shortDescription: data.shortDescription.trim(),
      materials: data.materials.split(',').map((m) => m.trim()).filter(Boolean),
      suggestedPriceRange: data.suggestedPriceRange.trim(),
      maxOrderLimit: parseInt(data.maxOrderLimit || '10', 10) || 10,
    };
    formData.append('payload', JSON.stringify(catalogPayload));

    const publishEndpoint = `${getApiBaseUrl()}/catalog/smart-publish`;
    const response = await fetch(publishEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const responseData = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(responseData.message || 'Failed to publish craft');

    const productId = responseData.id || responseData.product?.id;
    if (!productId) throw new Error('Failed to publish craft');
    return productId;
  };

  const handleBasicPublish = async (data: ReviewFormData) => {
    try {
      setLoadingState('publishing');
      const productId = await publishDraftPhase(data);
      resetDraft();
      router.replace(`/(app)/product/${productId}` as any);
    } catch (err: any) {
      Alert.alert(t('capture.saveFailed'), friendlyError(err.message, t));
    } finally {
      setLoadingState('idle');
    }
  };

  const busy = loadingState !== 'idle';

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader
        title={t('capture.checkSave')}
        onBack={() => router.back()}
        backDisabled={busy}
      />
      <StepBar step={3} labels={[t('capture.stepPhoto'), t('capture.stepVoice'), t('capture.stepCheck')]} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo + hint */}
        <View className="mb-5 flex-row items-center rounded-2xl border border-artisan-border bg-white p-3">
          {imageUri ? (
            <View>
              <Image
                source={{ uri: imageUri }}
                className="h-24 w-24 rounded-xl"
                resizeMode="cover"
              />
              {imageUris.length > 1 ? (
                <View
                  className="absolute bottom-1 right-1 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
                >
                  <Text className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
                    +{imageUris.length - 1}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-xl bg-stone-100">
              <Palette color={COLORS.muted} size={32} />
            </View>
          )}
          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Pencil color={COLORS.primary} size={18} />
              <Text className="ml-1.5 text-lg font-bold text-artisan-slate">{t('capture.editIfWrong')}</Text>
            </View>
          </View>
        </View>

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.name')}>
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                                className="font-bold"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="suggestedPriceRange"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.price')}>
              <IconInput
                icon={IndianRupee}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="₹500 - ₹800"
                style={{ borderColor: '#86EFAC', backgroundColor: '#F0FDF4', fontSize: 20 }}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="shortDescription"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.description')}>
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={4}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="materials"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.madeOf')} hint={t('capture.madeOfHint')}>
              <Input value={value} onChangeText={onChange} onBlur={onBlur} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="craftType"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.craft')}>
              <IconInput icon={Palette} value={value} onChangeText={onChange} onBlur={onBlur} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.category')}>
              <IconInput icon={Layers} value={value} onChangeText={onChange} onBlur={onBlur} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="maxOrderLimit"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field label={t('capture.maxPerOrder')}>
              <IconInput
                icon={Package}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="number-pad"
                placeholder="10"
              />
            </Field>
          )}
        />

        {/* Actions */}
        <View className="mt-2 border-t border-artisan-border pt-5" style={{ gap: 12 }}>
          <Button
            label={t('common.save')}
            icon={Save}
            loading={loadingState === 'publishing'}
            disabled={busy}
            onPress={handleSubmit(handleBasicPublish)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function friendlyError(message: string | undefined, t: TranslateFn): string {
  const m = (message || '').toLowerCase();
  if (m.includes('network') || m.includes('fetch') || m.includes('connect')) {
    return t('common.noInternet');
  }
  if (m.includes('authentication') || m.includes('unauthorized') || m.includes('jwt')) {
    return t('common.loginAgain');
  }
  if (m.includes('photo') || m.includes('image')) {
    return t('capture.photoMissing');
  }
  return t('common.somethingWrong');
}

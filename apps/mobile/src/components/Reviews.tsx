import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Star, Users, Send } from 'lucide-react-native';
import { Text, Input, Button, COLORS } from './ui';
import { useT, type TranslateFn } from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { getApiBaseUrl } from '../lib/api';

const STAR_COLOR = '#F59E0B';

export interface ProductRating {
  average: number | null;
  count: number;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment?: string | null;
  buyerName: string;
  updatedAt: string;
}

export function boughtLabel(buyerCount: number, t: TranslateFn, emptyKey: 'product.boughtNone' | 'product.beFirst') {
  if (!buyerCount) return t(emptyKey);
  return buyerCount === 1 ? t('product.boughtOne') : t('product.boughtMany', { n: buyerCount });
}

/** Five stars; tappable when `onChange` is given */
export function Stars({
  value,
  size = 16,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (value: number) => void;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: onChange ? 8 : 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            size={size}
            color={filled ? STAR_COLOR : COLORS.border}
            fill={filled ? STAR_COLOR : 'transparent'}
          />
        );
        return onChange ? (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n}`}
            hitSlop={6}
          >
            {star}
          </TouchableOpacity>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

/** "★ 4.5 (3) · Bought by 2 buyers" — used on cards and product pages */
export function ProductStatsLine({
  buyerCount = 0,
  rating,
  emptyKey,
  size = 'md',
}: {
  buyerCount?: number;
  rating?: ProductRating | null;
  emptyKey: 'product.boughtNone' | 'product.beFirst';
  size?: 'sm' | 'md';
}) {
  const { t } = useT();
  const textClass = size === 'sm' ? 'text-sm' : 'text-base';
  const icon = size === 'sm' ? 14 : 18;
  return (
    <View className="flex-row flex-wrap items-center" style={{ columnGap: 10, rowGap: 2 }}>
      {rating?.average ? (
        <View className="flex-row items-center">
          <Star size={icon} color={STAR_COLOR} fill={STAR_COLOR} />
          <Text className={`ml-1 ${textClass} font-bold text-artisan-slate`}>{rating.average.toFixed(1)}</Text>
          <Text className={`ml-1 ${textClass} text-artisan-muted`}>({rating.count})</Text>
        </View>
      ) : null}
      <View className="flex-row items-center">
        <Users color={COLORS.muted} size={icon} />
        <Text className={`ml-1.5 ${textClass} font-semibold text-artisan-slate`}>
          {boughtLabel(buyerCount, t, emptyKey)}
        </Text>
      </View>
    </View>
  );
}

/** Rating summary and the latest buyer reviews */
export function ReviewsSection({
  rating,
  reviews,
}: {
  rating?: ProductRating | null;
  reviews?: ProductReview[];
}) {
  const { t } = useT();
  const list = reviews ?? [];
  const count = rating?.count ?? list.length;

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-artisan-slate">{t('reviews.title')}</Text>
        {rating?.average ? (
          <View className="flex-row items-center">
            <Stars value={rating.average} />
            <Text className="ml-1.5 text-base font-bold text-artisan-slate">{rating.average.toFixed(1)}</Text>
            <Text className="ml-1 text-sm text-artisan-muted">
              · {count === 1 ? t('reviews.countOne') : t('reviews.countMany', { n: count })}
            </Text>
          </View>
        ) : null}
      </View>

      {list.length === 0 ? (
        <Text className="text-base text-artisan-muted">{t('reviews.none')}</Text>
      ) : (
        list.map((review, index) => (
          <View
            key={review.id}
            className={`py-3 ${index > 0 ? 'border-t border-artisan-border' : ''}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 pr-2 text-base font-bold text-artisan-slate" numberOfLines={1}>
                {review.buyerName}
              </Text>
              <Stars value={review.rating} size={14} />
            </View>
            {review.comment ? (
              <Text className="mt-1 text-base leading-6 text-artisan-slate">{review.comment}</Text>
            ) : null}
            <Text className="mt-1 text-sm text-artisan-muted">
              {new Date(review.updatedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

/** Bottom sheet where a buyer rates a delivered item */
export function RateItemModal({
  visible,
  productId,
  productTitle,
  initialRating = 0,
  initialComment = '',
  onClose,
  onSaved,
}: {
  visible: boolean;
  productId: string;
  productTitle: string;
  initialRating?: number;
  initialComment?: string;
  onClose: () => void;
  onSaved: (review: { rating: number; comment: string | null }) => void;
}) {
  const { t } = useT();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setComment(initialComment);
    }
  }, [visible, initialRating, initialComment]);

  const submit = async () => {
    if (!rating) {
      Alert.alert(t('reviews.pickStars'));
      return;
    }
    setSaving(true);
    try {
      const token = useAuthStore.getState().session?.access_token;
      const res = await fetch(`${getApiBaseUrl()}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        Alert.alert(t('reviews.failed'), res.status === 403 ? t('reviews.afterDelivery') : t('common.somethingWrong'));
        return;
      }
      onSaved({ rating, comment: comment.trim() || null });
      Alert.alert(t('reviews.thanks'));
    } catch {
      Alert.alert(t('reviews.failed'), t('common.checkInternet'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={saving ? undefined : onClose} />
        <View className="rounded-t-3xl bg-white p-5 pb-8">
          <Text className="text-xl font-bold text-artisan-slate">
            {initialRating ? t('reviews.edit') : t('reviews.rate')}
          </Text>
          <Text className="mt-1 text-base text-artisan-muted" numberOfLines={2}>
            {productTitle}
          </Text>

          <View className="my-5 items-center">
            <Stars value={rating} size={40} onChange={setRating} />
            <Text className="mt-2 text-sm text-artisan-muted">
              {rating ? t('reviews.yourRating') : t('reviews.pickStars')}
            </Text>
          </View>

          <Input
            value={comment}
            onChangeText={setComment}
            placeholder={t('reviews.commentPh')}
            multiline
            numberOfLines={3}
            maxLength={1000}
          />

          <View className="mt-4" style={{ gap: 10 }}>
            <Button label={t('reviews.submit')} icon={Send} loading={saving} onPress={submit} />
            <Button label={t('profile.cancel')} variant="ghost" disabled={saving} onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

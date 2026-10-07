import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Alert,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LogOut,
  Phone,
  Mail,
  Languages,
  Bell,
  MapPin,
  Home,
  Compass,
  Pencil,
  User,
  Store,
  Palette,
  Save,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useLanguageStore, type AppLanguage } from '../../src/store/useLanguageStore';
import { supabase } from '../../src/lib/supabase';
import { getApiBaseUrl } from '../../src/lib/api';
import {
  Text,
  Button,
  LanguagePicker,
  ScreenHeader,
  Field,
  IconInput,
  Input,
  COLORS,
} from '../../src/components/ui';
import { useT } from '../../src/i18n';

/** Editable profile fields (profile row + phone on the user row) */
interface ProfileDetails {
  fullName: string;
  phone: string;
  region: string;
  state: string;
  businessName: string;
  craftType: string;
  address: string;
}

export default function ProfileScreen() {
    const router = useRouter();
  const { t, language } = useT();
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const insets = useSafeAreaInsets();
  const { user, role, signOut, isLoading } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const isBuyer = role === 'BUYER' || role === 'B2B_BUYER';

  // Load saved details (district, state, shop…) from the backend
  const loadDetails = useCallback(async () => {
    const token = useAuthStore.getState().session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const me = await res.json();
      const p = me?.profile;
      setDetails({
        fullName: p?.fullName || '',
        phone: me?.phone || '',
        region: p?.region || '',
        state: p?.state || '',
        businessName: p?.businessName || '',
        craftType: p?.craftType || '',
        address: p?.address || '',
      });
    } catch {
      // Offline: fall back to what the account metadata has
    }
  }, []);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const artisanName =
    details?.fullName ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    t('onb.artisan');

  const artisanPhone =
    details?.phone || user?.phone || user?.user_metadata?.phone || t('profile.notAdded');

  const location = [details?.region, details?.state].filter(Boolean).join(', ');

  const handleSignOut = () => {
    Alert.alert(
            t('profile.logoutTitle'),
      t('profile.logoutMsg'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('common.yes'),
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  };

  // Switch the app language now and save it to the account (best effort) so it follows the user
  const handleLanguageChange = (next: AppLanguage) => {
    setLanguage(next);
    supabase.auth.updateUser({ data: { language: next } }).catch(() => {});
    const token = useAuthStore.getState().session?.access_token;
    if (token) {
      fetch(`${getApiBaseUrl()}/users/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredLanguage: next }),
      }).catch(() => {});
    }
  };

  const handleSaved = (saved: ProfileDetails) => {
    setDetails(saved);
    setIsEditing(false);
    Alert.alert(t('profile.saved'));
  };

  return (
    <View
      className="flex-1 bg-artisan-canvas"
      style={{ paddingTop: Math.max(insets.top, 20) + 8 }}
    >
      <View className="border-b border-artisan-border bg-white px-4 pb-3 pt-1">
        <Text className="text-2xl font-bold text-artisan-slate">{t('tabs.profile')}</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 110, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View className="mb-4 items-center rounded-2xl border border-artisan-border bg-white p-5">
          <View className="h-24 w-24 items-center justify-center rounded-full border-2 border-artisan-primary bg-artisan-light">
            <Text className="text-4xl font-bold text-artisan-primary">
              {artisanName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="mt-3 text-center text-2xl font-bold text-artisan-slate">{artisanName}</Text>
          <Text className="text-base text-artisan-muted">
            {isBuyer ? t('onb.buyer') : t('onb.artisan')}
          </Text>
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="mt-4 h-12 flex-row items-center justify-center rounded-xl px-5"
            style={{ borderWidth: 2, borderColor: COLORS.primary, backgroundColor: '#FFFFFF' }}
          >
            <Pencil color={COLORS.primary} size={20} />
            <Text className="ml-2 text-lg font-bold" style={{ color: COLORS.primary }}>
              {t('profile.edit')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contact */}
        <View className="mb-4 rounded-2xl border border-artisan-border bg-white">
          <InfoRow icon={Phone} label={t('onb.phone')} value={artisanPhone} />
          <View className="h-px bg-artisan-border" />
          <InfoRow icon={Mail} label={t('auth.email')} value={user?.email || '—'} />
          {location ? (
            <View key="row-location">
              <View className="h-px bg-artisan-border" />
              <InfoRow icon={MapPin} label={t('onb.district')} value={location} />
            </View>
          ) : null}
          {isBuyer && details?.address ? (
            <View key="row-address">
              <View className="h-px bg-artisan-border" />
              <InfoRow icon={Home} label={t('profile.address')} value={details.address} />
            </View>
          ) : null}
          {!isBuyer && details?.businessName ? (
            <View key="row-shop">
              <View className="h-px bg-artisan-border" />
              <InfoRow icon={Store} label={t('profile.shopName')} value={details.businessName} />
            </View>
          ) : null}
          {!isBuyer && details?.craftType ? (
            <View key="row-craft">
              <View className="h-px bg-artisan-border" />
              <InfoRow icon={Palette} label={t('profile.craft')} value={details.craftType} />
            </View>
          ) : null}
        </View>

        {/* Settings */}
        <View className="mb-6 rounded-2xl border border-artisan-border bg-white">
          <View className="p-4">
            <View className="mb-3 flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-artisan-light">
                <Languages color={COLORS.primary} size={22} />
              </View>
              <Text className="ml-3 flex-1 text-lg font-semibold text-artisan-slate">
                {t('lang.title')}
              </Text>
            </View>
            <LanguagePicker variant="row" value={language} onChange={handleLanguageChange} />
          </View>
          <View className="h-px bg-artisan-border" />
          <View className="flex-row items-center p-4">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-artisan-light">
              <Bell color={COLORS.primary} size={22} />
            </View>
            <Text className="ml-3 flex-1 text-lg font-semibold text-artisan-slate">
              {t('profile.orderAlerts')}
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Button
          label={t('profile.logout')}
          icon={LogOut}
          variant="danger"
          disabled={isLoading}
          onPress={handleSignOut}
        />
      </ScrollView>

      <Modal
        visible={isEditing}
        animationType="slide"
        onRequestClose={() => setIsEditing(false)}
      >
        {isEditing ? (
          <EditDetailsForm
            key="edit-form"
            initial={{
              fullName: details?.fullName || user?.user_metadata?.full_name || '',
              phone: details?.phone || user?.user_metadata?.phone || '',
              region: details?.region || '',
              state: details?.state || '',
              businessName: details?.businessName || '',
              craftType: details?.craftType || '',
              address: details?.address || '',
            }}
            isBuyer={isBuyer}
            onCancel={() => setIsEditing(false)}
            onSaved={handleSaved}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function EditDetailsForm({
  initial,
  isBuyer,
  onCancel,
  onSaved,
}: {
  initial: ProfileDetails;
  isBuyer: boolean;
  onCancel: () => void;
  onSaved: (saved: ProfileDetails) => void;
}) {
  const { t, language } = useT();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const [form, setForm] = useState<ProfileDetails>(initial);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const set = (key: keyof ProfileDetails) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const cleaned: ProfileDetails = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      region: form.region.trim(),
      state: form.state.trim(),
      businessName: form.businessName.trim(),
      craftType: form.craftType.trim(),
      address: form.address.trim(),
    };

    const nextErrors: typeof errors = {};
    if (!cleaned.fullName) nextErrors.fullName = t('onb.errName');
    if (cleaned.phone && cleaned.phone.replace(/\D/g, '').length < 10) {
      nextErrors.phone = t('profile.errPhone');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const token = useAuthStore.getState().session?.access_token;
    if (!token) {
      Alert.alert(t('common.loginRequired'), t('common.loginAgain'));
      return;
    }

    const payload: Record<string, string> = {
      fullName: cleaned.fullName,
      phone: cleaned.phone,
      region: cleaned.region,
      state: cleaned.state,
    };
    if (isBuyer) {
      payload.address = cleaned.address;
    } else {
      payload.businessName = cleaned.businessName;
      payload.craftType = cleaned.craftType;
    }

    setIsSaving(true);
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const endpoint = `${getApiBaseUrl()}/users/profile`;

      let res = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });

      // No profile row yet (onboarding could not reach the server) — create it instead
      if (res.status === 404) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, role, preferredLanguage: language }),
        });
      }

      if (res.status === 409) {
        setErrors({ phone: t('profile.phoneTaken') });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.warn('Profile update failed:', body);
        Alert.alert(t('profile.saveFailed'));
        return;
      }

      // Keep the account in sync so the name shows everywhere (best effort)
      await supabase.auth
        .updateUser({ data: { full_name: cleaned.fullName, phone: cleaned.phone } })
        .catch(() => {});

      onSaved(cleaned);
    } catch (err) {
      console.warn('Profile update network error:', err);
      Alert.alert(t('common.noInternet'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-artisan-canvas">
      <ScreenHeader title={t('profile.editTitle')} onBack={onCancel} backDisabled={isSaving} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field label={t('onb.fullName')} error={errors.fullName}>
            <IconInput
              icon={User}
              value={form.fullName}
              onChangeText={set('fullName')}
              placeholder={t('auth.namePlaceholder')}
            />
          </Field>

          <Field label={t('onb.phone')} error={errors.phone}>
            <IconInput
              icon={Phone}
              value={form.phone}
              onChangeText={set('phone')}
              placeholder="98765 43210"
              keyboardType="phone-pad"
            />
          </Field>

          <Field label={t('onb.district')}>
            <IconInput
              icon={MapPin}
              value={form.region}
              onChangeText={set('region')}
              placeholder={t('onb.districtPh')}
            />
          </Field>

          <Field label={t('onb.state')}>
            <IconInput
              icon={Compass}
              value={form.state}
              onChangeText={set('state')}
              placeholder={t('onb.statePh')}
            />
          </Field>

          {isBuyer ? (
            <Field key="buyer-address" label={t('profile.address')}>
              <Input
                value={form.address}
                onChangeText={set('address')}
                placeholder={t('profile.addressPh')}
                multiline
                numberOfLines={3}
              />
            </Field>
          ) : null}

          {!isBuyer ? (
            <View key="artisan-fields">
              <Field label={t('profile.shopName')}>
                <IconInput
                  icon={Store}
                  value={form.businessName}
                  onChangeText={set('businessName')}
                  placeholder={t('profile.shopNamePh')}
                />
              </Field>

              <Field label={t('profile.craft')}>
                <IconInput
                  icon={Palette}
                  value={form.craftType}
                  onChangeText={set('craftType')}
                  placeholder={t('profile.craftPh')}
                />
              </Field>
            </View>
          ) : null}

          <Button
            label={t('common.save')}
            icon={Save}
            loading={isSaving}
            onPress={handleSave}
            className="mt-2"
          />
          <Button
            label={t('profile.cancel')}
            variant="ghost"
            disabled={isSaving}
            onPress={onCancel}
            className="mt-2"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center p-4">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-artisan-light">
        <Icon color={COLORS.primary} size={22} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-sm text-artisan-muted">{label}</Text>
        <Text className="text-lg font-semibold text-artisan-slate" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

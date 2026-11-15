import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FingerprintRow } from '@/components/FingerprintRow';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, initials, naira, radius } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Me = { full_name: string; phone: string | null; identity_verified_at: string | null };

export default function Profile() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const [me, setMe] = useState<Me | null>(null);
  const [pending, setPending] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showBalance, setShowBalance] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        const [p, w, v] = await Promise.all([
          supabase.from('profiles').select('full_name, phone, identity_verified_at').eq('id', userId).maybeSingle(),
          supabase.from('wallets').select('balance_kobo').eq('user_id', userId).maybeSingle(),
          supabase.from('identity_verifications').select('id').eq('user_id', userId).eq('status', 'pending').limit(1),
        ]);
        if (!active) return;
        setMe((p.data as Me | null) ?? null);
        setBalance(w.data?.balance_kobo ?? 0);
        setPending(((v.data as unknown[] | null) ?? []).length > 0);
      })();
      return () => {
        active = false;
      };
    }, [userId]),
  );

  const verified = !!me?.identity_verified_at;
  const name = me?.full_name || 'Your profile';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.badge, verified ? styles.badgeOn : null]}>
              <Ionicons name={verified ? 'shield-checkmark' : 'shield-outline'} size={14} color={verified ? colors.brandDark : colors.muted} />
              <Text style={[styles.badgeText, verified && { color: colors.brandDark }]}>
                {verified ? 'Verified' : pending ? 'Being checked' : 'Unverified'}
              </Text>
            </View>
          </View>
        </View>

        {!verified && !pending ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/verify')} style={styles.verifyCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>Verify your identity</Text>
              <Text style={styles.verifyText}>It helps keep your care safe. Takes a minute.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.amberText} />
          </Pressable>
        ) : null}

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet balance</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showBalance ? 'Hide balance' : 'Show balance'}
            onPress={() => setShowBalance(!showBalance)}
            style={styles.eye}
          >
            <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
          <Text style={styles.walletAmount}>{showBalance ? (balance == null ? '…' : naira(balance)) : '₦ ••••'}</Text>
        </View>

        <View style={styles.quickRow}>
          <Quick icon="wallet-outline" label="Top up" onPress={() => router.push('/wallet')} />
          <Quick icon="person-outline" label="My details" onPress={() => router.push('/profile-edit')} />
          <Quick icon="folder-open-outline" label="Health record" onPress={() => router.push('/health-record')} />
        </View>

        <View style={styles.list}>
          <Row icon="pulse" label="Vitals" onPress={() => router.push('/vitals')} />
          <Row icon="document-text" label="Test results and scans" onPress={() => router.push('/records')} />
          <Row icon="lock-closed" label="Privacy notice" onPress={() => router.push('/privacy')} last />
        </View>

        <FingerprintRow />

        <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quick}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={26} color={colors.brand} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, !last && styles.rowLine]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },
  name: { fontSize: 24, fontWeight: '700', color: colors.ink },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  badgeOn: { backgroundColor: colors.brandTint, borderColor: colors.brandTint },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  verifyCard: {
    backgroundColor: colors.amberTint,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verifyTitle: { fontSize: 16, fontWeight: '700', color: colors.amberText },
  verifyText: { fontSize: 13, color: colors.amberText, lineHeight: 19 },
  walletCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 4 },
  walletLabel: { fontSize: 15, color: colors.ink },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  walletAmount: { flex: 1, textAlign: 'right', fontSize: 20, fontWeight: '700', color: colors.ink },
  quickRow: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14 },
  quick: { flex: 1, alignItems: 'center', gap: 8, minHeight: 88 },
  quickIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 13, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 14 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: '#E8EEEC' },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  logout: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#F2C4C0',
    backgroundColor: '#FBECEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 17, fontWeight: '700', color: colors.danger },
});

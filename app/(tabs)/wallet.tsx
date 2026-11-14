import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, naira, radius } from '@/lib/theme';

type Tx = { id: string; amount_kobo: number; description: string; created_at: string };

export default function Wallet() {
  const { session } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      let active = true;
      (async () => {
        const [wallet, history] = await Promise.all([
          supabase.from('wallets').select('balance_kobo').eq('user_id', userId).maybeSingle(),
          supabase
            .from('wallet_transactions')
            .select('id, amount_kobo, description, created_at')
            .eq('wallet_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30),
        ]);
        if (!active) return;
        setBalance(wallet.data?.balance_kobo ?? 0);
        setRows((history.data as Tx[] | null) ?? []);
      })();
      return () => {
        active = false;
      };
    }, [session?.user.id]),
  );

  if (balance == null) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>Wallet</Text>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>FAMILY WALLET</Text>
        <Text style={styles.balance}>{naira(balance)}</Text>
        {/* TODO: add money through the payment provider once its keys are connected. */}
        <Text style={styles.balanceNote}>Adding money switches on once the payment provider is connected.</Text>
      </View>
      <Text style={styles.section}>Recent</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No wallet activity yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{item.description}</Text>
              <Text style={styles.rowMeta}>
                {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <Text style={styles.amount}>
              {item.amount_kobo >= 0 ? '+' : '−'}
              {naira(Math.abs(item.amount_kobo))}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, paddingHorizontal: 20, paddingTop: 20 },
  balanceCard: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: 18, margin: 20, gap: 4 },
  balanceLabel: { fontSize: 12, fontWeight: '600', color: '#CFE9E3' },
  balance: { fontSize: 34, fontWeight: '700', color: '#FFFFFF' },
  balanceNote: { fontSize: 13, color: '#CFE9E3', lineHeight: 18 },
  section: { fontSize: 17, fontWeight: '600', color: colors.ink, paddingHorizontal: 20 },
  list: { padding: 20, gap: 8 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 24 },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.muted },
  amount: { fontSize: 14, fontWeight: '700', color: colors.ink },
});

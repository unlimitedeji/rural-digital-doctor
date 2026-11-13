import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Loading, Message } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, naira, radius } from '@/lib/theme';

type Doctor = {
  id: string;
  display_name: string;
  specialty: string;
  languages: string[];
  years_experience: number | null;
  fee_video_kobo: number;
  accepting_now: boolean;
};

export default function Doctors() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    supabase
      .from('doctors')
      .select('id, display_name, specialty, languages, years_experience, fee_video_kobo, accepting_now')
      .eq('verified', true)
      .order('accepting_now', { ascending: false })
      .order('display_name')
      .then(({ data, error: err }) => {
        if (err) setError('Could not load doctors. Check your network and try again.');
        else setDoctors((data as Doctor[]) ?? []);
      });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!doctors || !q) return doctors ?? [];
    return doctors.filter((d) => d.display_name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q));
  }, [doctors, query]);

  if (error) return <Message text={error} />;
  if (!doctors) return <Loading />;

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Name or specialty"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search doctors"
      />
      <FlatList
        data={shown}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No doctors found.</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: item.id } })}
            style={styles.card}
          >
            <View style={styles.top}>
              <Avatar name={item.display_name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={styles.meta}>
                  {item.specialty}
                  {item.years_experience != null ? ` · ${item.years_experience} yrs` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.fee}>{naira(item.fee_video_kobo)}</Text>
                <Text style={styles.small}>video visit</Text>
              </View>
            </View>
            <View style={styles.bottom}>
              <Text style={styles.small}>Speaks {item.languages.join(', ')}</Text>
              {item.accepting_now ? <Text style={styles.online}>Online now</Text> : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  search: {
    height: 48,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
  },
  list: { padding: 20, gap: 10 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E8EEEC',
    paddingTop: 10,
    gap: 8,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  fee: { fontSize: 15, fontWeight: '700', color: colors.ink },
  small: { fontSize: 12, color: colors.muted },
  online: { fontSize: 12, fontWeight: '700', color: colors.brand },
});

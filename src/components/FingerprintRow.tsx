import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useLock } from '@/lib/lock';
import { colors, radius } from '@/lib/theme';

/** A switch that turns the fingerprint lock on or off. Shown on the patient home and the doctor queue. */
export function FingerprintRow() {
  const { enabled, setEnabled } = useLock();
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Fingerprint lock</Text>
          <Text style={styles.note}>
            {enabled ? 'The app asks for your fingerprint when opened' : 'Keep your health records private on this phone'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={async (value) => setError(await setEnabled(value))}
          accessibilityLabel="Fingerprint lock"
          trackColor={{ true: colors.brand, false: '#8A9A9C' }}
          thumbColor="#FFFFFF"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  error: { fontSize: 13, color: colors.danger },
});

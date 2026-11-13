import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, initials, radius } from '@/lib/theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonOutline,
        (disabled || busy) && styles.buttonDisabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : colors.brand} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? '#FFFFFF' : colors.brand }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, note, selected, onPress }: { label: string; note?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipTextOn]}>{label}</Text>
      {note ? <Text style={[styles.chipNote, selected && styles.chipTextOn]}>{note}</Text> : null}
    </Pressable>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials(name)}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading() {
  return (
    <Centered>
      <ActivityIndicator color={colors.brand} size="large" />
    </Centered>
  );
}

export function Message({ text }: { text: string }) {
  return (
    <Centered>
      <Text style={styles.message}>{text}</Text>
    </Centered>
  );
}

const styles = StyleSheet.create({
  button: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonOutline: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.brand },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  chip: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipNote: { fontSize: 12, color: colors.muted },
  chipTextOn: { color: '#FFFFFF' },
  avatar: { backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brand, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.ground },
  message: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
});

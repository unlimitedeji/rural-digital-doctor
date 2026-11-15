import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '@/lib/theme';

/** A password box with a Show / Hide button, so people can check what they typed. */
export function PasswordInput({
  value,
  onChangeText,
  label = 'Password',
}: {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.box}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        onPress={() => setVisible(!visible)}
        style={styles.toggle}
        hitSlop={8}
      >
        <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, height: '100%', paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  toggle: { minWidth: 64, height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.brand },
});

import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '@/lib/theme';

// DRAFT for legal review. A Nigerian lawyer must check this against the Nigeria Data Protection Act 2023,
// and fill in the bracketed details, before the app is offered to the public.
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'Who we are',
    body: 'LanDu is run by [COMPANY NAME], [REGISTERED ADDRESS]. Contact our data protection officer at [EMAIL].',
  },
  {
    heading: 'What we collect',
    body: 'Your name, phone number, email, date of birth, sex, town and state, allergies, the reasons for your visits, the results and scans you upload, what your doctor writes after a visit, your prescriptions, lab tests and referrals, and your payments.',
  },
  {
    heading: 'Why we collect it',
    body: 'To connect you with licensed health workers, to let them care for you safely, to send your prescriptions and lab orders where you choose, and to take payment. We do not sell your information.',
  },
  {
    heading: 'Who can see it',
    body: 'A health worker sees your details only when you book with them, and a result or scan only when you share it with them. A pharmacy or lab sees only the order you send to it, with your name and phone number. Family who pay for your care see receipts, not your health details.',
  },
  {
    heading: 'Where it is stored',
    body: 'Your information is stored securely by our technology providers, in data centres outside Nigeria. [Lawyer to confirm the legal basis for this transfer.]',
  },
  {
    heading: 'How long we keep it',
    body: '[RETENTION PERIOD, to be set with your medical lead and lawyer.]',
  },
  {
    heading: 'Your rights',
    body: 'You can ask to see, correct or delete your information, or withdraw your consent, by contacting [EMAIL]. Withdrawing consent means we can no longer arrange care for you through the app.',
  },
  {
    heading: 'Not for emergencies',
    body: 'LanDu is not an emergency service. If someone is in danger, go to the nearest health facility now.',
  },
];

export default function Privacy() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.draft}>Draft notice: final wording to be confirmed.</Text>
      {SECTIONS.map((s) => (
        <Text key={s.heading} style={styles.body}>
          <Text style={styles.heading}>{s.heading}{'\n'}</Text>
          {s.body}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16 },
  draft: { fontSize: 13, color: colors.amberText, backgroundColor: colors.amberTint, borderRadius: 12, padding: 10, overflow: 'hidden' },
  heading: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.ink },
});

// Issues a short-lived Agora call pass for one visit.
// Only the visit's patient or doctor gets one, only for a paid video or audio visit,
// and only from 10 minutes before the start until 30 minutes after the end.
// The App Certificate never leaves the server.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import AgoraToken from 'npm:agora-token@2.0.7';

const { RtcTokenBuilder, RtcRole } = AgoraToken;

const APP_ID = Deno.env.get('AGORA_APP_ID') ?? '991f591e17944c23a195ae66c85f730b';
const CERT = Deno.env.get('AGORA_APP_CERTIFICATE') ?? '';
const EARLY_MS = 10 * 60 * 1000;
const LATE_MS = 30 * 60 * 1000;
const MAX_TOKEN_S = 2 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fixed call ids, so each side knows who the other is.
const PATIENT_UID = 1;
const DOCTOR_UID = 2;

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Not allowed' });
  if (!CERT) {
    console.error('AGORA_APP_CERTIFICATE is not set');
    return reply(500, { error: 'Calls are not available right now.' });
  }

  let appointmentId = '';
  try {
    appointmentId = String((await req.json())?.appointment_id ?? '');
  } catch {
    return reply(400, { error: 'Bad request' });
  }
  if (!UUID.test(appointmentId)) return reply(400, { error: 'Bad request' });

  // Act as the caller: row-level security only shows a visit to its own patient and doctor.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return reply(401, { error: 'Please sign in again.' });
  const userId = auth.user.id;

  const { data: visit, error } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, mode, status, starts_at, ends_at')
    .eq('id', appointmentId)
    .maybeSingle();
  if (error) {
    console.error('appointment lookup failed', error.code);
    return reply(500, { error: 'Could not start the call. Try again.' });
  }
  if (!visit) return reply(404, { error: 'Visit not found.' });

  const role = visit.patient_id === userId ? 'patient' : visit.doctor_id === userId ? 'doctor' : null;
  if (!role) return reply(404, { error: 'Visit not found.' });
  if (visit.mode !== 'video' && visit.mode !== 'audio') return reply(400, { error: 'This is a clinic visit, not a call.' });
  if (visit.status !== 'confirmed' && visit.status !== 'in_progress') {
    return reply(409, { error: visit.status === 'pending_payment' ? 'This visit is not paid yet.' : 'This visit is closed.' });
  }

  const now = Date.now();
  const opens = new Date(visit.starts_at).getTime() - EARLY_MS;
  const closes = new Date(visit.ends_at).getTime() + LATE_MS;
  if (now < opens) return reply(409, { error: 'The call opens 10 minutes before the visit.', opensAt: new Date(opens).toISOString() });
  if (now > closes) return reply(409, { error: 'The time for this call has passed.' });

  const seconds = Math.max(60, Math.min(MAX_TOKEN_S, Math.floor((closes - now) / 1000)));
  const uid = role === 'patient' ? PATIENT_UID : DOCTOR_UID;
  const channel = visit.id;
  const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, CERT, channel, uid, RtcRole.PUBLISHER, seconds, seconds);

  return reply(200, {
    appId: APP_ID,
    channel,
    uid,
    otherUid: role === 'patient' ? DOCTOR_UID : PATIENT_UID,
    token,
    role,
    mode: visit.mode,
    expiresAt: new Date(now + seconds * 1000).toISOString(),
  });
});

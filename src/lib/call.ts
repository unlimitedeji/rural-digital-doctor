import { supabase } from './supabase';

/** Matches the server: calls open 10 minutes before a visit and close 30 minutes after it ends. */
export const CALL_OPENS_MIN = 10;
export const CALL_CLOSES_MIN = 30;

type Visit = { mode: string; status: string; starts_at: string; ends_at?: string | null };

export function isCallVisit(v: Visit): boolean {
  return (v.mode === 'video' || v.mode === 'audio') && (v.status === 'confirmed' || v.status === 'in_progress');
}

/** 'early' before the call opens, 'open' while it can be joined, 'closed' after. */
export function callWindow(v: Visit, now = Date.now()): 'early' | 'open' | 'closed' {
  const start = new Date(v.starts_at).getTime();
  const end = v.ends_at ? new Date(v.ends_at).getTime() : start + 30 * 60 * 1000;
  if (now < start - CALL_OPENS_MIN * 60 * 1000) return 'early';
  if (now > end + CALL_CLOSES_MIN * 60 * 1000) return 'closed';
  return 'open';
}

export type CallPass = {
  appId: string;
  channel: string;
  uid: number;
  otherUid: number;
  token: string;
  role: 'patient' | 'doctor';
  mode: 'video' | 'audio';
  expiresAt: string;
};

/** Asks the server for a call pass. It checks who is asking, the payment and the time. */
export async function getCallPass(appointmentId: string): Promise<{ pass?: CallPass; error?: string }> {
  const { data, error } = await supabase.functions.invoke('agora-token', { body: { appointment_id: appointmentId } });
  if (!error && data?.token) return { pass: data as CallPass };
  let message = 'Could not start the call. Check your network and try again.';
  try {
    // The server's own messages are written for patients and doctors.
    const body = await (error as { context?: Response })?.context?.json();
    if (body?.error && typeof body.error === 'string' && body.error.length < 120) message = body.error;
  } catch {
    // Keep the general message.
  }
  return { error: message };
}

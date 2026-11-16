type AnyError = { code?: string; message?: string; status?: number } | null | undefined;

/**
 * Turns a server error into text that is safe to show a patient or doctor.
 * Only messages our own database functions raise on purpose (Postgres code P0001) are passed through,
 * because they are written for users. Everything else (table names, policy names, stack details)
 * is replaced with the fallback and logged for developers only.
 */
export function safeMessage(error: AnyError, fallback: string): string {
  if (!error) return fallback;
  if (error.code === 'P0001' && error.message && error.message.length <= 200) return error.message;
  if (__DEV__) console.warn('[server error]', error.code, error.message);
  return fallback;
}

/** Safe wording for Supabase Auth errors on the sign-in screen. */
export function authMessage(error: AnyError, creating: boolean): string {
  const code = error?.code ?? '';
  const status = error?.status ?? 0;
  if (__DEV__) console.warn('[auth error]', code, status, error?.message);
  if (status === 429 || code.includes('rate_limit')) return 'Too many tries. Please wait a few minutes and try again.';
  if (code === 'weak_password') return 'Choose a stronger password: at least 8 characters, not a common one.';
  if (code === 'email_not_confirmed') return 'Confirm your email first. Check your inbox for our link.';
  if (code === 'invalid_credentials') return 'Wrong email or password. Tap Forgot password to choose a new one.';
  if (code === 'signup_disabled') return 'New accounts are closed for now.';
  return creating ? 'Could not create the account. Please try again.' : 'Could not sign in. Please try again.';
}

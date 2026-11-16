import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase, supabaseKey, supabaseUrl } from './supabase';

/** Whether Google sign-in has been switched on for the Supabase project. The button is hidden until it is. */
export async function googleSignInAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

/** Opens Google's sign-in page and signs the user in. Returns an error message, or null on success or cancel. */
export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return 'Could not start Google sign-in. Check your network and try again.';

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;

  // With PKCE, Google returns a one-time code that only this phone can exchange for a session.
  const code = new URL(result.url).searchParams.get('code');
  if (!code) return 'Google sign-in did not complete. Please try again.';
  const session = await supabase.auth.exchangeCodeForSession(code);
  return session.error ? 'Google sign-in did not complete. Please try again.' : null;
}

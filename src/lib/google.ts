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

  // Supabase returns the session in the part of the address after '#'.
  const fragment = result.url.split('#')[1] ?? result.url.split('?')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    return params.get('error_description') ?? 'Google sign-in did not complete. Please try again.';
  }
  const session = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return session.error ? 'Google sign-in did not complete. Please try again.' : null;
}

import { Redirect } from 'expo-router';

// Google sign-in returns to the app at this address. The session is set by the sign-in screen; just go home.
export default function AuthCallback() {
  return <Redirect href="/" />;
}

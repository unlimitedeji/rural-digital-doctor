// Agora project "Rural doctor". The App ID is public and ships inside the app.
// The App Certificate is a secret: it lives only in the Supabase secret store as
// AGORA_APP_CERTIFICATE and is used on the server to create a call token per visit.
export const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '991f591e17944c23a195ae66c85f730b';

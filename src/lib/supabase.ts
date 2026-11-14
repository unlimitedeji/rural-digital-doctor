import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Public values: the publishable key is designed to ship inside the app.
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://nspcfsujugrfagievcos.supabase.co';
export const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_bnMzjZ_CBHD5biOsdP6GXg_JLTcXh8q';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

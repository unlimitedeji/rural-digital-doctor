import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

export type Profile = { id: string; role: 'patient' | 'doctor' | 'admin'; full_name: string };

/** The signed-in user's own profile. The role decides whether they see the patient or the doctor screens. */
export function useProfile(): { profile: Profile | null; loading: boolean } {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<{ profile: Profile | null; loading: boolean }>({ profile: null, loading: true });

  useEffect(() => {
    if (!userId) {
      setState({ profile: null, loading: false });
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setState({ profile: (data as Profile | null) ?? null, loading: false });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}

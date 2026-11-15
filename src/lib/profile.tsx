import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

export type Role = 'patient' | 'doctor' | 'admin' | 'partner';
export type Profile = { id: string; role: Role; full_name: string; consent_at: string | null };

type ProfileState = { profile: Profile | null; loading: boolean; reload: () => Promise<void> };

const ProfileContext = createContext<ProfileState>({ profile: null, loading: true, reload: async () => {} });

/** Loads the signed-in user's own profile once, and lets screens reload it after a change. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, consent_at')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  return <ProfileContext.Provider value={{ profile, loading, reload }}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileState {
  return useContext(ProfileContext);
}

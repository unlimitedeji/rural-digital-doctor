import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

/** aal1 = password only; aal2 = password plus an authenticator code in this session. */
export type Aal = { current: string | null; next: string | null };
type AuthState = { session: Session | null; loading: boolean; aal: Aal };

const NO_AAL: Aal = { current: null, next: null };
const AuthContext = createContext<AuthState>({ session: null, loading: true, aal: NO_AAL });

async function readAal(session: Session | null): Promise<Aal> {
  if (!session) return NO_AAL;
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel ?? null, next: data?.nextLevel ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, aal: NO_AAL });

  useEffect(() => {
    let alive = true;
    const apply = async (session: Session | null) => {
      const aal = await readAal(session);
      if (alive) setState({ session, loading: false, aal });
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never await Supabase calls inside this callback; schedule them instead.
      setTimeout(() => apply(session), 0);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** True when the account has two-step sign-in but this session has not entered a code yet. */
export function needsCode(aal: Aal): boolean {
  return aal.next === 'aal2' && aal.current !== 'aal2';
}

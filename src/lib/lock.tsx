import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

const STORAGE_KEY = 'rdd.fingerprintLock';
// Taking a photo or choosing a file sends the app to the background briefly; only lock after a longer absence.
const RELOCK_AFTER_MS = 60_000;

type LockState = {
  /** The user has switched the fingerprint lock on. */
  enabled: boolean;
  /** The lock is on and the app has not been unlocked yet. */
  locked: boolean;
  ready: boolean;
  /** Ask for the fingerprint (or the phone's PIN as a fallback). Returns whether it passed. */
  unlock: () => Promise<boolean>;
  /** Turn the lock on or off. Either way the user must pass the check first. Returns an error message or null. */
  setEnabled: (value: boolean) => Promise<string | null>;
};

const LockContext = createContext<LockState>({
  enabled: false,
  locked: false,
  ready: false,
  unlock: async () => false,
  setEnabled: async () => null,
});

async function check(prompt: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt });
  return result.success;
}

export function LockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setEnabledState(value === 'on');
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        leftAt.current = Date.now();
      } else if (state === 'active' && leftAt.current != null) {
        if (Date.now() - leftAt.current > RELOCK_AFTER_MS) setUnlocked(false);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    const ok = await check('Unlock Rural Digital Doctor');
    if (ok) setUnlocked(true);
    return ok;
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (value && !hasHardware) return 'This phone has no fingerprint reader.';
    if (value && !enrolled) return 'Add a fingerprint in your phone settings first.';
    const ok = await check(value ? 'Confirm to turn on fingerprint lock' : 'Confirm to turn off fingerprint lock');
    if (!ok) return 'Fingerprint not confirmed.';
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
    setEnabledState(value);
    setUnlocked(true);
    return null;
  }, []);

  return (
    <LockContext.Provider value={{ enabled, locked: enabled && !unlocked, ready, unlock, setEnabled }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock(): LockState {
  return useContext(LockContext);
}

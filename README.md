# Rural Digital Doctor

Mobile app (Android and iOS) for booking doctor visits, paying, video or audio consultations, uploading test results and scans, and receiving prescriptions. Built with Expo (React Native) and Supabase.

## Status

Version 0.1, first slice. The code installs, passes the type-check and bundles for Android. **It has not yet been run on a phone.**

Working in code so far:

- Sign up and sign in (email and password for now; phone number sign-in follows once an SMS provider is set up)
- Home, find a doctor, doctor profile with time slots, booking
- My visits
- Payment screen (shows the amount; payment provider not connected yet)

Not built yet: payments, video and audio calls, results and scans upload, prescriptions, wallet, and the doctor-side screens.

## First run

```bash
npm install
npm run typecheck
npm start
```

## Backend

Supabase project `rural-digital-doctor` (London). The schema was applied as migration `initial_schema_v1` and is recorded in the project's migration history. Every table has row level security. Fees, appointment status and all money movements are set on the server, not by the app.

Doctors cannot register themselves as doctors. A doctor signs up like any user, then an admin adds their `doctors` row and sets `verified` after checking their MDCN licence.

Weekdays in `doctor_availability` use 0 = Sunday to 6 = Saturday.

## Configuration

The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` if set, and otherwise uses the project's public URL and publishable key in `src/lib/supabase.ts`. The publishable key is safe to ship in the app. Never put a secret or service-role key in this repository.

import { supabase } from './supabase';

export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60);
}

/** Uploads a file picked on the phone to private storage. Returns an error message, or null on success. */
export async function uploadFile(bucket: string, path: string, uri: string, mimeType: string): Promise<string | null> {
  try {
    const body = await (await fetch(uri)).arrayBuffer();
    const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: mimeType, upsert: true });
    return error ? 'Could not upload. Check your network and try again.' : null;
  } catch {
    return 'Could not upload. Check your network and try again.';
  }
}

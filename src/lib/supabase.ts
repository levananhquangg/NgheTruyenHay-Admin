import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

export const isSupabaseConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT_REF') && !key.includes('REPLACE_WITH_YOUR_KEY'))
export const supabase = createClient(url || 'https://example.supabase.co', key || 'unconfigured-publishable-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const buckets = {
  covers: 'story-covers',
  texts: 'story-texts',
  audio: 'story-audio',
} as const

export function publicAssetURL(bucket: string, path: string | null) {
  if (!path || !url) return null
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

import { supabase } from './supabase'

export type DashboardKpis = {
  active_devices: number
  new_devices: number
  sessions: number
  story_opens: number
  reader_opens: number
  listen_starts: number
  completions: number
  downloads: number
  listen_minutes: number
  ratings_submitted: number
  comments_submitted: number
  comments_pending: number
  ratings_pending: number
  ratings_total: number
  rating_average: number
  revenue_cents: number
  purchases: number
  refunds: number
}

export type SeriesPoint = {
  day: string
  active_devices: number
  story_opens: number
  listens: number
  downloads: number
}

export type LeaderboardStory = {
  story_id: string
  title: string
  author: string
  category: string
  rating_average: number
  rating_count: number
  story_opens: number
  listen_starts: number
  completions: number
  listen_minutes: number
  downloads: number
  like_count: number
  dislike_count: number
  score: number
}

export type ReviewPreview = {
  id: string
  story_id: string
  story_title: string
  display_name: string
  rating: number
  review: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export type CommentPreview = {
  id: string
  story_id: string
  story_title: string
  display_name: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export type DashboardData = {
  range_days: number
  generated_at: string
  kpis: DashboardKpis
  series: SeriesPoint[]
  top_stories: LeaderboardStory[]
  rating_distribution: Array<{ rating: number; count: number }>
  recent_reviews: ReviewPreview[]
  recent_comments: CommentPreview[]
  events_by_name: Array<{ event_name: string; count: number }>
  funnel: {
    paywall_views: number
    plan_selects: number
    purchase_taps: number
    purchase_success: number
    purchase_cancel: number
    purchase_fail: number
  }
}

export type StoryRating = {
  id: string
  story_id: string
  display_name: string
  rating: number
  review: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export type StoryComment = {
  id: string
  story_id: string
  display_name: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
  admin_reply: string | null
  admin_replied_at: string | null
  created_at: string
  updated_at: string
}

export type StoryOption = { id: string; title: string }

export type RatingRow = StoryRating & { story_title: string }
export type CommentRow = StoryComment & { story_title: string }

export type SubscriptionFeedback = {
  id: string
  stage: 'cancel' | 'refund' | 'purchase_hesitation' | 'support'
  plan: string | null
  reason_code: string | null
  reason_text: string | null
  created_at: string
}

export type PurchaseRow = {
  id: string
  product_id: string
  purchased_at: string
  expires_at: string | null
  price_cents: number | null
  currency: string
  status: string
  environment: string | null
}

export type AuditEntry = {
  id: number
  action: string
  entity: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
  actor_id: string | null
}

export type AdminMembership = {
  user_id: string
  role: 'owner' | 'admin' | 'editor' | 'analyst' | 'support'
  display_name: string | null
  created_at: string
}

export async function fetchDashboard(days: number): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('admin_dashboard', { p_days: days })
  if (error) throw new Error(error.message)
  return data as DashboardData
}

async function fetchStoryMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('stories').select('id,title')
  if (error) throw new Error(error.message)
  return new Map(((data ?? []) as StoryOption[]).map(story => [story.id, story.title]))
}

export async function fetchRatings(): Promise<RatingRow[]> {
  const [{ data, error }, titles] = await Promise.all([
    supabase.from('story_ratings').select('*').order('created_at', { ascending: false }).limit(500),
    fetchStoryMap(),
  ])
  if (error) throw new Error(error.message)
  return ((data ?? []) as StoryRating[]).map(row => ({
    ...row,
    story_title: titles.get(row.story_id) ?? 'Truyện đã xóa',
  }))
}

export async function fetchComments(): Promise<CommentRow[]> {
  const [{ data, error }, titles] = await Promise.all([
    supabase.from('story_comments').select('*').order('created_at', { ascending: false }).limit(500),
    fetchStoryMap(),
  ])
  if (error) throw new Error(error.message)
  return ((data ?? []) as StoryComment[]).map(row => ({
    ...row,
    story_title: titles.get(row.story_id) ?? 'Truyện đã xóa',
  }))
}

export async function setRatingStatus(id: string, status: StoryRating['status']) {
  const { error } = await supabase.from('story_ratings').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteRating(id: string) {
  const { error } = await supabase.from('story_ratings').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setCommentStatus(id: string, status: StoryComment['status']) {
  const { error } = await supabase.from('story_comments').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveCommentReply(id: string, reply: string) {
  const trimmed = reply.trim()
  const { error } = await supabase.from('story_comments').update({
    admin_reply: trimmed || null,
    admin_replied_at: trimmed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('story_comments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchSubscriptionFeedback(): Promise<SubscriptionFeedback[]> {
  const { data, error } = await supabase
    .from('subscription_feedback')
    .select('id,stage,plan,reason_code,reason_text,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as SubscriptionFeedback[]
}

export async function fetchPurchases(): Promise<PurchaseRow[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id,product_id,purchased_at,expires_at,price_cents,currency,status,environment')
    .order('purchased_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as PurchaseRow[]
}

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id,action,entity,entity_id,details,created_at,actor_id')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return (data ?? []) as AuditEntry[]
}

export async function fetchAdminMembership(userID: string): Promise<AdminMembership | null> {
  const { data, error } = await supabase
    .from('story_admins')
    .select('user_id,role,display_name,created_at')
    .eq('user_id', userID)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as AdminMembership | null
}

export function friendlyDashboardError(message: string): string {
  if (message.includes('admin_dashboard') || message.includes('schema cache') || message.includes('Could not find the function')) {
    return 'Chưa cài migration 202610230002_community_analytics.sql trên Supabase. Chạy migration rồi tải lại trang.'
  }
  if (message.includes('not authorized')) {
    return 'Tài khoản này chưa có quyền xem dashboard. Thêm user vào public.story_admins.'
  }
  return message
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}tr`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString('vi-VN')
}

export function formatDate(value: string, withTime = false): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', withTime
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatVND(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(cents)
}

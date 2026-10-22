export type StoryType = 'short_story' | 'novel' | 'series' | 'audio'
export type TagKind = 'genre' | 'tag' | 'theme'

export type TagRecord = {
  id: string
  slug: string
  name: string
  kind: TagKind
  description: string
  color: string
  icon: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type PlanRecord = {
  id: string
  code: string
  name: string
  description: string
  tier: number
  billing_period: 'free' | 'month' | 'year' | 'lifetime'
  price_vnd: number
  original_price_vnd: number | null
  currency: string
  features: string[]
  entitlements: Record<string, boolean>
  app_store_product_id: string | null
  is_active: boolean
  is_featured: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type PlanSaleRecord = {
  id: string
  plan_id: string
  name: string
  discount_percent: number
  starts_at: string
  ends_at: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type VoucherType = 'percent' | 'fixed' | 'trial'

export type VoucherRecord = {
  id: string
  code: string
  name: string
  description: string
  voucher_type: VoucherType
  discount_percent: number | null
  discount_amount_vnd: number | null
  trial_days: number | null
  max_discount_vnd: number | null
  min_order_vnd: number
  starts_at: string
  ends_at: string | null
  usage_limit: number | null
  per_device_limit: number
  used_count: number
  app_store_offer_code: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  voucher_plans?: { plan_id: string }[]
}

export type VoucherValidation = {
  valid: boolean
  reason_code?: string
  message?: string
  voucher_id?: string
  code?: string
  name?: string
  voucher_type?: VoucherType
  discount_percent?: number | null
  discount_amount_vnd?: number
  trial_days?: number | null
  base_price_vnd?: number
  sale_percent?: number
  sale_price_vnd?: number
  final_price_vnd?: number
  currency?: string
  plan_id?: string
  plan_code?: string
  app_store_offer_code?: string | null
  ends_at?: string | null
}

export type ChapterDraft = {
  id: string
  volumeTitle: string | null
  chapterNumber: number
  title: string
  content: string
  wordCount: number
  sortOrder: number
  isPreview: boolean
}

export type ParsedStory = {
  chapters: ChapterDraft[]
  volumeTitles: string[]
  characterCount: number
  recommendedType: StoryType
  warnings: string[]
}

export type StoryScheduleState = {
  is_published: boolean
  scheduled_at: string | null
}

export const ENTITLEMENT_OPTIONS = [
  { key: 'offline_downloads', label: 'Tải về nghe ngoại tuyến' },
  { key: 'cross_device_sync', label: 'Đồng bộ tiến độ giữa thiết bị' },
  { key: 'exclusive_stories', label: 'Mở khóa truyện độc quyền' },
  { key: 'early_access', label: 'Nghe sớm trước ngày mở' },
  { key: 'ad_free', label: 'Không quảng cáo' },
  { key: 'sleep_timer', label: 'Hẹn giờ ngủ nâng cao' },
] as const

export const STORY_TYPE_OPTIONS: { value: StoryType; label: string; hint: string }[] = [
  { value: 'short_story', label: 'Truyện ngắn', hint: 'Một mạch nội dung' },
  { value: 'novel', label: 'Tiểu thuyết', hint: 'Nhiều chương, có thể có quyển' },
  { value: 'series', label: 'Truyện dài kỳ', hint: 'Nhiều phần phát hành dần' },
  { value: 'audio', label: 'Sách nói', hint: 'Nội dung audio là chính' },
]

export const BILLING_PERIOD_LABELS: Record<PlanRecord['billing_period'], string> = {
  free: 'Miễn phí',
  month: 'Mỗi tháng',
  year: 'Mỗi năm',
  lifetime: 'Một lần',
}

export function storyTypeLabel(type: StoryType) {
  return STORY_TYPE_OPTIONS.find(option => option.value === type)?.label ?? 'Truyện ngắn'
}

export function formatVND(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${Math.max(0, Math.round(value)).toLocaleString('vi-VN')} ₫`
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', withTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocal(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function isUpcoming(story: StoryScheduleState) {
  return Boolean(story.is_published && story.scheduled_at && new Date(story.scheduled_at).getTime() > Date.now())
}

export function storyStatus(story: StoryScheduleState) {
  if (!story.is_published) return { tone: 'draft', label: 'Bản nháp' }
  if (isUpcoming(story)) return { tone: 'scheduled', label: 'Sắp ra mắt' }
  return { tone: 'published', label: 'Đã xuất bản' }
}

export function countdownLabel(value: string | null | undefined) {
  if (!value) return ''
  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return ''
  const diff = target - Date.now()
  if (diff <= 0) return 'Đã đến giờ mở'
  const minutes = Math.floor(diff / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remainingMinutes = minutes % 60
  if (days > 0) return `${days} ngày ${hours} giờ`
  if (hours > 0) return `${hours} giờ ${remainingMinutes} phút`
  return `${Math.max(1, remainingMinutes)} phút`
}

export function voucherStatus(voucher: VoucherRecord) {
  const now = Date.now()
  if (!voucher.is_active) return { tone: 'paused', label: 'Tạm dừng' }
  if (new Date(voucher.starts_at).getTime() > now) return { tone: 'scheduled', label: 'Chưa bắt đầu' }
  if (voucher.ends_at && new Date(voucher.ends_at).getTime() <= now) return { tone: 'expired', label: 'Hết hạn' }
  if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) return { tone: 'expired', label: 'Hết lượt' }
  return { tone: 'active', label: 'Đang hoạt động' }
}

export function voucherTypeLabel(type: VoucherType) {
  if (type === 'fixed') return 'Giảm số tiền'
  if (type === 'trial') return 'Dùng thử'
  return 'Giảm phần trăm'
}

export function slugify(value: string) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function normalizeVoucherCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function countWords(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }

function romanToNumber(value: string) {
  const chars = value.toLowerCase().split('')
  if (!chars.every(char => char in ROMAN_VALUES)) return null
  let total = 0
  for (let index = 0; index < chars.length; index += 1) {
    const current = ROMAN_VALUES[chars[index]]
    const next = ROMAN_VALUES[chars[index + 1]] ?? 0
    total += current < next ? -current : current
  }
  return total > 0 ? total : null
}

type Heading = { kind: 'volume' | 'chapter'; title: string; number: number }
type ParsedLine = { heading: Heading | null; numbered: Heading | null; text: string }

const VOLUME_PATTERN = /^(quyển|tập|phần|volume|book|part)\s+([0-9]+|[ivxlcdm]+)(?:\s*[:.\-–—]\s*|\s*$|\s+)(.*)$/i
const CHAPTER_PATTERN = /^(chương|chapter|hồi|tiết)\s+([0-9]+|[ivxlcdm]+)(?:\s*[:.\-–—]\s*|\s*$|\s+)(.*)$/i
const NUMBERED_PATTERN = /^([0-9]{1,4})[.)]\s+(.{2,180})$/

function classifyLine(line: string): ParsedLine {
  const stripped = line.trim().replace(/^#{1,6}\s*/, '').trim()
  const text = line
  if (!stripped || stripped.length > 220) return { heading: null, numbered: null, text }

  const volumeMatch = stripped.match(VOLUME_PATTERN)
  if (volumeMatch) {
    return {
      heading: {
        kind: 'volume',
        title: stripped,
        number: Number(volumeMatch[2]) || romanToNumber(volumeMatch[2]) || 1,
      },
      numbered: null,
      text,
    }
  }

  const chapterMatch = stripped.match(CHAPTER_PATTERN)
  if (chapterMatch) {
    return {
      heading: {
        kind: 'chapter',
        title: stripped,
        number: Number(chapterMatch[2]) || romanToNumber(chapterMatch[2]) || 1,
      },
      numbered: null,
      text,
    }
  }

  const numberedMatch = stripped.match(NUMBERED_PATTERN)
  if (numberedMatch) {
    return {
      heading: null,
      numbered: { kind: 'chapter', title: stripped, number: Number(numberedMatch[1]) },
      text,
    }
  }

  return { heading: null, numbered: null, text }
}

function pushVolume(titles: string[], title: string) {
  if (!titles.includes(title)) titles.push(title)
}

function buildChapter(title: string, volumeTitle: string | null, content: string, index: number): ChapterDraft {
  const normalizedContent = content.replace(/\n{3,}/g, '\n\n').trim()
  return {
    id: crypto.randomUUID(),
    volumeTitle,
    chapterNumber: index + 1,
    title: title.trim() || `Chương ${index + 1}`,
    content: normalizedContent,
    wordCount: countWords(normalizedContent),
    sortOrder: index,
    isPreview: false,
  }
}

export function parseStoryStructure(rawText: string): ParsedStory {
  const text = rawText.replace(/\r\n?/g, '\n').trim()
  const lines = text.split('\n')
  const parsed = lines.map(classifyLine)
  const hasVolume = parsed.some(line => line.heading?.kind === 'volume')
  const hasChapter = parsed.some(line => line.heading?.kind === 'chapter')
  const numberedMatches = parsed.filter(line => line.numbered).length
  const numberedMode = !hasVolume && !hasChapter && numberedMatches >= 3 && text.length / Math.max(1, numberedMatches) >= 180
  const volumeOnlyMode = hasVolume && !hasChapter && !numberedMode

  const warnings: string[] = []
  const volumeTitles: string[] = []
  const built: { title: string; volumeTitle: string | null; content: string }[] = []
  let currentVolume: string | null = null
  let currentTitle: string | null = null
  let currentLines: string[] = []
  let currentVolumeIntro: string[] = []
  let preface: string[] = []

  function flushChapter() {
    if (!currentTitle) return
    if (currentLines.join('').trim()) {
      built.push({ title: currentTitle, volumeTitle: currentVolume, content: currentLines.join('\n') })
    }
    currentTitle = null
    currentLines = []
  }

  for (const line of parsed) {
    if (volumeOnlyMode && line.heading?.kind === 'volume') {
      flushChapter()
      currentVolume = line.heading.title
      pushVolume(volumeTitles, currentVolume)
      currentTitle = line.heading.title
      currentLines = []
      continue
    }

    if (line.heading?.kind === 'volume') {
      flushChapter()
      currentVolume = line.heading.title
      pushVolume(volumeTitles, currentVolume)
      currentVolumeIntro = []
      continue
    }

    if (line.heading?.kind === 'chapter' || (numberedMode && line.numbered)) {
      flushChapter()
      const heading = line.heading ?? line.numbered
      if (!heading) continue
      if (!currentTitle && currentVolumeIntro.join('').trim()) {
        preface.push(...currentVolumeIntro)
      }
      currentVolumeIntro = []
      currentTitle = heading.title
      currentLines = []
      continue
    }

    if (currentTitle) {
      currentLines.push(line.text)
    } else if (currentVolume) {
      currentVolumeIntro.push(line.text)
    } else {
      preface.push(line.text)
    }
  }

  flushChapter()

  if (built.length === 0 && text) {
    built.push({ title: 'Toàn truyện', volumeTitle: null, content: text })
    warnings.push('Không nhận diện được tiêu đề chương; toàn bộ nội dung được đưa vào một chương.')
  } else if (built.length === 1) {
    warnings.push('Chỉ nhận diện được một chương. Kiểm tra lại tiêu đề “Chương”, “Hồi”, “Quyển” nếu muốn tách nhỏ hơn.')
  }

  const prefaceText = preface.join('\n').trim()
  if (built.length > 0 && prefaceText.length >= 80) {
    built.unshift({ title: 'Mở đầu', volumeTitle: null, content: prefaceText })
  }

  const chapters = built.map((chapter, index) => buildChapter(chapter.title, chapter.volumeTitle, chapter.content, index))
  const recommendedType: StoryType = volumeTitles.length > 0 || text.length > 20000 ? 'novel' : 'short_story'

  return {
    chapters,
    volumeTitles,
    characterCount: text.length,
    recommendedType,
    warnings,
  }
}

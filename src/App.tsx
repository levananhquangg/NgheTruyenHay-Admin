import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Upload } from 'tus-js-client'
import {
  Activity, AudioLines, BadgePercent, BarChart3, BookOpen, CalendarClock, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock, FileAudio2, FileText, Flame, Headphones,
  ImagePlus, LayoutDashboard, Layers, Lock, LogOut, MessageSquare, MoreHorizontal, Pencil,
  Plus, Search, Settings, ShieldCheck, Sparkles, Star, Tag, Tags, Trash2, Trophy, UploadCloud,
  WalletCards, X,
} from 'lucide-react'
import { buckets, isSupabaseConfigured, publicAssetURL, supabase } from './lib/supabase'
import { AnalyticsPage, DashboardPage } from './pages/DashboardPage'
import { CommentsPage, LeaderboardPage, ReviewsPage } from './pages/CommunityPages'
import { RevenuePage } from './pages/RevenuePage'
import { SettingsPage } from './pages/SettingsPage'
import { CommercePage } from './pages/CommercePage'
import { TaxonomyPage } from './pages/TaxonomyPage'
import {
  countdownLabel, countWords, formatDate, formatVND, fromDateTimeLocal, isUpcoming, parseStoryStructure,
  STORY_TYPE_OPTIONS, storyStatus, storyTypeLabel, toDateTimeLocal,
} from './lib/content'
import type { ChapterDraft, ParsedStory, PlanRecord, StoryType, TagRecord } from './lib/content'

type AdminPage = 'overview' | 'stories' | 'taxonomy' | 'plans' | 'analytics' | 'reviews' | 'comments' | 'leaderboard' | 'revenue' | 'settings'

type Story = {
  id: string
  title: string
  author: string
  category: string
  language: 'vi' | 'en'
  summary: string
  cover_path: string | null
  text_path: string | null
  audio_path: string | null
  story_type: StoryType
  is_published: boolean
  published_at: string | null
  scheduled_at: string | null
  is_new: boolean
  is_hot: boolean
  is_full: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
}

type StoryFields = Pick<Story, 'title' | 'author' | 'category' | 'language' | 'summary' | 'cover_path' | 'text_path' | 'audio_path' | 'story_type' | 'is_published' | 'published_at' | 'scheduled_at' | 'is_new' | 'is_hot' | 'is_full' | 'is_featured'>
type PublishMode = 'draft' | 'now' | 'scheduled'
type EditorValue = Omit<StoryFields, 'cover_path' | 'text_path' | 'audio_path' | 'is_published' | 'published_at' | 'scheduled_at'> & {
  id?: string
  cover_path: string | null
  text_path: string | null
  audio_path: string | null
  publish_mode: PublishMode
  scheduled_at: string | null
  planIds: string[]
  tagIds: string[]
  chapters: ChapterDraft[]
  chaptersDirty: boolean
  coverFile: File | null
  textFile: File | null
  audioFile: File | null
}

const blankStory = (): EditorValue => ({
  title: '', author: '', category: '', language: 'vi', summary: '',
  cover_path: null, text_path: null, audio_path: null,
  story_type: 'short_story', is_new: false, is_hot: false, is_full: false, is_featured: false,
  publish_mode: 'draft', scheduled_at: null, planIds: [], tagIds: [], chapters: [], chaptersDirty: false,
  coverFile: null, textFile: null, audioFile: null,
})

function publishModeFor(story?: Story): PublishMode {
  if (!story?.is_published) return 'draft'
  if (isUpcoming(story)) return 'scheduled'
  return 'now'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        if (!error) setSession(data.session)
        setCheckingSession(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setCheckingSession(false)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  if (!isSupabaseConfigured) return <ConfigurationScreen />
  if (checkingSession) return <div className="full-screen"><div className="loader" /><span>Đang mở không gian quản trị</span></div>
  if (!session) return <LoginScreen />
  return <AdminGate session={session} />
}

function ConfigurationScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-card setup-card">
        <Brand />
        <div className="eyebrow">Thiết lập lần đầu</div>
        <h1>Kết nối kho truyện</h1>
        <p>Điền URL dự án và publishable key vào file <code>.env</code> trong thư mục admin, rồi khởi động lại trang này.</p>
        <div className="setup-code"><span>VITE_SUPABASE_URL</span><b>https://…supabase.co</b></div>
        <div className="setup-code"><span>VITE_SUPABASE_PUBLISHABLE_KEY</span><b>sb_publishable_…</b></div>
        <div className="secure-note"><ShieldCheck size={17} /> Chỉ dùng publishable key tại đây. Không dán secret/service_role key vào trình duyệt.</div>
        <p className="auth-foot">Hướng dẫn đầy đủ nằm trong README của Admin Panel.</p>
      </div>
    </div>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) setError('Email hoặc mật khẩu chưa đúng. Kiểm tra tài khoản admin trong Supabase Auth.')
    setBusy(false)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card login-card">
        <Brand />
        <div className="eyebrow">Không gian nội dung</div>
        <h1>Chào mừng trở lại.</h1>
        <p>Đăng nhập bằng tài khoản đã được cấp quyền quản trị thư viện.</p>
        <form onSubmit={submit} className="login-form">
          <label>Email quản trị<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="ban@nghetruyenhay.vn" required /></label>
          <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••••••" required /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="button primary login-button" disabled={busy}>{busy ? <><span className="button-spinner" /> Đang đăng nhập</> : <>Vào trang quản trị <span>↗</span></>}</button>
        </form>
        <div className="secure-note"><ShieldCheck size={17} /> Đăng nhập an toàn qua Supabase Auth</div>
        <p className="auth-foot">NGHE TRUYỆN HAY <span>·</span> STUDIO</p>
      </div>
    </div>
  )
}

function AdminGate({ session }: { session: Session }) {
  const [adminState, setAdminState] = useState<'checking' | 'allowed' | 'denied'>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void supabase.rpc('is_story_admin').then(({ data, error: rpcError }) => {
      if (!active) return
      if (rpcError) { setError('Chưa chạy migration hoặc chưa cấp quyền admin cho tài khoản này.'); setAdminState('denied') }
      else setAdminState(data ? 'allowed' : 'denied')
    })
    return () => { active = false }
  }, [session.user.id])

  if (adminState === 'checking') return <div className="full-screen"><div className="loader" /><span>Đang xác minh quyền quản trị</span></div>
  if (adminState === 'denied') return (
    <div className="auth-shell"><div className="auth-card denied-card"><Brand /><div className="eyebrow">Chưa có quyền truy cập</div><h1>Tài khoản chưa được cấp quyền admin.</h1><p>{error || 'Thêm user ID của bạn vào bảng public.story_admins trong Supabase SQL Editor, rồi đăng nhập lại.'}</p><button className="button secondary" onClick={() => void supabase.auth.signOut()}><LogOut size={16} /> Đăng xuất</button></div></div>
  )
  return <AdminWorkspace session={session} />
}

const pageTitles: Record<AdminPage, string> = {
  overview: 'Tổng quan',
  stories: 'Kho nội dung',
  taxonomy: 'Thể loại & nhãn',
  plans: 'Gói & ưu đãi',
  analytics: 'Phân tích',
  reviews: 'Đánh giá',
  comments: 'Bình luận',
  leaderboard: 'Top truyện',
  revenue: 'Doanh thu',
  settings: 'Cài đặt',
}

function AdminWorkspace({ session }: { session: Session }) {
  const [activePage, setActivePage] = useState<AdminPage>('overview')
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'scheduled' | 'draft'>('all')
  const [editor, setEditor] = useState<Story | null | undefined>(undefined)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  async function reload(showLoader = true) {
    if (showLoader) setLoading(true)
    const { data, error } = await supabase.from('stories').select('*').order('created_at', { ascending: false })
    if (error) setNotice({ tone: 'error', text: error.message })
    else setStories((data ?? []) as Story[])
    setLoading(false)
  }

  useEffect(() => { void reload() }, [])

  const scheduledCount = stories.filter(story => isUpcoming(story)).length
  const publishedCount = stories.filter(story => story.is_published && !isUpcoming(story)).length
  const draftCount = stories.filter(story => !story.is_published).length
  const visibleStories = useMemo(() => stories.filter(story => {
    const matchesSearch = `${story.title} ${story.author} ${story.category}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))
    const matchesFilter = filter === 'all'
      || (filter === 'published' ? story.is_published && !isUpcoming(story) : false)
      || (filter === 'scheduled' ? isUpcoming(story) : false)
      || (filter === 'draft' ? !story.is_published : false)
    return matchesSearch && matchesFilter
  }), [stories, search, filter])

  async function saveStory(value: EditorValue) {
    setWorking(true); setNotice(null); setUploadProgress(0)
    const id = value.id ?? crypto.randomUUID()
    try {
      const uploadIfSelected = async (bucket: string, kind: string, file: File | null, oldPath: string | null) => {
        if (!file) return oldPath
        const path = `stories/${id}/${kind}-${crypto.randomUUID()}-${safeFileName(file.name)}`
        await uploadAsset(bucket, path, file, (percent) => setUploadProgress(percent))
        return path
      }

      const coverPath = await uploadIfSelected(buckets.covers, 'cover', value.coverFile, value.cover_path)
      const textPath = await uploadIfSelected(buckets.texts, 'text', value.textFile, value.text_path)
      const audioPath = await uploadIfSelected(buckets.audio, 'audio', value.audioFile, value.audio_path)
      if (!textPath && !audioPath && value.chapters.length === 0) throw new Error('Thêm tệp truyện TXT/MD, tệp audio hoặc tách ít nhất một chương trước khi lưu.')

      const { data: existing } = value.id
        ? await supabase.from('stories').select('is_published,published_at,scheduled_at').eq('id', id).maybeSingle()
        : { data: null }
      const now = new Date()
      const scheduledAt = value.publish_mode === 'scheduled' ? value.scheduled_at : null
      if (value.publish_mode === 'scheduled' && !scheduledAt) throw new Error('Chọn ngày giờ xuất bản cho truyện đã lên lịch.')
      if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
        throw new Error('Thời gian hẹn giờ đã qua. Chọn thời điểm trong tương lai hoặc chuyển sang xuất bản ngay.')
      }
      const existingWasReleased = Boolean(existing?.is_published
        && (!existing.scheduled_at || new Date(existing.scheduled_at).getTime() <= now.getTime()))
      const publishedAt = value.publish_mode === 'draft'
        ? null
        : value.publish_mode === 'scheduled'
          ? scheduledAt
          : existingWasReleased
            ? existing?.published_at ?? now.toISOString()
            : now.toISOString()

      const fields: StoryFields = {
        title: value.title.trim(), author: value.author.trim(), category: value.category.trim() || 'Khác',
        language: value.language, summary: value.summary.trim(), cover_path: coverPath,
        text_path: textPath, audio_path: audioPath, story_type: value.story_type,
        is_published: value.publish_mode !== 'draft',
        published_at: publishedAt, scheduled_at: scheduledAt,
        is_new: value.is_new, is_hot: value.is_hot, is_full: value.is_full, is_featured: value.is_featured,
      }
      const saved = value.id
        ? await supabase.from('stories').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
        : await supabase.from('stories').insert({ id, ...fields }).select('*').single()
      if (saved.error) throw saved.error

      const tagDelete = await supabase.from('story_tags').delete().eq('story_id', id)
      if (tagDelete.error) throw tagDelete.error
      if (value.tagIds.length > 0) {
        const tagInsert = await supabase.from('story_tags').insert(value.tagIds.map(tagId => ({ story_id: id, tag_id: tagId })))
        if (tagInsert.error) throw tagInsert.error
      }

      const planDelete = await supabase.from('story_plans').delete().eq('story_id', id)
      if (planDelete.error) throw planDelete.error
      if (value.planIds.length > 0) {
        const planInsert = await supabase.from('story_plans').insert(value.planIds.map(planId => ({ story_id: id, plan_id: planId })))
        if (planInsert.error) throw planInsert.error
      }

      if (value.chaptersDirty) await replaceStoryChapters(id, value.chapters)

      setStories(current => value.id ? current.map(item => item.id === id ? saved.data as Story : item) : [saved.data as Story, ...current])
      setEditor(undefined)
      setNotice({ tone: 'success', text: value.id ? 'Đã lưu thay đổi truyện, phân loại và cấu trúc chương.' : 'Đã thêm truyện vào kho nháp.' })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Không lưu được truyện. Hãy thử lại.'
      setNotice({ tone: 'error', text: message })
    } finally {
      setUploadProgress(null); setWorking(false)
    }
  }

  async function togglePublish(story: Story) {
    setWorking(true); setNotice(null)
    const isPublished = !story.is_published
    const { data, error } = await supabase.from('stories').update({
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', story.id).select('*').single()
    if (error) setNotice({ tone: 'error', text: error.message })
    else {
      setStories(current => current.map(item => item.id === story.id ? data as Story : item))
      setNotice({ tone: 'success', text: isPublished ? 'Truyện đã lên kệ. App sẽ thấy ở lần đồng bộ tiếp theo.' : 'Đã chuyển truyện về bản nháp.' })
    }
    setWorking(false)
  }

  async function toggleFlag(story: Story, flag: 'is_new' | 'is_hot' | 'is_full' | 'is_featured') {
    setWorking(true); setNotice(null)
    const nextValue = !story[flag]
    const { data, error } = await supabase.from('stories').update({ [flag]: nextValue, updated_at: new Date().toISOString() }).eq('id', story.id).select('*').single()
    if (error) setNotice({ tone: 'error', text: error.message })
    else {
      setStories(current => current.map(item => item.id === story.id ? data as Story : item))
      setNotice({ tone: 'success', text: `Đã ${nextValue ? 'bật' : 'tắt'} nhãn ${flag === 'is_new' ? 'Mới' : flag === 'is_hot' ? 'Hot' : flag === 'is_full' ? 'Full' : 'Đề cử'} cho “${story.title}”.` })
    }
    setWorking(false)
  }

  async function deleteStory(story: Story) {
    if (!window.confirm(`Xóa “${story.title}” khỏi kho truyện? Thao tác này không thể hoàn tác.`)) return
    setWorking(true); setNotice(null)
    const { error } = await supabase.from('stories').delete().eq('id', story.id)
    if (error) { setNotice({ tone: 'error', text: error.message }); setWorking(false); return }
    setStories(current => current.filter(item => item.id !== story.id))
    const removals = [
      story.cover_path ? supabase.storage.from(buckets.covers).remove([story.cover_path]) : null,
      story.text_path ? supabase.storage.from(buckets.texts).remove([story.text_path]) : null,
      story.audio_path ? supabase.storage.from(buckets.audio).remove([story.audio_path]) : null,
    ].filter(Boolean)
    const results = await Promise.all(removals)
    const cleanupFailed = results.some(result => result && result.error)
    setNotice({ tone: cleanupFailed ? 'error' : 'success', text: cleanupFailed ? 'Truyện đã xóa khỏi catalog, nhưng một số tệp cũ cần xóa thủ công trong Storage.' : 'Đã xóa truyện và các tệp liên quan.' })
    setWorking(false)
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label sidebar-label-first">WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Điều hướng quản trị">
          <button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => setActivePage('overview')}><LayoutDashboard size={17} /> <span>Tổng quan</span></button>
          <button className={`nav-item ${activePage === 'stories' ? 'active' : ''}`} onClick={() => setActivePage('stories')}><BookOpen size={17} /> <span>Kho truyện</span><span className="nav-count">{stories.length}</span></button>
          <button className={`nav-item ${activePage === 'taxonomy' ? 'active' : ''}`} onClick={() => setActivePage('taxonomy')}><Tags size={17} /> <span>Thể loại &amp; nhãn</span></button>

          <div className="sidebar-label">KINH DOANH</div>
          <button className={`nav-item ${activePage === 'plans' ? 'active' : ''}`} onClick={() => setActivePage('plans')}><BadgePercent size={17} /> <span>Gói &amp; ưu đãi</span></button>

          <div className="sidebar-label">CỘNG ĐỒNG</div>
          <button className={`nav-item ${activePage === 'reviews' ? 'active' : ''}`} onClick={() => setActivePage('reviews')}><Star size={17} /> <span>Đánh giá</span></button>
          <button className={`nav-item ${activePage === 'comments' ? 'active' : ''}`} onClick={() => setActivePage('comments')}><MessageSquare size={17} /> <span>Bình luận</span></button>

          <div className="sidebar-label">TĂNG TRƯỞNG</div>
          <button className={`nav-item ${activePage === 'analytics' ? 'active' : ''}`} onClick={() => setActivePage('analytics')}><BarChart3 size={17} /> <span>Phân tích</span></button>
          <button className={`nav-item ${activePage === 'leaderboard' ? 'active' : ''}`} onClick={() => setActivePage('leaderboard')}><Trophy size={17} /> <span>Top truyện</span></button>
          <button className={`nav-item ${activePage === 'revenue' ? 'active' : ''}`} onClick={() => setActivePage('revenue')}><WalletCards size={17} /> <span>Doanh thu</span></button>

          <div className="sidebar-label">HỆ THỐNG</div>
          <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => setActivePage('settings')}><Settings size={17} /> <span>Cài đặt</span></button>
        </nav>
        <div className="sidebar-bottom"><div className="online-status"><span /> Đã kết nối Supabase</div><div className="profile"><div className="avatar">{(session.user.email?.[0] ?? 'A').toUpperCase()}</div><div className="profile-copy"><b>{session.user.email?.split('@')[0] ?? 'Admin'}</b><span>Quản trị viên</span></div><button aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void supabase.auth.signOut()}><LogOut size={16} /></button></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>Nghe Truyện Hay</span><b>/</b><strong>{pageTitles[activePage]}</strong></div><div className="topbar-right"><span className="live-pill"><span /> LIVE</span><button className="avatar mini-avatar" aria-label="Tài khoản">{(session.user.email?.[0] ?? 'A').toUpperCase()}</button></div></header>

        {activePage === 'stories' ? (
          <div className="page-content">
            <section className="page-heading"><div><div className="eyebrow"><Sparkles size={13} /> STORY LIBRARY</div><h1>Kho truyện</h1><p>Quản lý nội dung sẽ xuất hiện trong ứng dụng Nghe Truyện Hay.</p></div><button className="button primary add-button" onClick={() => setEditor(null)}><Plus size={17} /> Thêm truyện mới</button></section>

            {notice && <div className={`notice ${notice.tone}`} role="status"><span className="notice-icon">{notice.tone === 'success' ? <Check size={16} /> : <CircleHelp size={16} />}</span><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={16} /></button></div>}

            <section className="stats-grid stats-grid-library">
              <StatCard icon={<BookOpen size={18} />} label="TỔNG TRUYỆN" value={stories.length.toString().padStart(2, '0')} detail="Trong catalog" />
              <StatCard icon={<Activity size={18} />} label="ĐANG XUẤT BẢN" value={publishedCount.toString().padStart(2, '0')} detail="Đã mở cho người nghe" />
              <StatCard icon={<CalendarClock size={18} />} label="SẮP RA MẮT" value={scheduledCount.toString().padStart(2, '0')} detail="Có đếm ngược trên app" />
              <StatCard icon={<FileText size={18} />} label="BẢN NHÁP" value={draftCount.toString().padStart(2, '0')} detail="Chỉ admin nhìn thấy" />
            </section>

            <section className="content-card">
              <div className="content-toolbar"><div className="filter-tabs"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Tất cả <span>{stories.length}</span></button><button className={filter === 'published' ? 'selected' : ''} onClick={() => setFilter('published')}>Đã xuất bản <span>{publishedCount}</span></button><button className={filter === 'scheduled' ? 'selected' : ''} onClick={() => setFilter('scheduled')}>Sắp ra mắt <span>{scheduledCount}</span></button><button className={filter === 'draft' ? 'selected' : ''} onClick={() => setFilter('draft')}>Bản nháp <span>{draftCount}</span></button></div><div className="search-box"><Search size={16} /><input placeholder="Tìm truyện hoặc tác giả" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
              <div className="table-header"><span>TÁC PHẨM</span><span>ĐỊNH DẠNG</span><span>NGÔN NGỮ</span><span>TRẠNG THÁI</span><span>CẬP NHẬT</span><span /></div>
              {loading ? <div className="table-empty"><div className="loader" /><span>Đang tải danh mục</span></div> : visibleStories.length === 0 ? <div className="empty-state"><div className="empty-icon"><BookOpen size={23} /></div><h3>{stories.length ? 'Không tìm thấy truyện phù hợp' : 'Kho truyện đang chờ câu chuyện đầu tiên'}</h3><p>{stories.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Tạo bản nháp, thêm nội dung và bấm xuất bản để đưa truyện lên app.'}</p>{!stories.length && <button className="button secondary" onClick={() => setEditor(null)}><Plus size={16} /> Tạo truyện đầu tiên</button>}</div> : <div className="story-list">{visibleStories.map(story => <StoryRow key={story.id} story={story} onEdit={() => setEditor(story)} onPublish={() => void togglePublish(story)} onDelete={() => void deleteStory(story)} onFlag={flag => void toggleFlag(story, flag)} disabled={working} />)}</div>}
              <div className="table-footer"><span>Đang hiển thị <b>{visibleStories.length}</b> / <b>{stories.length}</b> tác phẩm</span><button onClick={() => void reload(false)}><Activity size={14} /> Làm mới danh sách</button></div>
            </section>
            <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Kho nội dung đồng bộ trực tiếp với ứng dụng iOS</span></footer>
          </div>
        ) : activePage === 'overview' ? (
          <DashboardPage onNavigate={setActivePage} />
        ) : activePage === 'taxonomy' ? (
          <TaxonomyPage />
        ) : activePage === 'plans' ? (
          <CommercePage />
        ) : activePage === 'analytics' ? (
          <AnalyticsPage />
        ) : activePage === 'reviews' ? (
          <ReviewsPage />
        ) : activePage === 'comments' ? (
          <CommentsPage />
        ) : activePage === 'leaderboard' ? (
          <LeaderboardPage />
        ) : activePage === 'revenue' ? (
          <RevenuePage />
        ) : (
          <SettingsPage session={session} />
        )}
      </main>

      {activePage === 'stories' && editor !== undefined && <StoryEditor key={editor?.id ?? 'new'} story={editor ?? undefined} saving={working} progress={uploadProgress} onClose={() => !working && setEditor(undefined)} onSave={saveStory} />}
    </div>
  )
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><AudioLines size={19} strokeWidth={2.2} /></div><div><b>NGHE TRUYỆN HAY</b><span>CONTENT STUDIO</span></div></div>
}

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>
}

function StoryRow({ story, onEdit, onPublish, onDelete, onFlag, disabled }: { story: Story; onEdit: () => void; onPublish: () => void; onDelete: () => void; onFlag: (flag: 'is_new' | 'is_hot' | 'is_full') => void; disabled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cover = publicAssetURL(buckets.covers, story.cover_path)
  const format = [story.text_path && 'TXT', story.audio_path && 'AUDIO'].filter((item): item is string => Boolean(item))
  const status = storyStatus(story)
  const upcoming = isUpcoming(story)
  return <div className="story-row">
    <div className="story-main"><div className={`story-thumb ${cover ? 'with-cover' : ''}`}>{cover ? <img src={cover} alt="" loading="lazy" /> : <BookOpen size={19} />}</div><div className="story-copy"><strong>{story.title}</strong><span>{story.author || 'Chưa có tác giả'} <i>·</i> {story.category} <i>·</i> {storyTypeLabel(story.story_type)}</span><div className="story-flags"><button className={`flag-pill new ${story.is_new ? 'active' : ''}`} onClick={() => onFlag('is_new')} disabled={disabled} title="Bật/tắt nhãn Mới">MỚI</button><button className={`flag-pill hot ${story.is_hot ? 'active' : ''}`} onClick={() => onFlag('is_hot')} disabled={disabled} title="Bật/tắt nhãn Hot">HOT</button><button className={`flag-pill full ${story.is_full ? 'active' : ''}`} onClick={() => onFlag('is_full')} disabled={disabled} title="Bật/tắt nhãn Full">FULL</button></div></div></div>
    <div className="format-cell">{format.map(format => <span key={format} className="format-pill">{format === 'AUDIO' ? <Headphones size={13} /> : <FileText size={13} />}{format}</span>)}{story.story_type === 'novel' && <span className="format-pill"><Layers size={13} />NOVEL</span>}</div>
    <div className="language-cell"><span className="language-dot" />{story.language === 'vi' ? 'Tiếng Việt' : 'English'}</div>
    <div className="status-cell"><span className={`status-pill ${status.tone}`}><i />{status.label}</span>{upcoming && <span className="status-countdown"><Clock size={12} /> {countdownLabel(story.scheduled_at)}</span>}</div>
    <div className="updated-cell">{formatDate(story.updated_at)}</div>
    <div className="row-actions"><button className="icon-button" title="Sửa truyện" aria-label={`Sửa ${story.title}`} onClick={onEdit} disabled={disabled}><Pencil size={16} /></button><div className="menu-anchor"><button className="icon-button" title="Tùy chọn" aria-label="Tùy chọn" onClick={() => setMenuOpen(open => !open)} disabled={disabled}><MoreHorizontal size={18} /></button>{menuOpen && <><button className="menu-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} /><div className="row-menu"><button onClick={() => { setMenuOpen(false); onPublish() }}>{story.is_published ? 'Chuyển về bản nháp' : 'Xuất bản lên app'}<ChevronDown size={14} /></button><button onClick={() => { setMenuOpen(false); onEdit() }}><CalendarClock size={14} /> {upcoming ? 'Sửa lịch xuất bản' : 'Thiết lập lịch'}</button><button className="danger-text" onClick={() => { setMenuOpen(false); onDelete() }}><Trash2 size={14} /> Xóa truyện</button></div></>}</div></div>
  </div>
}

function StoryEditor({ story, saving, progress, onClose, onSave }: { story?: Story; saving: boolean; progress: number | null; onClose: () => void; onSave: (value: EditorValue) => Promise<void> }) {
  const [value, setValue] = useState<EditorValue>(() => story ? {
    id: story.id, title: story.title, author: story.author, category: story.category,
    language: story.language, summary: story.summary, cover_path: story.cover_path,
    text_path: story.text_path, audio_path: story.audio_path,
    story_type: story.story_type ?? 'short_story', is_new: story.is_new, is_hot: story.is_hot,
    is_full: story.is_full, is_featured: story.is_featured,
    publish_mode: publishModeFor(story), scheduled_at: story.scheduled_at,
    planIds: [], tagIds: [], chapters: [], chaptersDirty: false,
    coverFile: null, textFile: null, audioFile: null,
  } : blankStory())
  const [coverPreview, setCoverPreview] = useState('')
  const [validation, setValidation] = useState('')
  const [tab, setTab] = useState<'info' | 'content' | 'access'>('info')
  const [tags, setTags] = useState<TagRecord[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [metaLoading, setMetaLoading] = useState(true)
  const [structureMessage, setStructureMessage] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [readingText, setReadingText] = useState(false)

  useEffect(() => {
    if (!value.coverFile) { setCoverPreview(''); return }
    const preview = URL.createObjectURL(value.coverFile)
    setCoverPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [value.coverFile])

  useEffect(() => {
    let active = true
    async function loadMetadata() {
      setMetaLoading(true)
      const [tagResult, planResult] = await Promise.all([
        supabase.from('content_tags').select('*').order('kind').order('sort_order', { ascending: true }),
        supabase.from('plans').select('*').order('sort_order', { ascending: true }),
      ])
      let tagIds: string[] = []
      let planIds: string[] = []
      let chapters: ChapterDraft[] = []
      if (story) {
        const [tagLinksResult, planLinksResult, volumeResult, chapterResult] = await Promise.all([
          supabase.from('story_tags').select('tag_id').eq('story_id', story.id),
          supabase.from('story_plans').select('plan_id').eq('story_id', story.id),
          supabase.from('story_volumes').select('id,title,volume_number,sort_order').eq('story_id', story.id).order('sort_order'),
          supabase.from('story_chapters').select('id,volume_id,chapter_number,title,content,word_count,is_preview,sort_order').eq('story_id', story.id).order('sort_order'),
        ])
        const linkError = tagLinksResult.error ?? planLinksResult.error ?? volumeResult.error ?? chapterResult.error
        if (linkError) setValidation(linkError.message)
        tagIds = ((tagLinksResult.data ?? []) as { tag_id: string }[]).map(item => item.tag_id)
        planIds = ((planLinksResult.data ?? []) as { plan_id: string }[]).map(item => item.plan_id)
        const volumeRows = (volumeResult.data ?? []) as { id: string; title: string }[]
        const volumeLookup = new Map(volumeRows.map(volume => [volume.id, volume.title]))
        chapters = ((chapterResult.data ?? []) as {
          id: string; volume_id: string | null; chapter_number: number; title: string;
          content: string; word_count: number; is_preview: boolean; sort_order: number
        }[]).map(chapter => ({
          id: chapter.id, volumeTitle: chapter.volume_id ? volumeLookup.get(chapter.volume_id) ?? null : null,
          chapterNumber: chapter.chapter_number, title: chapter.title, content: chapter.content,
          wordCount: chapter.word_count, sortOrder: chapter.sort_order, isPreview: chapter.is_preview,
        }))
      }
      if (!active) return
      if (tagResult.error) setValidation(tagResult.error.message)
      if (planResult.error) setValidation(planResult.error.message)
      setTags((tagResult.data ?? []) as unknown as TagRecord[])
      setPlans((planResult.data ?? []) as unknown as PlanRecord[])
      setValue(current => ({ ...current, tagIds, planIds, chapters, chaptersDirty: false }))
      setMetaLoading(false)
    }
    void loadMetadata()
    return () => { active = false }
  }, [story])

  function update<K extends keyof EditorValue>(field: K, next: EditorValue[K]) {
    setValue(current => ({ ...current, [field]: next }))
  }

  function applyParsed(parsed: ParsedStory, source: string) {
    if (parsed.chapters.length === 0) {
      setValidation('Không tìm thấy nội dung để tách chương.')
      return
    }
    setValue(current => ({
      ...current,
      chapters: parsed.chapters,
      chaptersDirty: true,
      story_type: current.story_type === 'short_story' && parsed.recommendedType === 'novel' ? 'novel' : current.story_type,
    }))
    const warning = parsed.warnings.length > 0 ? ` · ${parsed.warnings.join(' ')}` : ''
    setStructureMessage(`${source}: ${parsed.chapters.length} chương · ${parsed.volumeTitles.length} quyển/tập · ${parsed.characterCount.toLocaleString('vi-VN')} ký tự${warning}`)
    setValidation('')
    setTab('content')
  }

  function parseText(text: string, source: string) {
    applyParsed(parseStoryStructure(text), source)
  }

  function readTextFile(file: File) {
    update('textFile', file)
    setReadingText(true)
    void file.text()
      .then(text => parseText(text, file.name))
      .catch(() => setValidation('Không đọc được tệp chữ. Hãy kiểm tra định dạng UTF-8.'))
      .finally(() => setReadingText(false))
  }

  async function loadExistingText() {
    if (!value.text_path) return
    setReadingText(true); setValidation('')
    try {
      const { data, error } = await supabase.storage.from(buckets.texts).download(value.text_path)
      if (error) throw error
      parseText(await data.text(), 'Tệp hiện tại')
    } catch {
      try {
        const url = publicAssetURL(buckets.texts, value.text_path)
        if (!url) throw new Error('missing url')
        const response = await fetch(url)
        if (!response.ok) throw new Error('download failed')
        parseText(await response.text(), 'Tệp hiện tại')
      } catch {
        setValidation('Không tải được tệp truyện hiện tại để tách chương.')
      }
    } finally {
      setReadingText(false)
    }
  }

  function removeChapter(index: number) {
    setValue(current => ({
      ...current,
      chapters: current.chapters.filter((_, chapterIndex) => chapterIndex !== index)
        .map((chapter, chapterIndex) => ({ ...chapter, chapterNumber: chapterIndex + 1, sortOrder: chapterIndex })),
      chaptersDirty: true,
    }))
  }

  function updateChapterTitle(index: number, title: string) {
    setValue(current => ({
      ...current,
      chapters: current.chapters.map((chapter, chapterIndex) => chapterIndex === index ? { ...chapter, title } : chapter),
      chaptersDirty: true,
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setValidation('')
    if (!value.textFile && !value.audioFile && !value.text_path && !value.audio_path && value.chapters.length === 0) {
      setValidation('Thêm tối thiểu một tệp truyện, audio hoặc tách ít nhất một chương.')
      return
    }
    if (value.publish_mode === 'scheduled' && !value.scheduled_at) {
      setValidation('Chọn ngày giờ cho truyện hẹn giờ xuất bản.')
      return
    }
    await onSave(value)
  }

  const existingCover = publicAssetURL(buckets.covers, value.cover_path)
  const genres = tags.filter(tag => tag.kind === 'genre' && tag.is_active)
  const volumeCount = new Set(value.chapters.map(chapter => chapter.volumeTitle).filter(Boolean)).size
  const chapterWordTotal = value.chapters.reduce((total, chapter) => total + chapter.wordCount, 0)

  function selectPublishMode(mode: PublishMode) {
    setValue(current => ({
      ...current,
      publish_mode: mode,
      scheduled_at: mode === 'scheduled' && !current.scheduled_at
        ? new Date(Date.now() + 86_400_000).toISOString()
        : current.scheduled_at,
    }))
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form className="editor-modal story-editor-modal" onSubmit={submit}>
      <div className="modal-head"><div><div className="eyebrow">{story ? 'CẬP NHẬT TÁC PHẨM' : 'THƯ VIỆN MỚI'}</div><h2>{story ? 'Chỉnh sửa truyện' : 'Thêm truyện mới'}</h2></div><button type="button" className="icon-button close-button" onClick={onClose} aria-label="Đóng" disabled={saving}><X size={20} /></button></div>

      <div className="editor-tabs">
        <button type="button" className={tab === 'info' ? 'selected' : ''} onClick={() => setTab('info')}><FileText size={15} /> Thông tin</button>
        <button type="button" className={tab === 'content' ? 'selected' : ''} onClick={() => setTab('content')}><Layers size={15} /> Nội dung &amp; chương {value.chapters.length > 0 && <span>{value.chapters.length}</span>}</button>
        <button type="button" className={tab === 'access' ? 'selected' : ''} onClick={() => setTab('access')}><Lock size={15} /> Gói, nhãn &amp; lịch</button>
      </div>

      <div className="editor-scroll">
        {tab === 'info' ? (
          <div className="editor-info-layout">
            <label className="field-label"><span className="field-label-text">Tên truyện <i className="required-mark">*</i></span><input autoFocus value={value.title} onChange={event => update('title', event.target.value)} placeholder="Ví dụ: Thành phố phía bên kia mưa" maxLength={180} required /></label>
            <div className="field-pair"><label className="field-label">Tác giả<input value={value.author} onChange={event => update('author', event.target.value)} placeholder="Tên tác giả" /></label><label className="field-label">Thể loại chính<input list="story-genre-options" value={value.category} onChange={event => update('category', event.target.value)} placeholder="Chọn hoặc nhập thể loại" /><datalist id="story-genre-options">{genres.map(genre => <option key={genre.id} value={genre.name} />)}</datalist></label></div>
            <div className="field-pair"><label className="field-label">Ngôn ngữ<select value={value.language} onChange={event => update('language', event.target.value as 'vi' | 'en')}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label><label className="field-label">Cấu trúc truyện<select value={value.story_type} onChange={event => update('story_type', event.target.value as StoryType)}>{STORY_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label} — {option.hint}</option>)}</select></label></div>
            <label className="field-label">Mô tả ngắn<textarea value={value.summary} onChange={event => update('summary', event.target.value)} placeholder="Một vài dòng giới thiệu để người nghe chọn truyện…" rows={5} maxLength={600} /></label>
            <div className="editor-info-note"><CheckCircle2 size={16} /><span>Mô tả hiển thị ở trang khám phá. Thể loại chính và các nhãn phụ được chọn ở tab “Gói, nhãn &amp; lịch”.</span></div>
          </div>
        ) : tab === 'content' ? (
          <div className="editor-grid content-editor-grid">
            <div className="asset-fields">
              <div className="asset-heading"><span>TỆP &amp; HÌNH ẢNH</span><span>01 — 03</span></div>
              <FileDrop title="Ảnh bìa" detail="JPG, PNG hoặc WEBP · tối đa 10 MB" icon={<ImagePlus size={17} />} accept="image/jpeg,image/png,image/webp" file={value.coverFile} currentURL={coverPreview || existingCover || undefined} onSelect={file => update('coverFile', file)} />
              <FileDrop title="Truyện chữ" detail="TXT hoặc Markdown (UTF-8) · tự tách chương" icon={<FileText size={17} />} accept=".txt,.md,text/plain,text/markdown" file={value.textFile} currentName={value.text_path ? value.text_path.split('/').pop() : undefined} onSelect={file => { if (file) readTextFile(file) }} />
              <FileDrop title="Sách nói" detail="MP3, M4A, AAC, WAV hoặc AIFF" icon={<FileAudio2 size={17} />} accept=".mp3,.m4a,.aac,.wav,.aiff,audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-m4a" file={value.audioFile} currentName={value.audio_path ? value.audio_path.split('/').pop() : undefined} onSelect={file => update('audioFile', file)} />
              {value.text_path && <button type="button" className="button secondary small" onClick={() => void loadExistingText()} disabled={readingText || saving}><Layers size={14} /> {readingText ? 'Đang đọc tệp…' : 'Tách chương từ tệp hiện tại'}</button>}
              <div className="format-note"><ShieldCheck size={15} /><span>Chương được lưu trong Supabase. Tệp gốc vẫn giữ làm bản dự phòng cho trình đọc cũ.</span></div>
            </div>

            <div className="structure-fields">
              <div className="asset-heading"><span>CẤU TRÚC CHƯƠNG</span><span>{value.chapters.length} CHƯƠNG · {volumeCount} QUYỂN/TẬP</span></div>
              <textarea className="paste-area" value={pastedText} onChange={event => setPastedText(event.target.value)} placeholder={'Dán nội dung truyện vào đây để tự nhận diện “Quyển”, “Tập”, “Phần”, “Chương”, “Hồi”…'} rows={4} />
              <div className="structure-actions"><button type="button" className="button primary small" onClick={() => { if (!pastedText.trim()) { setValidation('Dán nội dung trước khi tách chương.'); return } parseText(pastedText, 'Nội dung dán') }} disabled={readingText || saving}><Sparkles size={14} /> Tách chương thông minh</button>{value.chapters.length > 0 && <button type="button" className="button secondary small" onClick={() => { if (window.confirm('Xóa toàn bộ chương đã tách? Tệp gốc không bị xóa.')) setValue(current => ({ ...current, chapters: [], chaptersDirty: true })) }} disabled={saving}>Xóa cấu trúc</button>}</div>
              {structureMessage && <div className="structure-message">{structureMessage}</div>}
              {metaLoading ? <div className="table-empty compact"><div className="loader" /><span>Đang đọc chương</span></div> : value.chapters.length === 0 ? (
                <div className="structure-empty"><Layers size={22} /><strong>Chưa có cấu trúc chương</strong><span>Chọn tệp truyện, dán nội dung hoặc giữ chế độ một mạch cho truyện ngắn.</span></div>
              ) : (
                <div className="chapter-preview-list">
                  {value.chapters.map((chapter, index) => {
                    const previous = value.chapters[index - 1]
                    const newVolume = chapter.volumeTitle && chapter.volumeTitle !== previous?.volumeTitle
                    return <div key={chapter.id}>
                      {newVolume && <div className="chapter-volume"><Layers size={13} /> {chapter.volumeTitle}</div>}
                      <div className="chapter-row">
                        <span className="chapter-index">{String(index + 1).padStart(2, '0')}</span>
                        <input value={chapter.title} onChange={event => updateChapterTitle(index, event.target.value)} aria-label={`Tên chương ${index + 1}`} />
                        <span className="chapter-words">{chapter.wordCount.toLocaleString('vi-VN')} từ</span>
                        <button type="button" className="icon-button danger-icon" title="Xóa chương" onClick={() => removeChapter(index)} disabled={saving}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  })}
                  <div className="chapter-total"><span>{value.chapters.length} chương</span><span>{chapterWordTotal.toLocaleString('vi-VN')} từ</span><span>{value.chaptersDirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'}</span></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="access-editor-layout">
            <section className="access-section">
              <div className="access-heading"><div><span>NHÃN NHANH</span><h3>Đánh dấu trên app</h3></div><span className="access-hint">Hiển thị tức thì trên thẻ truyện</span></div>
              <div className="flag-editor">
                <button type="button" className={`flag-toggle new ${value.is_new ? 'active' : ''}`} onClick={() => update('is_new', !value.is_new)}><Sparkles size={17} /><span><b>Mới</b><small>Vừa lên kệ</small></span></button>
                <button type="button" className={`flag-toggle hot ${value.is_hot ? 'active' : ''}`} onClick={() => update('is_hot', !value.is_hot)}><Flame size={17} /><span><b>Hot</b><small>Đang được nghe nhiều</small></span></button>
                <button type="button" className={`flag-toggle full ${value.is_full ? 'active' : ''}`} onClick={() => update('is_full', !value.is_full)}><CheckCircle2 size={17} /><span><b>Full</b><small>Đã đủ chương</small></span></button>
                <button type="button" className={`flag-toggle featured ${value.is_featured ? 'active' : ''}`} onClick={() => update('is_featured', !value.is_featured)}><Star size={17} /><span><b>Đề cử</b><small>Biên tập chọn</small></span></button>
              </div>
            </section>

            <section className="access-section">
              <div className="access-heading"><div><span>PHÁT HÀNH</span><h3>Trạng thái &amp; hẹn giờ</h3></div><CalendarClock size={18} /></div>
              <div className="publish-mode-grid">
                <label className={`publish-mode ${value.publish_mode === 'draft' ? 'selected' : ''}`}><input type="radio" name="publish-mode" checked={value.publish_mode === 'draft'} onChange={() => selectPublishMode('draft')} /><span><b>Bản nháp</b><small>Chỉ admin thấy</small></span></label>
                <label className={`publish-mode ${value.publish_mode === 'now' ? 'selected' : ''}`}><input type="radio" name="publish-mode" checked={value.publish_mode === 'now'} onChange={() => selectPublishMode('now')} /><span><b>Xuất bản ngay</b><small>Mở nội dung lập tức</small></span></label>
                <label className={`publish-mode ${value.publish_mode === 'scheduled' ? 'selected' : ''}`}><input type="radio" name="publish-mode" checked={value.publish_mode === 'scheduled'} onChange={() => selectPublishMode('scheduled')} /><span><b>Hẹn giờ</b><small>Đếm ngược trên app</small></span></label>
              </div>
              {value.publish_mode === 'scheduled' && <div className="schedule-input"><label className="field-label">Mở nội dung lúc<input type="datetime-local" value={toDateTimeLocal(value.scheduled_at)} onChange={event => update('scheduled_at', fromDateTimeLocal(event.target.value))} required /></label><div className="schedule-note"><Clock size={14} /> Người nghe vẫn thấy thẻ truyện, tên và đếm ngược; nội dung chỉ mở khi đến giờ.</div></div>}
              {value.publish_mode === 'scheduled' && value.scheduled_at && <div className="schedule-countdown">Còn {countdownLabel(value.scheduled_at)} · {formatDate(value.scheduled_at, true)}</div>}
            </section>

            <section className="access-section">
              <div className="access-heading"><div><span>QUYỀN TRUY CẬP</span><h3>Gói được mở truyện</h3></div><Lock size={18} /></div>
              {plans.length === 0 ? <div className="access-hint">Chưa có gói. Tạo gói trong mục “Gói &amp; ưu đãi”.</div> : <div className="plan-checks">{plans.map(plan => <label className="check-card" key={plan.id}><input type="checkbox" checked={value.planIds.includes(plan.id)} onChange={event => update('planIds', event.target.checked ? [...value.planIds, plan.id] : value.planIds.filter(id => id !== plan.id))} /><span><b>{plan.name}</b><small>{plan.is_active ? `${formatVND(plan.price_vnd)} · ${plan.code}` : 'Đang tạm dừng'}</small></span></label>)}</div>}
              <div className="editor-info-note"><Lock size={16} /><span>Không chọn gói nào = truyện miễn phí. Nếu chọn nhiều gói, người dùng có bất kỳ gói nào trong danh sách sẽ mở được. Việc thu tiền thật do StoreKit/App Store quyết định.</span></div>
            </section>

            <section className="access-section">
              <div className="access-heading"><div><span>PHÂN LOẠI</span><h3>Thể loại &amp; nhãn phụ</h3></div><Tag size={18} /></div>
              {(['genre', 'tag', 'theme'] as const).map(kind => {
                const items = tags.filter(tag => tag.kind === kind && tag.is_active)
                if (items.length === 0) return null
                return <div className="tag-select-group" key={kind}><span>{kind === 'genre' ? 'Thể loại' : kind === 'tag' ? 'Nhãn nội dung' : 'Chủ đề'}</span><div className="tag-select-chips">{items.map(tag => <button type="button" key={tag.id} className={`tag-select-chip ${value.tagIds.includes(tag.id) ? 'selected' : ''}`} style={value.tagIds.includes(tag.id) ? { borderColor: tag.color, color: tag.color } : undefined} onClick={() => update('tagIds', value.tagIds.includes(tag.id) ? value.tagIds.filter(id => id !== tag.id) : [...value.tagIds, tag.id])}><i style={{ background: tag.color }} />{tag.name}{value.tagIds.includes(tag.id) && <Check size={12} />}</button>)}</div></div>
              })}
            </section>
          </div>
        )}
        {validation && <div className="form-error editor-error">{validation}</div>}
      </div>
      <div className="modal-foot">{progress !== null && <div className="upload-progress"><span><UploadCloud size={15} /> Đang tải tệp lên kho…</span><b>{progress}%</b><i style={{ width: `${progress}%` }} /></div>}<button type="button" className="button secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="button primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Đang lưu</> : <>{story ? 'Lưu thay đổi' : 'Lưu truyện'} <span>↗</span></>}</button></div>
    </form>
  </div>
}

function FileDrop({ title, detail, icon, accept, file, currentName, currentURL, onSelect }: { title: string; detail: string; icon: ReactNode; accept: string; file: File | null; currentName?: string; currentURL?: string; onSelect: (file: File | null) => void }) {
  return <label className={`file-drop ${file || currentName || currentURL ? 'has-file' : ''}`}>
    <input type="file" accept={accept} aria-label={`Tải lên ${title.toLowerCase()}`} onChange={event => onSelect(event.target.files?.[0] ?? null)} />
    {currentURL ? <div className="cover-preview"><img src={currentURL} alt="Xem trước bìa" /></div> : <div className="file-icon">{icon}</div>}
    <span className="file-copy"><b>{title}</b><small>{file?.name ?? currentName ?? detail}</small>{file && <small className="file-size">{formatBytes(file.size)}</small>}</span>
    <span className="file-action">{file || currentName || currentURL ? <Check size={15} /> : <Plus size={16} />}</span>
  </label>
}

async function uploadAsset(bucket: string, path: string, file: File, onProgress: (percent: number) => void) {
  const contentType = file.type || (file.name.toLowerCase().endsWith('.md') ? 'text/markdown' : 'application/octet-stream')
  if (file.size <= 6 * 1024 * 1024) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', contentType, upsert: false })
    if (error) throw error
    onProgress(100)
    return
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử tải lên.')
  const projectUrl = new URL(import.meta.env.VITE_SUPABASE_URL)
  const directHost = projectUrl.hostname.endsWith('.supabase.co')
    ? `${projectUrl.hostname.split('.')[0]}.storage.supabase.co`
    : projectUrl.host
  const endpoint = `${projectUrl.protocol}//${directHost}/storage/v1/upload/resumable`

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: '3600' },
      onError: reject,
      onProgress: (uploaded, total) => onProgress(Math.round((uploaded / total) * 100)),
      onSuccess: () => { onProgress(100); resolve() },
    })
    void upload.findPreviousUploads().then(previous => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    }).catch(reject)
  })
}

function safeFileName(name: string) { return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'asset' }
function formatBytes(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }

async function replaceStoryChapters(storyID: string, chapters: ChapterDraft[]) {
  const deleteChapters = await supabase.from('story_chapters').delete().eq('story_id', storyID)
  if (deleteChapters.error) throw deleteChapters.error
  const deleteVolumes = await supabase.from('story_volumes').delete().eq('story_id', storyID)
  if (deleteVolumes.error) throw deleteVolumes.error

  const cleanChapters = chapters
    .filter(chapter => chapter.content.trim().length > 0)
    .map((chapter, index) => ({ ...chapter, chapterNumber: index + 1, sortOrder: index }))
  if (cleanChapters.length === 0) return

  const volumeTitles = Array.from(new Set(cleanChapters.map(chapter => chapter.volumeTitle).filter((title): title is string => Boolean(title))))
  const volumeIDs = new Map(volumeTitles.map(title => [title, crypto.randomUUID()]))
  if (volumeTitles.length > 0) {
    const volumeInsert = await supabase.from('story_volumes').insert(volumeTitles.map((title, index) => ({
      id: volumeIDs.get(title), story_id: storyID, title, volume_number: index + 1, sort_order: index,
    })))
    if (volumeInsert.error) throw volumeInsert.error
  }

  const rows = cleanChapters.map(chapter => ({
    id: chapter.id || crypto.randomUUID(),
    story_id: storyID,
    volume_id: chapter.volumeTitle ? volumeIDs.get(chapter.volumeTitle) ?? null : null,
    chapter_number: chapter.chapterNumber,
    title: chapter.title.trim() || `Chương ${chapter.chapterNumber}`,
    content: chapter.content,
    word_count: chapter.wordCount || countWords(chapter.content),
    is_preview: chapter.isPreview,
    sort_order: chapter.sortOrder,
  }))
  for (let start = 0; start < rows.length; start += 40) {
    const insert = await supabase.from('story_chapters').insert(rows.slice(start, start + 40))
    if (insert.error) throw insert.error
  }
}

export default App

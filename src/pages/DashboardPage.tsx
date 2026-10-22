import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, ArrowUpRight, BarChart3, BookOpen, CalendarDays, CheckCircle2,
  CreditCard, Headphones, MessageSquare, RefreshCw, Star, TrendingUp, Users,
} from 'lucide-react'
import {
  fetchDashboard, formatCompact, formatDate, formatVND, friendlyDashboardError,
} from '../lib/dashboard'
import type { DashboardData, SeriesPoint } from '../lib/dashboard'

type Page = 'overview' | 'stories' | 'analytics' | 'reviews' | 'comments' | 'leaderboard' | 'revenue' | 'settings'
type RangeDays = 7 | 30 | 90

const ranges: RangeDays[] = [7, 30, 90]

function useDashboard(days: RangeDays) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void fetchDashboard(days)
      .then(next => { if (active) setData(next) })
      .catch((cause: unknown) => {
        if (active) setError(friendlyDashboardError(cause instanceof Error ? cause.message : 'Không tải được dashboard.'))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days])

  function reload() {
    setLoading(true)
    setError('')
    void fetchDashboard(days)
      .then(setData)
      .catch((cause: unknown) => setError(friendlyDashboardError(cause instanceof Error ? cause.message : 'Không tải được dashboard.')))
      .finally(() => setLoading(false))
  }

  return { data, loading, error, reload }
}

function RangePicker({ days, onChange }: { days: RangeDays; onChange: (value: RangeDays) => void }) {
  return (
    <div className="range-picker" role="group" aria-label="Khoảng thời gian">
      <CalendarDays size={14} />
      {ranges.map(value => (
        <button key={value} className={value === days ? 'selected' : ''} onClick={() => onChange(value)}>
          {value} ngày
        </button>
      ))}
    </div>
  )
}

function DashboardShell({ title, eyebrow, description, days, onDays, onRefresh, children, actions }: {
  title: string
  eyebrow: string
  description: string
  days: RangeDays
  onDays: (value: RangeDays) => void
  onRefresh: () => void
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="page-content">
      <section className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow"><BarChart3 size={13} /> {eyebrow}</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="dashboard-actions">
          <RangePicker days={days} onChange={onDays} />
          <button className="button secondary" onClick={onRefresh}><RefreshCw size={15} /> Làm mới</button>
          {actions}
        </div>
      </section>
      {children}
    </div>
  )
}

export function DashboardPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [days, setDays] = useState<RangeDays>(30)
  const { data, loading, error, reload } = useDashboard(days)

  return (
    <DashboardShell
      title="Tổng quan vận hành"
      eyebrow="OPERATIONS"
      description="Sức khỏe sản phẩm, nội dung và cộng đồng trong một màn hình."
      days={days}
      onDays={setDays}
      onRefresh={reload}
    >
      {error && <div className="notice error"><span className="notice-icon"><Activity size={16} /></span><span>{error}</span></div>}
      {loading && !data ? <LoadingBlock label="Đang tổng hợp số liệu" /> : data ? (
        <>
          <section className="stats-grid stats-grid-dashboard">
            <KpiCard label="NGƯỜI DÙNG" value={formatCompact(data.kpis.active_devices)} detail={`${formatCompact(data.kpis.new_devices)} thiết bị mới`} icon={<Users size={18} />} />
            <KpiCard label="LƯỢT MỞ TRUYỆN" value={formatCompact(data.kpis.story_opens)} detail={`${formatCompact(data.kpis.reader_opens)} lượt đọc`} icon={<BookOpen size={18} />} />
            <KpiCard label="LƯỢT NGHE" value={formatCompact(data.kpis.listen_starts)} detail={`${formatCompact(data.kpis.completions)} hoàn thành`} icon={<Headphones size={18} />} />
            <KpiCard label="PHÚT ĐÃ NGHE" value={formatCompact(data.kpis.listen_minutes)} detail="Tổng thời lượng tích lũy" icon={<Activity size={18} />} />
            <KpiCard label="ĐÁNH GIÁ" value={formatCompact(data.kpis.ratings_total)} detail={data.kpis.rating_average ? `${data.kpis.rating_average.toFixed(1)} / 5 trung bình` : 'Chưa có đánh giá'} icon={<Star size={18} />} />
            <KpiCard label="BÌNH LUẬN CHỜ" value={formatCompact(data.kpis.comments_pending)} detail={data.kpis.comments_pending ? 'Cần duyệt trước khi hiển thị' : 'Không có bình luận chờ'} icon={<MessageSquare size={18} />} />
            <KpiCard label="DOANH THU" value={formatVND(data.kpis.revenue_cents)} detail="Chờ kết nối App Store" icon={<CreditCard size={18} />} />
            <div className="kpi-card kpi-card-action" onClick={() => onNavigate('reviews')} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onNavigate('reviews') }}>
              <div className="kpi-top"><span>CHỜ DUYỆT</span><i><ArrowUpRight size={18} /></i></div>
              <div className="kpi-value">{formatCompact(data.kpis.ratings_pending + data.kpis.comments_pending)}</div>
              <div className="kpi-detail">Mở hàng đợi kiểm duyệt</div>
            </div>
          </section>

          <section className="dashboard-grid">
            <div className="content-card chart-card">
              <div className="card-heading"><div><span className="card-eyebrow">XU HƯỚNG</span><h2>Nhịp sử dụng</h2></div><span className="card-meta">{days} ngày gần nhất</span></div>
              <LineChart points={data.series} />
            </div>
            <div className="content-card funnel-card">
              <div className="card-heading"><div><span className="card-eyebrow">CHUYỂN ĐỔI</span><h2>Phễu Plus</h2></div><span className="card-meta">StoreKit</span></div>
              <Funnel data={data} />
            </div>
          </section>

          <section className="dashboard-grid dashboard-grid-lower">
            <div className="content-card">
              <div className="card-heading"><div><span className="card-eyebrow">NỘI DUNG</span><h2>Top truyện</h2></div><button className="text-button" onClick={() => onNavigate('leaderboard')}>Xem tất cả <ArrowUpRight size={14} /></button></div>
              <TopStoriesTable stories={data.top_stories.slice(0, 5)} />
            </div>
            <div className="content-card">
              <div className="card-heading"><div><span className="card-eyebrow">CỘNG ĐỒNG</span><h2>Đánh giá mới</h2></div><button className="text-button" onClick={() => onNavigate('reviews')}>Kiểm duyệt <ArrowUpRight size={14} /></button></div>
              {data.recent_reviews.length === 0 ? <MiniEmpty icon={<Star size={19} />} text="Chưa có đánh giá nào." /> : (
                <div className="review-mini-list">
                  {data.recent_reviews.slice(0, 4).map(review => (
                    <div className="review-mini" key={review.id}>
                      <div className="review-mini-top"><strong>{review.story_title}</strong><span className="stars" aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
                      <p>{review.review || 'Chỉ để lại số sao.'}</p>
                      <span>{review.display_name} · {formatDate(review.created_at, true)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-grid dashboard-grid-lower">
            <div className="content-card">
              <div className="card-heading"><div><span className="card-eyebrow">PHÂN BỔ</span><h2>Điểm đánh giá</h2></div><span className="card-meta">{formatCompact(data.kpis.ratings_total)} đánh giá</span></div>
              <RatingDistribution data={data.rating_distribution} />
            </div>
            <div className="content-card">
              <div className="card-heading"><div><span className="card-eyebrow">HÀNG ĐỢI</span><h2>Bình luận mới</h2></div><button className="text-button" onClick={() => onNavigate('comments')}>Mở hàng đợi <ArrowUpRight size={14} /></button></div>
              {data.recent_comments.length === 0 ? <MiniEmpty icon={<MessageSquare size={19} />} text="Chưa có bình luận nào." /> : (
                <div className="review-mini-list">
                  {data.recent_comments.slice(0, 4).map(comment => (
                    <div className="review-mini" key={comment.id}>
                      <div className="review-mini-top"><strong>{comment.story_title}</strong><StatusPill status={comment.status} /></div>
                      <p>{comment.body}</p>
                      <span>{comment.display_name} · {formatDate(comment.created_at, true)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Dữ liệu tổng hợp, không chứa email hay nội dung đọc của người dùng</span></footer>
        </>
      ) : null}
    </DashboardShell>
  )
}

export function AnalyticsPage() {
  const [days, setDays] = useState<RangeDays>(30)
  const { data, loading, error, reload } = useDashboard(days)

  return (
    <DashboardShell
      title="Phân tích sản phẩm"
      eyebrow="ANALYTICS"
      description="Lượt mở, thời lượng nghe, tải nội dung và chất lượng kỹ thuật."
      days={days}
      onDays={setDays}
      onRefresh={reload}
    >
      {error && <div className="notice error"><span className="notice-icon"><Activity size={16} /></span><span>{error}</span></div>}
      {loading && !data ? <LoadingBlock label="Đang tải dữ liệu phân tích" /> : data ? (
        <>
          <section className="stats-grid stats-grid-dashboard">
            <KpiCard label="PHIÊN" value={formatCompact(data.kpis.sessions)} detail={`${formatCompact(data.kpis.active_devices)} thiết bị hoạt động`} icon={<Users size={18} />} />
            <KpiCard label="ĐỌC" value={formatCompact(data.kpis.reader_opens)} detail={`${formatCompact(data.kpis.story_opens)} lượt mở truyện`} icon={<BookOpen size={18} />} />
            <KpiCard label="NGHE" value={formatCompact(data.kpis.listen_starts)} detail={`${formatCompact(data.kpis.listen_minutes)} phút`} icon={<Headphones size={18} />} />
            <KpiCard label="HOÀN THÀNH" value={formatCompact(data.kpis.completions)} detail="Nghe hết truyện" icon={<CheckCircle2 size={18} />} />
            <KpiCard label="TẢI NỘI DUNG" value={formatCompact(data.kpis.downloads)} detail="TXT hoặc audio" icon={<ArrowUpRight size={18} />} />
          </section>

          <section className="content-card chart-card chart-card-wide">
            <div className="card-heading"><div><span className="card-eyebrow">30 NGÀY</span><h2>Tương tác theo ngày</h2></div><span className="card-meta">Ẩn danh theo thiết bị</span></div>
            <LineChart points={data.series} />
          </section>

          <section className="dashboard-grid dashboard-grid-lower">
            <div className="content-card">
              <div className="card-heading"><div><span className="card-eyebrow">SỰ KIỆN</span><h2>Hoạt động nhiều nhất</h2></div></div>
              {data.events_by_name.length === 0 ? <MiniEmpty icon={<BarChart3 size={19} />} text="Chưa có sự kiện. Mở app và đọc thử để bắt đầu." /> : <EventBars items={data.events_by_name} />}
            </div>
            <div className="content-card">
              <div className="card-heading"><div><span className="card-eyebrow">CHẤT LƯỢNG</span><h2>Tín hiệu cần chú ý</h2></div></div>
              <div className="signal-list">
                <Signal label="Tỷ lệ hoàn thành" value={data.kpis.listen_starts ? `${Math.round((data.kpis.completions / data.kpis.listen_starts) * 100)}%` : '—'} detail="So với lượt bắt đầu nghe" tone={data.kpis.listen_starts ? 'ok' : 'muted'} />
                <Signal label="Đánh giá trung bình" value={data.kpis.rating_average ? `${data.kpis.rating_average.toFixed(1)} / 5` : '—'} detail={`${data.kpis.ratings_total} đánh giá đã duyệt`} tone={data.kpis.rating_average >= 4 ? 'ok' : 'muted'} />
                <Signal label="Bình luận chờ duyệt" value={formatCompact(data.kpis.comments_pending)} detail="Cần xử lý trong hàng đợi" tone={data.kpis.comments_pending ? 'warn' : 'ok'} />
                <Signal label="Doanh thu" value={formatVND(data.kpis.revenue_cents)} detail="Chỉ có sau khi phát hành App Store" tone="muted" />
              </div>
            </div>
          </section>
          <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Không thu thập email, mật khẩu hay nội dung người dùng đọc</span></footer>
        </>
      ) : null}
    </DashboardShell>
  )
}

function KpiCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="stat-card kpi-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>
}

function LoadingBlock({ label }: { label: string }) {
  return <div className="content-card loading-block"><div className="loader" /><span>{label}</span></div>
}

export function LineChart({ points }: { points: SeriesPoint[] }) {
  const hasActivity = points.some(point => point.active_devices > 0 || point.story_opens > 0 || point.listens > 0)
  if (points.length === 0 || !hasActivity) return <div className="chart-empty"><BarChart3 size={20} /><span>Chưa có tương tác trong khoảng này.</span><small>Biểu đồ sẽ có dữ liệu khi người nghe mở app.</small></div>
  const width = 760
  const height = 220
  const padX = 16
  const padY = 18
  const max = Math.max(1, ...points.flatMap(point => [point.active_devices, point.story_opens, point.listens]))
  const x = (index: number) => padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2)
  const y = (value: number) => height - padY - (value / max) * (height - padY * 2)
  const path = (key: 'active_devices' | 'story_opens' | 'listens') => points.map((point, index) => `${x(index)},${y(point[key])}`).join(' ')
  return (
    <div className="chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ tương tác theo ngày">
        {[0, 1, 2, 3].map(row => {
          const lineY = padY + (row / 3) * (height - padY * 2)
          return <line key={row} x1={padX} x2={width - padX} y1={lineY} y2={lineY} className="chart-grid" />
        })}
        <polyline points={path('story_opens')} className="line-open" />
        <polyline points={path('listens')} className="line-listen" />
        <polyline points={path('active_devices')} className="line-users" />
      </svg>
      <div className="chart-legend">
        <span><i className="legend-users" /> Thiết bị hoạt động</span>
        <span><i className="legend-open" /> Lượt mở truyện</span>
        <span><i className="legend-listen" /> Lượt nghe</span>
      </div>
    </div>
  )
}

function Funnel({ data }: { data: DashboardData }) {
  const steps = [
    { label: 'Xem paywall', value: data.funnel.paywall_views },
    { label: 'Chọn gói', value: data.funnel.plan_selects },
    { label: 'Bấm mua', value: data.funnel.purchase_taps },
    { label: 'Thành công', value: data.funnel.purchase_success },
  ]
  const max = Math.max(1, ...steps.map(step => step.value))
  return (
    <div className="funnel">
      {steps.map((step, index) => (
        <div className="funnel-step" key={step.label}>
          <div className="funnel-label"><span>{step.label}</span><b>{formatCompact(step.value)}</b></div>
          <div className="funnel-track"><i style={{ width: `${Math.max((step.value / max) * 100, step.value ? 4 : 0)}%` }} className={`funnel-fill funnel-${index}`} /></div>
        </div>
      ))}
      <div className="funnel-foot"><TrendingUp size={14} /><span>{data.funnel.purchase_cancel} hủy · {data.funnel.purchase_fail} lỗi</span></div>
      {data.funnel.paywall_views === 0 && <p className="card-note">Phễu bắt đầu có dữ liệu khi người dùng mở màn hình Plus. Giao dịch thật cần App Store Connect.</p>}
    </div>
  )
}

function TopStoriesTable({ stories }: { stories: DashboardData['top_stories'] }) {
  if (stories.length === 0) return <MiniEmpty icon={<BookOpen size={19} />} text="Chưa có truyện xuất bản hoặc chưa có tương tác." />
  return (
    <div className="mini-table">
      <div className="mini-table-head"><span /><span>TRUYỆN</span><span>ĐIỂM</span><span>NGHE</span><span>ĐÁNH GIÁ</span></div>
      {stories.map((story, index) => (
        <div className="mini-table-row" key={story.story_id}>
          <span className="mini-rank">{String(index + 1).padStart(2, '0')}</span>
          <div className="mini-story"><strong>{story.title}</strong><span>{story.author || 'Chưa có tác giả'}</span></div>
          <b>{formatCompact(story.score)}</b>
          <span>{formatCompact(story.listen_starts)}</span>
          <span>{story.rating_count ? `${story.rating_average.toFixed(1)} ★` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function RatingDistribution({ data }: { data: DashboardData['rating_distribution'] }) {
  const max = Math.max(1, ...data.map(item => item.count))
  return (
    <div className="rating-distribution">
      {[5, 4, 3, 2, 1].map(rating => {
        const count = data.find(item => item.rating === rating)?.count ?? 0
        return (
          <div className="rating-row" key={rating}>
            <span>{rating} <Star size={11} fill="currentColor" /></span>
            <div className="rating-track"><i style={{ width: `${(count / max) * 100}%` }} /></div>
            <b>{count}</b>
          </div>
        )
      })}
    </div>
  )
}

function EventBars({ items }: { items: DashboardData['events_by_name'] }) {
  const max = Math.max(1, ...items.map(item => item.count))
  return (
    <div className="event-bars">
      {items.map(item => (
        <div className="event-row" key={item.event_name}>
          <span>{eventLabel(item.event_name)}</span>
          <div className="event-track"><i style={{ width: `${(item.count / max) * 100}%` }} /></div>
          <b>{formatCompact(item.count)}</b>
        </div>
      ))}
    </div>
  )
}

export function eventLabel(name: string): string {
  const labels: Record<string, string> = {
    app_open: 'Mở app', session_start: 'Bắt đầu phiên', session_end: 'Kết thúc phiên',
    story_impression: 'Hiển thị truyện', story_open: 'Mở truyện', reader_open: 'Mở trình đọc', reader_close: 'Đóng trình đọc',
    chapter_start: 'Bắt đầu chương', chapter_complete: 'Hoàn thành chương',
    listen_start: 'Bắt đầu nghe', listen_pause: 'Tạm dừng', listen_resume: 'Tiếp tục nghe',
    listen_seek: 'Tua', listen_heartbeat: 'Nhịp nghe', listen_complete: 'Nghe xong',
    text_download_complete: 'Tải truyện chữ', download_complete: 'Tải nội dung', audio_download_complete: 'Tải audio',
    download_start: 'Bắt đầu tải', download_fail: 'Tải thất bại', download_delete: 'Xóa bản tải',
    favorite_toggle: 'Yêu thích', search_submitted: 'Tìm kiếm', share_tap: 'Chia sẻ', paywall_view: 'Xem Plus',
    plan_select: 'Chọn gói', purchase_tap: 'Bấm mua', purchase_success: 'Mua thành công',
    purchase_cancel: 'Hủy mua', purchase_fail: 'Lỗi mua', restore_tap: 'Khôi phục mua',
    manage_subscription_tap: 'Quản lý gói', rating_submit: 'Gửi đánh giá',
    reaction_set: 'Thả cảm xúc', comment_submit: 'Gửi bình luận', story_report: 'Báo cáo truyện',
    subscription_feedback_submit: 'Phản hồi gói', push_received: 'Nhận thông báo', push_open: 'Mở thông báo',
    api_error: 'Lỗi API', playback_error: 'Lỗi phát', app_background: 'Về nền',
  }
  return labels[name] ?? name
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  return <span className={`status-pill ${status}`}><i />{status === 'pending' ? 'Chờ duyệt' : status === 'approved' ? 'Đã duyệt' : 'Từ chối'}</span>
}

function MiniEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="mini-empty"><span>{icon}</span><p>{text}</p></div>
}

function Signal({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'ok' | 'warn' | 'muted' }) {
  return <div className="signal-row"><div><span>{label}</span><small>{detail}</small></div><b className={`signal-${tone}`}>{value}</b></div>
}

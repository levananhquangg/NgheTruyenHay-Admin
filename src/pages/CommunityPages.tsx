import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Check, CheckCircle2, CircleHelp, MessageSquare, RefreshCw, Search,
  ShieldCheck, Star, Trash2, Trophy, X, XCircle,
} from 'lucide-react'
import {
  deleteComment, deleteRating, fetchComments, fetchDashboard, fetchRatings,
  formatCompact, formatDate, friendlyDashboardError, saveCommentReply,
  setCommentStatus, setRatingStatus,
} from '../lib/dashboard'
import type { CommentRow, DashboardData, RatingRow } from '../lib/dashboard'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'
type Notice = { tone: 'success' | 'error'; text: string }

function PageHeading({ title, description, eyebrow, onRefresh, children }: {
  title: string
  description: string
  eyebrow: string
  onRefresh: () => void
  children?: ReactNode
}) {
  return (
    <section className="page-heading dashboard-heading">
      <div>
        <div className="eyebrow"><ShieldCheck size={13} /> {eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="dashboard-actions">
        {children}
        <button className="button secondary" onClick={onRefresh}><RefreshCw size={15} /> Làm mới</button>
      </div>
    </section>
  )
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div className={`notice ${notice.tone}`} role="status">
      <span className="notice-icon">{notice.tone === 'success' ? <Check size={16} /> : <CircleHelp size={16} />}</span>
      <span>{notice.text}</span>
      <button onClick={onClose} aria-label="Đóng thông báo"><X size={16} /></button>
    </div>
  )
}

export function ReviewsPage() {
  const [rows, setRows] = useState<RatingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyID, setBusyID] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await fetchRatings())
      setNotice(null)
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không tải được đánh giá.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => rows.filter(row => {
    const statusMatch = filter === 'all' || row.status === filter
    const text = `${row.story_title} ${row.display_name} ${row.review}`.toLocaleLowerCase('vi')
    return statusMatch && text.includes(search.toLocaleLowerCase('vi'))
  }), [rows, filter, search])

  const counts = {
    all: rows.length,
    pending: rows.filter(row => row.status === 'pending').length,
    approved: rows.filter(row => row.status === 'approved').length,
    rejected: rows.filter(row => row.status === 'rejected').length,
  }
  const average = counts.approved ? rows.filter(row => row.status === 'approved').reduce((sum, row) => sum + row.rating, 0) / counts.approved : 0

  async function changeStatus(row: RatingRow, status: RatingRow['status']) {
    setBusyID(row.id)
    try {
      await setRatingStatus(row.id, status)
      setRows(current => current.map(item => item.id === row.id ? { ...item, status } : item))
      setNotice({ tone: 'success', text: status === 'approved' ? 'Đã duyệt đánh giá.' : status === 'rejected' ? 'Đã ẩn đánh giá khỏi ứng dụng.' : 'Đã chuyển đánh giá về hàng chờ.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không cập nhật được đánh giá.' })
    } finally {
      setBusyID(null)
    }
  }

  async function remove(row: RatingRow) {
    if (!window.confirm(`Xóa đánh giá của ${row.display_name} cho “${row.story_title}”?`)) return
    setBusyID(row.id)
    try {
      await deleteRating(row.id)
      setRows(current => current.filter(item => item.id !== row.id))
      setNotice({ tone: 'success', text: 'Đã xóa đánh giá.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không xóa được đánh giá.' })
    } finally {
      setBusyID(null)
    }
  }

  return (
    <div className="page-content">
      <PageHeading title="Đánh giá" eyebrow="COMMUNITY" description="Duyệt, ẩn hoặc xóa đánh giá công khai của người nghe." onRefresh={() => void load()} />
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}

      <section className="stats-grid review-stats">
        <MiniStat label="TỔNG" value={counts.all} detail="Tất cả đánh giá" icon={<Star size={18} />} />
        <MiniStat label="ĐÃ DUYỆT" value={counts.approved} detail="Hiển thị công khai" icon={<CheckCircle2 size={18} />} />
        <MiniStat label="CHỜ DUYỆT" value={counts.pending} detail="Cần xử lý" icon={<CircleHelp size={18} />} />
        <MiniStat label="TRUNG BÌNH" value={average ? average.toFixed(1) : '—'} detail="Trên 5 sao" icon={<Trophy size={18} />} />
      </section>

      <section className="content-card">
        <div className="content-toolbar">
          <div className="filter-tabs">
            <FilterButton label="Tất cả" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterButton label="Chờ duyệt" count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
            <FilterButton label="Đã duyệt" count={counts.approved} active={filter === 'approved'} onClick={() => setFilter('approved')} />
            <FilterButton label="Đã ẩn" count={counts.rejected} active={filter === 'rejected'} onClick={() => setFilter('rejected')} />
          </div>
          <div className="search-box"><Search size={16} /><input placeholder="Tìm truyện, người đánh giá" value={search} onChange={event => setSearch(event.target.value)} /></div>
        </div>

        {loading ? <div className="table-empty"><div className="loader" /><span>Đang tải đánh giá</span></div>
          : visible.length === 0 ? <EmptyCommunity icon={<Star size={23} />} text={rows.length ? 'Không có đánh giá phù hợp bộ lọc.' : 'Chưa có đánh giá nào. Khi người đọc chấm sao, đánh giá sẽ xuất hiện ở đây.'} />
            : <div className="moderation-list">
              {visible.map(row => (
                <article className="moderation-card" key={row.id}>
                  <div className="moderation-main">
                    <div className="moderation-top">
                      <div className="moderation-story"><strong>{row.story_title}</strong><span>{row.display_name} · {formatDate(row.created_at, true)}</span></div>
                      <div className="moderation-badges"><span className="stars" aria-label={`${row.rating} trên 5 sao`}>{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)}</span><StatusPill status={row.status} /></div>
                    </div>
                    <p className={row.review ? 'moderation-body' : 'moderation-body muted'}>{row.review || 'Chỉ để lại số sao, không có nhận xét.'}</p>
                  </div>
                  <div className="moderation-actions">
                    {row.status !== 'approved' && <button className="button small success" disabled={busyID === row.id} onClick={() => void changeStatus(row, 'approved')}><Check size={14} /> Duyệt</button>}
                    {row.status !== 'rejected' && <button className="button small secondary" disabled={busyID === row.id} onClick={() => void changeStatus(row, 'rejected')}><XCircle size={14} /> Ẩn</button>}
                    <button className="icon-button danger" title="Xóa đánh giá" aria-label="Xóa đánh giá" disabled={busyID === row.id} onClick={() => void remove(row)}><Trash2 size={16} /></button>
                  </div>
                </article>
              ))}
            </div>}
        <div className="table-footer"><span>Đang hiển thị <b>{visible.length}</b> / <b>{rows.length}</b> đánh giá</span><span>Đánh giá mới được duyệt tự động; admin có thể ẩn nếu vi phạm.</span></div>
      </section>
      <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Không hiển thị device ID cho người đọc</span></footer>
    </div>
  )
}

export function CommentsPage() {
  const [rows, setRows] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyID, setBusyID] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await fetchComments())
      setNotice(null)
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không tải được bình luận.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => rows.filter(row => {
    const statusMatch = filter === 'all' || row.status === filter
    const text = `${row.story_title} ${row.display_name} ${row.body} ${row.admin_reply ?? ''}`.toLocaleLowerCase('vi')
    return statusMatch && text.includes(search.toLocaleLowerCase('vi'))
  }), [rows, filter, search])

  const counts = {
    all: rows.length,
    pending: rows.filter(row => row.status === 'pending').length,
    approved: rows.filter(row => row.status === 'approved').length,
    rejected: rows.filter(row => row.status === 'rejected').length,
  }

  async function changeStatus(row: CommentRow, status: CommentRow['status']) {
    setBusyID(row.id)
    try {
      await setCommentStatus(row.id, status)
      setRows(current => current.map(item => item.id === row.id ? { ...item, status } : item))
      setNotice({ tone: 'success', text: status === 'approved' ? 'Đã duyệt bình luận.' : status === 'rejected' ? 'Đã ẩn bình luận.' : 'Đã chuyển bình luận về hàng chờ.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không cập nhật được bình luận.' })
    } finally {
      setBusyID(null)
    }
  }

  async function reply(row: CommentRow, value: string) {
    setBusyID(row.id)
    try {
      await saveCommentReply(row.id, value)
      setRows(current => current.map(item => item.id === row.id ? { ...item, admin_reply: value.trim() || null, admin_replied_at: value.trim() ? new Date().toISOString() : null } : item))
      setNotice({ tone: 'success', text: value.trim() ? 'Đã lưu trả lời của admin.' : 'Đã xóa trả lời.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không lưu được trả lời.' })
    } finally {
      setBusyID(null)
    }
  }

  async function remove(row: CommentRow) {
    if (!window.confirm(`Xóa bình luận của ${row.display_name}?`)) return
    setBusyID(row.id)
    try {
      await deleteComment(row.id)
      setRows(current => current.filter(item => item.id !== row.id))
      setNotice({ tone: 'success', text: 'Đã xóa bình luận.' })
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Không xóa được bình luận.' })
    } finally {
      setBusyID(null)
    }
  }

  return (
    <div className="page-content">
      <PageHeading title="Bình luận" eyebrow="MODERATION" description="Duyệt bình luận trước khi hiển thị và trả lời công khai." onRefresh={() => void load()} />
      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}

      <section className="stats-grid review-stats">
        <MiniStat label="TỔNG" value={counts.all} detail="Mọi bình luận" icon={<MessageSquare size={18} />} />
        <MiniStat label="CHỜ DUYỆT" value={counts.pending} detail="Cần xử lý trước" icon={<CircleHelp size={18} />} />
        <MiniStat label="ĐÃ DUYỆT" value={counts.approved} detail="Đang hiển thị" icon={<CheckCircle2 size={18} />} />
        <MiniStat label="ĐÃ ẨN" value={counts.rejected} detail="Không công khai" icon={<XCircle size={18} />} />
      </section>

      <section className="content-card">
        <div className="content-toolbar">
          <div className="filter-tabs">
            <FilterButton label="Chờ duyệt" count={counts.pending} active={filter === 'pending'} onClick={() => setFilter('pending')} />
            <FilterButton label="Đã duyệt" count={counts.approved} active={filter === 'approved'} onClick={() => setFilter('approved')} />
            <FilterButton label="Đã ẩn" count={counts.rejected} active={filter === 'rejected'} onClick={() => setFilter('rejected')} />
            <FilterButton label="Tất cả" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
          </div>
          <div className="search-box"><Search size={16} /><input placeholder="Tìm nội dung hoặc người gửi" value={search} onChange={event => setSearch(event.target.value)} /></div>
        </div>

        {loading ? <div className="table-empty"><div className="loader" /><span>Đang tải bình luận</span></div>
          : visible.length === 0 ? <EmptyCommunity icon={<MessageSquare size={23} />} text={rows.length ? 'Không có bình luận phù hợp bộ lọc.' : 'Chưa có bình luận nào. Bình luận mới sẽ nằm trong hàng chờ duyệt.'} />
            : <div className="moderation-list">
              {visible.map(row => <CommentCard key={row.id} row={row} busy={busyID === row.id} onStatus={status => void changeStatus(row, status)} onReply={value => void reply(row, value)} onDelete={() => void remove(row)} />)}
            </div>}
        <div className="table-footer"><span>Đang hiển thị <b>{visible.length}</b> / <b>{rows.length}</b> bình luận</span><span>Bình luận mới mặc định ở trạng thái chờ duyệt.</span></div>
      </section>
      <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Trả lời của admin được hiển thị công khai trong app</span></footer>
    </div>
  )
}

function CommentCard({ row, busy, onStatus, onReply, onDelete }: {
  row: CommentRow
  busy: boolean
  onStatus: (status: CommentRow['status']) => void
  onReply: (value: string) => void
  onDelete: () => void
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [draft, setDraft] = useState(row.admin_reply ?? '')

  return (
    <article className="moderation-card">
      <div className="moderation-main">
        <div className="moderation-top">
          <div className="moderation-story"><strong>{row.story_title}</strong><span>{row.display_name} · {formatDate(row.created_at, true)}</span></div>
          <div className="moderation-badges"><StatusPill status={row.status} /></div>
        </div>
        <p className="moderation-body">{row.body}</p>
        {row.admin_reply && !replyOpen && <div className="admin-reply"><ShieldCheck size={14} /><span><b>Trả lời của admin:</b> {row.admin_reply}</span></div>}
        {replyOpen && (
          <div className="reply-editor">
            <textarea value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={2000} placeholder="Trả lời công khai, không chia sẻ thông tin riêng tư…" />
            <div><button className="button small secondary" onClick={() => { setReplyOpen(false); setDraft(row.admin_reply ?? '') }}>Hủy</button><button className="button small success" disabled={busy} onClick={() => { onReply(draft); setReplyOpen(false) }}><Check size={14} /> Lưu trả lời</button></div>
          </div>
        )}
      </div>
      <div className="moderation-actions">
        {row.status !== 'approved' && <button className="button small success" disabled={busy} onClick={() => onStatus('approved')}><Check size={14} /> Duyệt</button>}
        {row.status !== 'rejected' && <button className="button small secondary" disabled={busy} onClick={() => onStatus('rejected')}><XCircle size={14} /> Ẩn</button>}
        <button className="button small secondary" disabled={busy} onClick={() => setReplyOpen(open => !open)}><MessageSquare size={14} /> Trả lời</button>
        <button className="icon-button danger" title="Xóa bình luận" aria-label="Xóa bình luận" disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>
      </div>
    </article>
  )
}

export function LeaderboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    void fetchDashboard(30)
      .then(setData)
      .catch((cause: unknown) => setError(friendlyDashboardError(cause instanceof Error ? cause.message : 'Không tải được bảng xếp hạng.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="page-content">
      <PageHeading title="Top truyện" eyebrow="CONTENT INTELLIGENCE" description="Xếp hạng 30 ngày dựa trên lượt nghe, hoàn thành, đánh giá và cảm xúc." onRefresh={load} />
      {error && <div className="notice error"><span className="notice-icon"><CircleHelp size={16} /></span><span>{error}</span></div>}
      {loading && !data ? <div className="content-card loading-block"><div className="loader" /><span>Đang tính bảng xếp hạng</span></div> : data ? (
        <section className="content-card">
          <div className="card-heading"><div><span className="card-eyebrow">30 NGÀY</span><h2>Bảng xếp hạng nội dung</h2></div><span className="card-meta">Cập nhật {formatDate(data.generated_at, true)}</span></div>
          {data.top_stories.length === 0 ? <EmptyCommunity icon={<Trophy size={23} />} text="Chưa có dữ liệu. Xuất bản truyện và mở app để bắt đầu đo lường." /> : (
            <div className="leaderboard-table">
              <div className="leaderboard-head"><span>#</span><span>TRUYỆN</span><span>ĐIỂM</span><span>MỞ</span><span>NGHE</span><span>XONG</span><span>PHÚT</span><span>SAO</span><span>THÍCH</span></div>
              {data.top_stories.map((story, index) => (
                <div className="leaderboard-row" key={story.story_id}>
                  <span className={`leaderboard-rank rank-${index + 1}`}>{index + 1}</span>
                  <div className="mini-story"><strong>{story.title}</strong><span>{story.author || 'Chưa có tác giả'} · {story.category}</span></div>
                  <b>{formatCompact(story.score)}</b>
                  <span>{formatCompact(story.story_opens)}</span>
                  <span>{formatCompact(story.listen_starts)}</span>
                  <span>{formatCompact(story.completions)}</span>
                  <span>{formatCompact(story.listen_minutes)}</span>
                  <span>{story.rating_count ? `${story.rating_average.toFixed(1)} ★` : '—'}</span>
                  <span>{formatCompact(story.like_count)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="table-footer"><span>Công thức: nghe ×3 + mở + hoàn thành ×5 + điểm đánh giá ×2 + thích ×0,5</span><span>30 ngày gần nhất</span></div>
        </section>
      ) : null}
      <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Dùng để chọn nội dung nổi bật, không phải doanh thu</span></footer>
    </div>
  )
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button className={active ? 'selected' : ''} onClick={onClick}>{label} <span>{count}</span></button>
}

function MiniStat({ label, value, detail, icon }: { label: string; value: number | string; detail: string; icon: ReactNode }) {
  return <div className="stat-card kpi-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  return <span className={`status-pill ${status}`}><i />{status === 'pending' ? 'Chờ duyệt' : status === 'approved' ? 'Đã duyệt' : 'Đã ẩn'}</span>
}

function EmptyCommunity({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="empty-state moderation-empty"><div className="empty-icon">{icon}</div><h3>Chưa có nội dung để hiển thị</h3><p>{text}</p></div>
}

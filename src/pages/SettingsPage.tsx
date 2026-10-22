import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, CheckCircle2, Database, ExternalLink, KeyRound, LogOut,
  RefreshCw, ShieldCheck, Users, Wifi,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchAdminMembership, fetchAuditLog, formatDate } from '../lib/dashboard'
import type { AdminMembership, AuditEntry } from '../lib/dashboard'

export function SettingsPage({ session }: { session: Session }) {
  const [membership, setMembership] = useState<AdminMembership | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [connected, setConnected] = useState<boolean | null>(null)

  function load() {
    setLoading(true)
    setNotice('')
    void Promise.all([
      fetchAdminMembership(session.user.id),
      fetchAuditLog(),
      supabase.rpc('is_story_admin'),
    ]).then(([nextMembership, nextAudit, adminCheck]) => {
      setMembership(nextMembership)
      setAudit(nextAudit)
      setConnected(!adminCheck.error && Boolean(adminCheck.data))
      if (adminCheck.error) setNotice(adminCheck.error.message)
    }).catch((cause: unknown) => {
      setNotice(cause instanceof Error ? cause.message : 'Không tải được cài đặt.')
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const projectHost = (() => {
    try { return new URL(import.meta.env.VITE_SUPABASE_URL).host } catch { return 'Chưa cấu hình' }
  })()

  return (
    <div className="page-content">
      <section className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow"><ShieldCheck size={13} /> WORKSPACE</div>
          <h1>Cài đặt</h1>
          <p>Thông tin workspace, quyền quản trị và trạng thái kết nối.</p>
        </div>
        <div className="dashboard-actions"><button className="button secondary" onClick={load}><RefreshCw size={15} /> Làm mới</button></div>
      </section>

      {notice && <div className="notice error"><span className="notice-icon"><Activity size={16} /></span><span>{notice}</span></div>}

      <section className="dashboard-grid dashboard-grid-lower">
        <div className="content-card">
          <div className="card-heading"><div><span className="card-eyebrow">TÀI KHOẢN</span><h2>Quyền quản trị</h2></div><span className={`status-pill ${connected ? 'published' : 'draft'}`}><i />{connected ? 'Đã kết nối' : 'Cần kiểm tra'}</span></div>
          <div className="settings-profile">
            <div className="avatar large-avatar">{(session.user.email?.[0] ?? 'A').toUpperCase()}</div>
            <div><strong>{membership?.display_name || session.user.email?.split('@')[0] || 'Admin'}</strong><span>{session.user.email}</span><small>{roleLabel(membership?.role)} · Thành viên từ {membership ? formatDate(membership.created_at) : '—'}</small></div>
          </div>
          <div className="settings-rows">
            <SettingRow icon={<KeyRound size={16} />} label="Supabase project" value={projectHost} />
            <SettingRow icon={<Database size={16} />} label="Dữ liệu cộng đồng" value="Story ratings · Reactions · Comments · Analytics" />
            <SettingRow icon={<ShieldCheck size={16} />} label="Khóa sử dụng" value="Chỉ publishable key trong trình duyệt" />
            <SettingRow icon={<Wifi size={16} />} label="Phiên bản app" value="1.2 · build 3" />
          </div>
          <button className="button secondary settings-signout" onClick={() => void supabase.auth.signOut()}><LogOut size={15} /> Đăng xuất khỏi workspace</button>
        </div>

        <div className="content-card">
          <div className="card-heading"><div><span className="card-eyebrow">BẢO MẬT</span><h2>Nguyên tắc dữ liệu</h2></div><ExternalLink size={16} /></div>
          <div className="security-list">
            <SecurityItem title="Không có service role key" detail="Admin Panel chỉ gọi Supabase bằng publishable key và RLS." />
            <SecurityItem title="Quyền admin kiểm tra phía server" detail="Mọi RPC dashboard đều xác minh public.is_story_admin()." />
            <SecurityItem title="Dữ liệu ẩn danh" detail="Analytics dùng device UUID; không lưu email hay nội dung đọc." />
            <SecurityItem title="Kiểm duyệt cộng đồng" detail="Bình luận mặc định chờ duyệt; admin có thể ẩn hoặc xóa." />
            <SecurityItem title="Doanh thu thật" detail="Chỉ đồng bộ từ App Store / RevenueCat sau khi phát hành." />
          </div>
        </div>
      </section>

      <section className="content-card">
        <div className="card-heading"><div><span className="card-eyebrow">NHẬT KÝ</span><h2>Thay đổi nội dung gần đây</h2></div><span className="card-meta">Tự động ghi</span></div>
        {loading ? <div className="loading-block compact"><div className="loader" /><span>Đang tải nhật ký</span></div> : audit.length === 0 ? (
          <div className="mini-empty"><span><Activity size={19} /></span><p>Chưa có thay đổi nội dung nào được ghi nhận.</p></div>
        ) : (
          <div className="audit-list">
            {audit.map(entry => (
              <div className="audit-row" key={entry.id}>
                <span className="audit-icon"><CheckCircle2 size={15} /></span>
                <div><strong>{auditAction(entry.action)}</strong><span>{String(entry.details.title ?? 'Truyện')} {entry.details.is_published ? '· đã xuất bản' : '· bản nháp'}</span></div>
                <small>{formatDate(entry.created_at, true)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="content-card">
        <div className="card-heading"><div><span className="card-eyebrow">VAI TRÒ</span><h2>Phân quyền dự kiến</h2></div><Users size={16} /></div>
        <div className="role-grid">
          <RoleCard role="Owner" detail="Toàn quyền, quản lý thành viên và doanh thu." />
          <RoleCard role="Admin" detail="Nội dung, cộng đồng, vận hành." />
          <RoleCard role="Editor" detail="Tạo và xuất bản truyện." />
          <RoleCard role="Analyst" detail="Đọc dashboard, không sửa nội dung." />
          <RoleCard role="Support" detail="Duyệt bình luận và phản hồi." />
        </div>
        <p className="card-note">Migration hiện tại lưu vai trò trong public.story_admins. RLS dashboard đang cho tất cả admin đọc; có thể siết theo vai trò khi mời thêm thành viên.</p>
      </section>
      <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Workspace quản trị nội bộ · không chia sẻ liên kết đăng nhập</span></footer>
    </div>
  )
}

function SettingRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="setting-row"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
}

function SecurityItem({ title, detail }: { title: string; detail: string }) {
  return <div className="security-item"><CheckCircle2 size={15} /><div><strong>{title}</strong><p>{detail}</p></div></div>
}

function RoleCard({ role, detail }: { role: string; detail: string }) {
  return <div className="role-card"><strong>{role}</strong><p>{detail}</p></div>
}

function roleLabel(role: AdminMembership['role'] | undefined): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'editor') return 'Editor'
  if (role === 'analyst') return 'Analyst'
  if (role === 'support') return 'Support'
  return 'Quản trị viên'
}

function auditAction(action: string): string {
  if (action === 'insert') return 'Thêm truyện'
  if (action === 'update') return 'Cập nhật truyện'
  if (action === 'delete') return 'Xóa truyện'
  return action
}

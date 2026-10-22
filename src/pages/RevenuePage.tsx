import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle, AppWindow, CheckCircle2, CreditCard, MessageSquare,
  ReceiptText, RefreshCw, ShieldCheck, Sparkles, WalletCards,
} from 'lucide-react'
import {
  fetchPurchases, fetchSubscriptionFeedback, formatDate, formatVND,
} from '../lib/dashboard'
import type { PurchaseRow, SubscriptionFeedback } from '../lib/dashboard'

export function RevenuePage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [feedback, setFeedback] = useState<SubscriptionFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    setError('')
    void Promise.all([fetchPurchases(), fetchSubscriptionFeedback()])
      .then(([nextPurchases, nextFeedback]) => {
        setPurchases(nextPurchases)
        setFeedback(nextFeedback)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu doanh thu.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const active = purchases.filter(row => row.status !== 'refunded')
  const refunded = purchases.filter(row => row.status === 'refunded')
  const revenue = active.reduce((sum, row) => sum + (row.price_cents ?? 0), 0)

  return (
    <div className="page-content">
      <section className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow"><WalletCards size={13} /> REVENUE</div>
          <h1>Doanh thu</h1>
          <p>Dữ liệu giao dịch thật chỉ xuất hiện sau khi phát hành trên App Store.</p>
        </div>
        <div className="dashboard-actions"><button className="button secondary" onClick={load}><RefreshCw size={15} /> Làm mới</button></div>
      </section>

      {error && <div className="notice error"><span className="notice-icon"><AlertCircle size={16} /></span><span>{error}</span></div>}

      <section className="stats-grid review-stats">
        <RevenueStat icon={<CreditCard size={18} />} label="DOANH THU" value={formatVND(revenue)} detail="Chưa kết nối App Store" />
        <RevenueStat icon={<ReceiptText size={18} />} label="GIAO DỊCH" value={String(active.length)} detail="Đã ghi nhận" />
        <RevenueStat icon={<RefreshCw size={18} />} label="HOÀN TIỀN" value={String(refunded.length)} detail="Cần đối soát" />
        <RevenueStat icon={<MessageSquare size={18} />} label="PHẢN HỒI" value={String(feedback.length)} detail="Khảo sát hủy / hoàn" />
      </section>

      {loading ? <div className="content-card loading-block"><div className="loader" /><span>Đang kiểm tra dữ liệu giao dịch</span></div> : (
        <section className="dashboard-grid dashboard-grid-lower">
          <div className="content-card">
            <div className="card-heading"><div><span className="card-eyebrow">TRẠNG THÁI</span><h2>Chưa có doanh thu thật</h2></div><span className="status-pill draft"><i />CHỜ PHÁT HÀNH</span></div>
            <div className="revenue-empty">
              <div className="revenue-orbit"><AppWindow size={30} /><span><Sparkles size={14} /></span></div>
              <p>App đang chạy bản thử nghiệm. StoreKit chỉ trả về giao dịch khi sản phẩm đã được tạo trong App Store Connect và app được cài từ App Store hoặc TestFlight.</p>
              <p>Trang này không hiển thị doanh thu giả. Khi có giao dịch, số liệu sẽ được đồng bộ từ hóa đơn App Store / RevenueCat.</p>
            </div>
            <div className="integration-list">
              <Integration label="Tạo gói Plus trong App Store Connect" done={false} />
              <Integration label="Bật In-App Purchase và ký Paid Apps" done={false} />
              <Integration label="Kết nối RevenueCat hoặc App Store Server API" done={false} />
              <Integration label="Bật App Store Server Notifications" done={false} />
              <Integration label="Đối soát hoàn tiền và khảo sát hủy" done={false} />
            </div>
          </div>

          <div className="content-card">
            <div className="card-heading"><div><span className="card-eyebrow">PHẢN HỒI</span><h2>Khảo sát gần đây</h2></div><span className="card-meta">{feedback.length}</span></div>
            {feedback.length === 0 ? <div className="mini-empty"><span><MessageSquare size={19} /></span><p>Chưa có phản hồi. Khảo sát xuất hiện sau khi người dùng hủy mua hoặc yêu cầu hoàn tiền.</p></div> : (
              <div className="feedback-list">
                {feedback.slice(0, 8).map(item => (
                  <div className="feedback-row" key={item.id}>
                    <div className="feedback-head"><span className={`status-pill ${item.stage === 'refund' ? 'rejected' : 'pending'}`}><i />{stageLabel(item.stage)}</span><span>{formatDate(item.created_at, true)}</span></div>
                    <strong>{reasonLabel(item.reason_code)}</strong>
                    {item.reason_text && <p>{item.reason_text}</p>}
                    <small>{item.plan ?? 'Không rõ gói'}</small>
                  </div>
                ))}
              </div>
            )}
            <div className="secure-note revenue-note"><ShieldCheck size={16} /> Phản hồi ẩn danh. Không lưu email, số thẻ hay thông tin thanh toán.</div>
          </div>
        </section>
      )}

      <section className="content-card">
        <div className="card-heading"><div><span className="card-eyebrow">KIẾN TRÚC</span><h2>Luồng dữ liệu chuẩn</h2></div><span className="card-meta">Production</span></div>
        <div className="architecture-flow">
          <ArchitectureStep number="01" title="App Store" detail="StoreKit 2 xác thực giao dịch trên thiết bị" />
          <ArchitectureStep number="02" title="Server" detail="App Store Server API / RevenueCat xác minh biên lai" />
          <ArchitectureStep number="03" title="Supabase" detail="Bảng purchases, subscription_events, entitlements" />
          <ArchitectureStep number="04" title="Dashboard" detail="Doanh thu, hoàn tiền, khảo sát hủy" />
        </div>
      </section>
      <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Không có dữ liệu thanh toán giả trên môi trường thử nghiệm</span></footer>
    </div>
  )
}

function RevenueStat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="stat-card kpi-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><div className="stat-value revenue-value">{value}</div><div className="stat-detail">{detail}</div></div>
}

function Integration({ label, done }: { label: string; done: boolean }) {
  return <div className="integration-row"><span className={done ? 'done' : ''}>{done ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}</span><p>{label}</p></div>
}

function ArchitectureStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="architecture-step"><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></div>
}

function stageLabel(stage: SubscriptionFeedback['stage']): string {
  if (stage === 'refund') return 'Hoàn tiền'
  if (stage === 'purchase_hesitation') return 'Chưa nâng cấp'
  if (stage === 'support') return 'Hỗ trợ'
  return 'Hủy gói'
}

function reasonLabel(code: string | null): string {
  const labels: Record<string, string> = {
    price: 'Giá chưa phù hợp',
    missing_features: 'Thiếu tính năng cần thiết',
    not_enough_content: 'Kho truyện chưa đủ',
    technical: 'Lỗi khi sử dụng',
    unsure: 'Muốn tìm hiểu thêm',
    accidental: 'Mua nhầm',
    not_used: 'Không dùng đủ',
    other: 'Lý do khác',
  }
  return code ? labels[code] ?? code : 'Không chọn lý do'
}

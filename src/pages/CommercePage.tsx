import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle, BadgePercent, CalendarClock, Check, CheckCircle2, Copy, CreditCard,
  Layers, Pencil, Percent, Plus, Power, RefreshCw, Sparkles, Ticket, Trash2, Users, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  BILLING_PERIOD_LABELS, ENTITLEMENT_OPTIONS, formatDate, formatVND, fromDateTimeLocal,
  normalizeVoucherCode, toDateTimeLocal, voucherStatus, voucherTypeLabel,
} from '../lib/content'
import type { PlanRecord, PlanSaleRecord, VoucherRecord, VoucherType, VoucherValidation } from '../lib/content'

type CommerceTab = 'plans' | 'sales' | 'vouchers'
type Notice = { tone: 'success' | 'error'; text: string } | null

type PlanForm = {
  id?: string
  code: string
  name: string
  description: string
  tier: number
  billing_period: PlanRecord['billing_period']
  price_vnd: number
  original_price_vnd: number | null
  featuresText: string
  entitlements: Record<string, boolean>
  app_store_product_id: string
  is_active: boolean
  is_featured: boolean
  sort_order: number
}

type SaleForm = {
  id?: string
  plan_id: string
  name: string
  discount_percent: number
  starts_at: string
  ends_at: string
  is_active: boolean
}

type VoucherForm = {
  id?: string
  code: string
  name: string
  description: string
  voucher_type: VoucherType
  discount_percent: number
  discount_amount_vnd: number
  trial_days: number
  max_discount_vnd: number | null
  min_order_vnd: number
  starts_at: string
  ends_at: string
  usage_limit: number | null
  per_device_limit: number
  app_store_offer_code: string
  is_active: boolean
  all_plans: boolean
  planIds: string[]
}

const emptyEntitlements = () => Object.fromEntries(ENTITLEMENT_OPTIONS.map(option => [option.key, false]))

function nowLocal() {
  return toDateTimeLocal(new Date().toISOString())
}

function nextDayLocal() {
  return toDateTimeLocal(new Date(Date.now() + 86_400_000).toISOString())
}

function blankPlan(): PlanForm {
  return {
    code: '', name: '', description: '', tier: 1, billing_period: 'month',
    price_vnd: 49000, original_price_vnd: null, featuresText: '',
    entitlements: { ...emptyEntitlements(), sleep_timer: true },
    app_store_product_id: '', is_active: true, is_featured: false, sort_order: 30,
  }
}

function blankSale(plans: PlanRecord[]): SaleForm {
  return {
    plan_id: plans.find(plan => plan.tier > 0)?.id ?? plans[0]?.id ?? '',
    name: '', discount_percent: 20, starts_at: nowLocal(), ends_at: nextDayLocal(), is_active: true,
  }
}

function blankVoucher(plans: PlanRecord[]): VoucherForm {
  return {
    code: '', name: '', description: '', voucher_type: 'percent',
    discount_percent: 20, discount_amount_vnd: 20000, trial_days: 7,
    max_discount_vnd: null, min_order_vnd: 0,
    starts_at: nowLocal(), ends_at: nextDayLocal(),
    usage_limit: null, per_device_limit: 1, app_store_offer_code: '',
    is_active: true, all_plans: true,
    planIds: plans.filter(plan => plan.tier > 0).map(plan => plan.id),
  }
}

function planToForm(plan: PlanRecord): PlanForm {
  return {
    id: plan.id, code: plan.code, name: plan.name, description: plan.description,
    tier: plan.tier, billing_period: plan.billing_period, price_vnd: plan.price_vnd,
    original_price_vnd: plan.original_price_vnd,
    featuresText: (plan.features ?? []).join('\n'),
    entitlements: { ...emptyEntitlements(), ...(plan.entitlements ?? {}) },
    app_store_product_id: plan.app_store_product_id ?? '',
    is_active: plan.is_active, is_featured: plan.is_featured, sort_order: plan.sort_order,
  }
}

function saleToForm(sale: PlanSaleRecord): SaleForm {
  return {
    id: sale.id, plan_id: sale.plan_id, name: sale.name,
    discount_percent: Number(sale.discount_percent), starts_at: toDateTimeLocal(sale.starts_at),
    ends_at: toDateTimeLocal(sale.ends_at), is_active: sale.is_active,
  }
}

function voucherToForm(voucher: VoucherRecord): VoucherForm {
  const planIds = (voucher.voucher_plans ?? []).map(item => item.plan_id)
  return {
    id: voucher.id, code: voucher.code, name: voucher.name, description: voucher.description,
    voucher_type: voucher.voucher_type,
    discount_percent: Number(voucher.discount_percent ?? 20),
    discount_amount_vnd: Number(voucher.discount_amount_vnd ?? 20000),
    trial_days: Number(voucher.trial_days ?? 7),
    max_discount_vnd: voucher.max_discount_vnd, min_order_vnd: voucher.min_order_vnd,
    starts_at: toDateTimeLocal(voucher.starts_at), ends_at: toDateTimeLocal(voucher.ends_at),
    usage_limit: voucher.usage_limit, per_device_limit: voucher.per_device_limit,
    app_store_offer_code: voucher.app_store_offer_code ?? '', is_active: voucher.is_active,
    all_plans: planIds.length === 0, planIds,
  }
}

export function CommercePage() {
  const [tab, setTab] = useState<CommerceTab>('plans')
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [sales, setSales] = useState<PlanSaleRecord[]>([])
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [planForm, setPlanForm] = useState<PlanForm | null>(null)
  const [saleForm, setSaleForm] = useState<SaleForm | null>(null)
  const [voucherForm, setVoucherForm] = useState<VoucherForm | null>(null)

  async function load(showLoader = true) {
    if (showLoader) setLoading(true)
    const [planResult, saleResult, voucherResult] = await Promise.all([
      supabase.from('plans').select('*').order('sort_order', { ascending: true }),
      supabase.from('plan_sales').select('*').order('starts_at', { ascending: false }),
      supabase.from('vouchers').select('*, voucher_plans(plan_id)').order('created_at', { ascending: false }),
    ])
    const error = planResult.error ?? saleResult.error ?? voucherResult.error
    if (error) setNotice({ tone: 'error', text: error.message })
    else {
      setPlans((planResult.data ?? []) as unknown as PlanRecord[])
      setSales((saleResult.data ?? []) as unknown as PlanSaleRecord[])
      setVouchers((voucherResult.data ?? []) as unknown as VoucherRecord[])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const activeSales = useMemo(() => sales.filter(sale => {
    const now = Date.now()
    return sale.is_active && new Date(sale.starts_at).getTime() <= now && (!sale.ends_at || new Date(sale.ends_at).getTime() > now)
  }), [sales])

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!planForm) return
    if (!planForm.code.trim() || !planForm.name.trim()) {
      setNotice({ tone: 'error', text: 'Mã gói và tên gói không được để trống.' })
      return
    }
    setSaving(true); setNotice(null)
    const payload = {
      code: planForm.code.trim().toLowerCase(), name: planForm.name.trim(),
      description: planForm.description.trim(), tier: Number(planForm.tier),
      billing_period: planForm.billing_period, price_vnd: Math.max(0, Math.round(Number(planForm.price_vnd))),
      original_price_vnd: planForm.original_price_vnd === null ? null : Math.max(0, Math.round(Number(planForm.original_price_vnd))),
      features: planForm.featuresText.split('\n').map(value => value.trim()).filter(Boolean),
      entitlements: planForm.entitlements,
      app_store_product_id: planForm.app_store_product_id.trim() || null,
      is_active: planForm.is_active, is_featured: planForm.is_featured,
      sort_order: Number(planForm.sort_order) || 0,
      updated_at: new Date().toISOString(),
    }
    const result = planForm.id
      ? await supabase.from('plans').update(payload).eq('id', planForm.id)
      : await supabase.from('plans').insert(payload)
    if (result.error) setNotice({ tone: 'error', text: result.error.message })
    else {
      setPlanForm(null)
      setNotice({ tone: 'success', text: planForm.id ? 'Đã cập nhật gói.' : 'Đã tạo gói mới.' })
      await load(false)
    }
    setSaving(false)
  }

  async function togglePlan(plan: PlanRecord) {
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('plans').update({ is_active: !plan.is_active, updated_at: new Date().toISOString() }).eq('id', plan.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: plan.is_active ? 'Đã tạm dừng gói.' : 'Đã kích hoạt gói.' }); await load(false) }
    setSaving(false)
  }

  async function deletePlan(plan: PlanRecord) {
    if (plan.code === 'free') {
      setNotice({ tone: 'error', text: 'Không xóa gói Miễn phí. Hãy giữ gói này làm mặc định.' })
      return
    }
    if (!window.confirm(`Xóa gói “${plan.name}”? Truyện đang gán vào gói này sẽ trở về miễn phí và sale/voucher liên quan cũng bị xóa.`)) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('plans').delete().eq('id', plan.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: 'Đã xóa gói.' }); await load(false) }
    setSaving(false)
  }

  async function saveSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!saleForm) return
    const startsAt = fromDateTimeLocal(saleForm.starts_at)
    const endsAt = fromDateTimeLocal(saleForm.ends_at)
    if (!saleForm.plan_id || !saleForm.name.trim() || !startsAt) {
      setNotice({ tone: 'error', text: 'Chọn gói, đặt tên sale và thời gian bắt đầu.' })
      return
    }
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setNotice({ tone: 'error', text: 'Thời gian kết thúc phải sau thời gian bắt đầu.' })
      return
    }
    setSaving(true); setNotice(null)
    const payload = {
      plan_id: saleForm.plan_id, name: saleForm.name.trim(),
      discount_percent: Math.min(100, Math.max(0.01, Number(saleForm.discount_percent))),
      starts_at: startsAt, ends_at: endsAt, is_active: saleForm.is_active,
      updated_at: new Date().toISOString(),
    }
    const result = saleForm.id
      ? await supabase.from('plan_sales').update(payload).eq('id', saleForm.id)
      : await supabase.from('plan_sales').insert(payload)
    if (result.error) setNotice({ tone: 'error', text: result.error.message })
    else {
      setSaleForm(null)
      setNotice({ tone: 'success', text: saleForm.id ? 'Đã cập nhật sale.' : 'Đã tạo sale mới.' })
      await load(false)
    }
    setSaving(false)
  }

  async function deleteSale(sale: PlanSaleRecord) {
    if (!window.confirm(`Xóa sale “${sale.name}”?`)) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('plan_sales').delete().eq('id', sale.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: 'Đã xóa sale.' }); await load(false) }
    setSaving(false)
  }

  async function generateVoucherCode() {
    if (!voucherForm) return
    setSaving(true); setNotice(null)
    const { data, error } = await supabase.rpc('generate_voucher_code', { p_prefix: 'NTH' })
    if (error) setNotice({ tone: 'error', text: error.message })
    else {
      setVoucherForm(current => current ? { ...current, code: String(data) } : current)
      setNotice({ tone: 'success', text: 'Đã tạo mã ngẫu nhiên. Bấm lưu để phát hành.' })
    }
    setSaving(false)
  }

  async function saveVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!voucherForm) return
    const code = normalizeVoucherCode(voucherForm.code)
    if (!/^[A-Z0-9-]{4,40}$/.test(code) || !voucherForm.name.trim()) {
      setNotice({ tone: 'error', text: 'Mã voucher phải gồm chữ, số, dấu gạch và tên không được trống.' })
      return
    }
    if (!voucherForm.all_plans && voucherForm.planIds.length === 0) {
      setNotice({ tone: 'error', text: 'Chọn ít nhất một gói hoặc chọn “Tất cả gói”.' })
      return
    }
    const startsAt = fromDateTimeLocal(voucherForm.starts_at)
    const endsAt = fromDateTimeLocal(voucherForm.ends_at)
    if (!startsAt) { setNotice({ tone: 'error', text: 'Thời gian bắt đầu không hợp lệ.' }); return }
    if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setNotice({ tone: 'error', text: 'Thời gian kết thúc phải sau thời gian bắt đầu.' })
      return
    }
    if (voucherForm.voucher_type === 'percent' && (voucherForm.discount_percent <= 0 || voucherForm.discount_percent > 100)) {
      setNotice({ tone: 'error', text: 'Phần trăm giảm phải trong khoảng 1–100.' }); return
    }
    if (voucherForm.voucher_type === 'fixed' && voucherForm.discount_amount_vnd <= 0) {
      setNotice({ tone: 'error', text: 'Số tiền giảm phải lớn hơn 0.' }); return
    }
    if (voucherForm.voucher_type === 'trial' && voucherForm.trial_days <= 0) {
      setNotice({ tone: 'error', text: 'Số ngày dùng thử phải lớn hơn 0.' }); return
    }

    setSaving(true); setNotice(null)
    const payload = {
      code, name: voucherForm.name.trim(), description: voucherForm.description.trim(),
      voucher_type: voucherForm.voucher_type,
      discount_percent: voucherForm.voucher_type === 'percent' ? voucherForm.discount_percent : null,
      discount_amount_vnd: voucherForm.voucher_type === 'fixed' ? Math.round(voucherForm.discount_amount_vnd) : null,
      trial_days: voucherForm.voucher_type === 'trial' ? Math.round(voucherForm.trial_days) : null,
      max_discount_vnd: voucherForm.voucher_type === 'percent' && voucherForm.max_discount_vnd
        ? Math.round(voucherForm.max_discount_vnd) : null,
      min_order_vnd: Math.max(0, Math.round(voucherForm.min_order_vnd)),
      starts_at: startsAt, ends_at: endsAt,
      usage_limit: voucherForm.usage_limit === null ? null : Math.max(1, Math.round(voucherForm.usage_limit)),
      per_device_limit: Math.max(1, Math.round(voucherForm.per_device_limit)),
      app_store_offer_code: voucherForm.app_store_offer_code.trim() || null,
      is_active: voucherForm.is_active, updated_at: new Date().toISOString(),
    }
    const saved = voucherForm.id
      ? await supabase.from('vouchers').update(payload).eq('id', voucherForm.id).select('id').single()
      : await supabase.from('vouchers').insert(payload).select('id').single()
    if (saved.error || !saved.data) {
      setNotice({ tone: 'error', text: saved.error?.message ?? 'Không lưu được voucher.' })
      setSaving(false); return
    }
    const voucherID = String(saved.data.id)
    const scopeDelete = await supabase.from('voucher_plans').delete().eq('voucher_id', voucherID)
    if (scopeDelete.error) {
      setNotice({ tone: 'error', text: scopeDelete.error.message })
      setSaving(false); return
    }
    if (!voucherForm.all_plans && voucherForm.planIds.length > 0) {
      const scopes = await supabase.from('voucher_plans').insert(voucherForm.planIds.map(planID => ({ voucher_id: voucherID, plan_id: planID })))
      if (scopes.error) {
        setNotice({ tone: 'error', text: scopes.error.message })
        setSaving(false); return
      }
    }
    setVoucherForm(null)
    setNotice({ tone: 'success', text: voucherForm.id ? 'Đã cập nhật voucher.' : `Đã phát hành voucher ${code}.` })
    await load(false)
    setSaving(false)
  }

  async function toggleVoucher(voucher: VoucherRecord) {
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('vouchers').update({ is_active: !voucher.is_active, updated_at: new Date().toISOString() }).eq('id', voucher.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: voucher.is_active ? 'Đã tạm dừng voucher.' : 'Đã kích hoạt voucher.' }); await load(false) }
    setSaving(false)
  }

  async function deleteVoucher(voucher: VoucherRecord) {
    if (!window.confirm(`Xóa voucher ${voucher.code}? Lịch sử đổi voucher sẽ không thể xóa nếu đã có người dùng.`)) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('vouchers').delete().eq('id', voucher.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: 'Đã xóa voucher.' }); await load(false) }
    setSaving(false)
  }

  return (
    <div className="page-content">
      <section className="page-heading">
        <div><div className="eyebrow"><Sparkles size={13} /> COMMERCE</div><h1>Gói &amp; ưu đãi</h1><p>Quản lý quyền lợi, giá hiển thị, sale và voucher. Thanh toán thật vẫn do App Store xử lý.</p></div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => void load(false)} disabled={loading || saving}><RefreshCw size={15} /> Làm mới</button>
          <button className="button primary" onClick={() => {
            if (tab === 'plans') setPlanForm(blankPlan())
            else if (tab === 'sales') setSaleForm(blankSale(plans))
            else setVoucherForm(blankVoucher(plans))
          }}><Plus size={16} /> {tab === 'plans' ? 'Thêm gói' : tab === 'sales' ? 'Tạo sale' : 'Tạo voucher'}</button>
        </div>
      </section>

      {notice && <div className={`notice ${notice.tone}`} role="status"><span className="notice-icon">{notice.tone === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}</span><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={16} /></button></div>}

      <div className="editor-tabs commerce-tabs">
        <button className={tab === 'plans' ? 'selected' : ''} onClick={() => setTab('plans')}><CreditCard size={15} /> Gói <span>{plans.length}</span></button>
        <button className={tab === 'sales' ? 'selected' : ''} onClick={() => setTab('sales')}><BadgePercent size={15} /> Sale <span>{sales.length}</span></button>
        <button className={tab === 'vouchers' ? 'selected' : ''} onClick={() => setTab('vouchers')}><Ticket size={15} /> Voucher <span>{vouchers.length}</span></button>
      </div>

      {loading ? <div className="table-empty"><div className="loader" /><span>Đang tải cấu hình gói</span></div> : tab === 'plans' ? (
        <section className="commerce-grid">
          {plans.map(plan => {
            const sale = activeSales.find(item => item.plan_id === plan.id)
            return <article className="plan-card" key={plan.id}>
              <div className="plan-card-head">
                <div><span className="commerce-code">{plan.code}</span><h3>{plan.name}</h3></div>
                <span className={`commerce-status ${plan.is_active ? 'active' : 'paused'}`}><i />{plan.is_active ? 'Đang bán' : 'Tạm dừng'}</span>
              </div>
              <div className="plan-price">{formatVND(plan.price_vnd)} <span>/ {BILLING_PERIOD_LABELS[plan.billing_period].toLowerCase()}</span></div>
              {sale ? <div className="plan-sale-note"><Percent size={13} /> Sale −{Number(sale.discount_percent)}% · {formatVND(Math.round(plan.price_vnd * (100 - Number(sale.discount_percent)) / 100))}</div> : <div className="plan-muted">Không có sale đang chạy</div>}
              <div className="plan-features">{(plan.features ?? []).slice(0, 4).map(feature => <span key={feature}><Check size={12} /> {feature}</span>)}{(!plan.features || plan.features.length === 0) && <span className="plan-muted">Chưa cấu hình quyền lợi</span>}</div>
              <div className="plan-meta"><span><Layers size={13} /> {plan.entitlements?.offline_downloads ? 'Offline' : 'Online'}</span><span><CreditCard size={13} /> {plan.app_store_product_id || 'Chưa có product ID'}</span></div>
              <div className="plan-actions">
                <button className="button secondary small" onClick={() => setPlanForm(planToForm(plan))}><Pencil size={13} /> Sửa</button>
                <button className="icon-button" title={plan.is_active ? 'Tạm dừng' : 'Kích hoạt'} onClick={() => void togglePlan(plan)} disabled={saving}><Power size={15} /></button>
                <button className="icon-button danger-icon" title="Xóa gói" onClick={() => void deletePlan(plan)} disabled={saving || plan.code === 'free'}><Trash2 size={15} /></button>
              </div>
            </article>
          })}
          {plans.length === 0 && <div className="empty-state"><div className="empty-icon"><CreditCard size={23} /></div><h3>Chưa có gói nào</h3><p>Tạo gói đầu tiên để mở khóa tính năng hội viên.</p></div>}
        </section>
      ) : tab === 'sales' ? (
        <section className="content-card">
          <div className="commerce-section-head"><div><h2>Đợt giảm giá theo gói</h2><p>Sale được stack với voucher khi hiển thị. Giá thu thật phải khớp offer trên App Store.</p></div><span className="commerce-hint"><CalendarClock size={14} /> Múi giờ thiết bị</span></div>
          <div className="table-header commerce-sale-header"><span>CHƯƠNG TRÌNH</span><span>GÓI</span><span>GIẢM</span><span>THỜI GIAN</span><span>TRẠNG THÁI</span><span /></div>
          {sales.length === 0 ? <div className="table-empty">Chưa có sale. Tạo đợt giảm giá để hiển thị giá ưu đãi trong app.</div> : <div className="story-list">{sales.map(sale => {
            const plan = plans.find(item => item.id === sale.plan_id)
            const current = activeSales.some(item => item.id === sale.id)
            return <div className="commerce-sale-row" key={sale.id}>
              <div><strong>{sale.name}</strong><span>#{sale.id.slice(0, 6)}</span></div>
              <span>{plan?.name ?? 'Gói đã xóa'}</span>
              <strong className="discount-value">−{Number(sale.discount_percent)}%</strong>
              <span className="date-range">{formatDate(sale.starts_at, true)}<br />→ {formatDate(sale.ends_at, true)}</span>
              <span className={`commerce-status ${current ? 'active' : sale.is_active ? 'scheduled' : 'paused'}`}><i />{current ? 'Đang chạy' : sale.is_active ? 'Đã kết thúc' : 'Tạm dừng'}</span>
              <div className="row-actions"><button className="icon-button" title="Sửa sale" onClick={() => setSaleForm(saleToForm(sale))}><Pencil size={15} /></button><button className="icon-button danger-icon" title="Xóa sale" onClick={() => void deleteSale(sale)}><Trash2 size={15} /></button></div>
            </div>
          })}</div>}
        </section>
      ) : (
        <VoucherWorkspace
          vouchers={vouchers}
          plans={plans}
          saving={saving}
          onEdit={setVoucherFormFromRecord(setVoucherForm)}
          onToggle={voucher => void toggleVoucher(voucher)}
          onDelete={voucher => void deleteVoucher(voucher)}
          onNotice={setNotice}
        />
      )}

      <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Giá trong admin là cấu hình hiển thị · StoreKit là nguồn thu thật</span></footer>

      {planForm && <PlanEditor form={planForm} saving={saving} onChange={setPlanForm} onClose={() => !saving && setPlanForm(null)} onSubmit={savePlan} />}
      {saleForm && <SaleEditor form={saleForm} plans={plans} saving={saving} onChange={setSaleForm} onClose={() => !saving && setSaleForm(null)} onSubmit={saveSale} />}
      {voucherForm && <VoucherEditor form={voucherForm} plans={plans} saving={saving} onChange={setVoucherForm} onClose={() => !saving && setVoucherForm(null)} onSubmit={saveVoucher} onGenerate={() => void generateVoucherCode()} />}
    </div>
  )
}

function setVoucherFormFromRecord(setter: (value: VoucherForm | null) => void) {
  return (voucher: VoucherRecord) => setter(voucherToForm(voucher))
}

function PlanEditor({ form, saving, onChange, onClose, onSubmit }: {
  form: PlanForm
  saving: boolean
  onChange: (value: PlanForm) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  function update<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    onChange({ ...form, [key]: value })
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form className="editor-modal compact-modal" onSubmit={onSubmit}>
      <div className="modal-head"><div><div className="eyebrow">{form.id ? 'CẬP NHẬT GÓI' : 'GÓI MỚI'}</div><h2>{form.id ? 'Sửa gói hội viên' : 'Tạo gói hội viên'}</h2></div><button type="button" className="icon-button close-button" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      <div className="editor-scroll">
        <div className="field-pair"><label className="field-label">Mã gói (code)<input value={form.code} onChange={event => update('code', event.target.value)} placeholder="plus_monthly" pattern="[a-z0-9_]{2,40}" required /></label><label className="field-label">Tên hiển thị<input value={form.name} onChange={event => update('name', event.target.value)} placeholder="Plus tháng" required /></label></div>
        <div className="field-pair"><label className="field-label">Giá hiển thị (VND)<input type="number" min={0} step={1000} value={form.price_vnd} onChange={event => update('price_vnd', Number(event.target.value))} /></label><label className="field-label">Giá gốc (tùy chọn)<input type="number" min={0} step={1000} value={form.original_price_vnd ?? ''} onChange={event => update('original_price_vnd', event.target.value ? Number(event.target.value) : null)} placeholder="Để trống nếu không gạch giá" /></label></div>
        <div className="field-pair"><label className="field-label">Chu kỳ<select value={form.billing_period} onChange={event => update('billing_period', event.target.value as PlanForm['billing_period'])}>{Object.entries(BILLING_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field-label">Cấp gói<input type="number" min={0} max={9} value={form.tier} onChange={event => update('tier', Number(event.target.value))} /></label></div>
        <label className="field-label">App Store product ID<input value={form.app_store_product_id} onChange={event => update('app_store_product_id', event.target.value)} placeholder="com.nghetruyenhay.plus.monthly" /></label>
        <div className="field-hint">Product ID phải tồn tại trong App Store Connect. Admin không thể tự đổi giá thu của StoreKit.</div>
        <label className="field-label">Mô tả<textarea rows={2} value={form.description} onChange={event => update('description', event.target.value)} /></label>
        <label className="field-label">Quyền lợi hiển thị (mỗi dòng một mục)<textarea rows={4} value={form.featuresText} onChange={event => update('featuresText', event.target.value)} placeholder={'Mở khóa kho truyện Plus\nTải về nghe ngoại tuyến\nKhông quảng cáo'} /></label>
        <div className="entitlement-grid">{ENTITLEMENT_OPTIONS.map(option => <label className="check-card" key={option.key}><input type="checkbox" checked={Boolean(form.entitlements[option.key])} onChange={event => update('entitlements', { ...form.entitlements, [option.key]: event.target.checked })} /><span>{option.label}</span></label>)}</div>
        <div className="field-pair"><label className="field-label">Thứ tự<input type="number" value={form.sort_order} onChange={event => update('sort_order', Number(event.target.value))} /></label><div className="toggle-stack"><label className="check-line"><input type="checkbox" checked={form.is_active} onChange={event => update('is_active', event.target.checked)} /> Đang bán</label><label className="check-line"><input type="checkbox" checked={form.is_featured} onChange={event => update('is_featured', event.target.checked)} /> Gói nổi bật</label></div></div>
      </div>
      <div className="modal-foot"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="button primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Đang lưu</> : <>Lưu gói <span>↗</span></>}</button></div>
    </form>
  </div>
}

function SaleEditor({ form, plans, saving, onChange, onClose, onSubmit }: {
  form: SaleForm
  plans: PlanRecord[]
  saving: boolean
  onChange: (value: SaleForm) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  function update<K extends keyof SaleForm>(key: K, value: SaleForm[K]) { onChange({ ...form, [key]: value }) }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form className="editor-modal compact-modal" onSubmit={onSubmit}>
      <div className="modal-head"><div><div className="eyebrow">{form.id ? 'CẬP NHẬT SALE' : 'SALE MỚI'}</div><h2>{form.id ? 'Sửa đợt giảm giá' : 'Tạo đợt giảm giá'}</h2></div><button type="button" className="icon-button close-button" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      <div className="editor-scroll">
        <label className="field-label">Gói áp dụng<select value={form.plan_id} onChange={event => update('plan_id', event.target.value)} required>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {formatVND(plan.price_vnd)}</option>)}</select></label>
        <label className="field-label">Tên chương trình<input value={form.name} onChange={event => update('name', event.target.value)} placeholder="Ra mắt mùa thu" required /></label>
        <label className="field-label">Giảm giá (%)<input type="number" min={0.01} max={100} step={0.01} value={form.discount_percent} onChange={event => update('discount_percent', Number(event.target.value))} required /></label>
        <div className="field-pair"><label className="field-label">Bắt đầu<input type="datetime-local" value={form.starts_at} onChange={event => update('starts_at', event.target.value)} required /></label><label className="field-label">Kết thúc<input type="datetime-local" value={form.ends_at} onChange={event => update('ends_at', event.target.value)} /></label></div>
        <label className="check-line"><input type="checkbox" checked={form.is_active} onChange={event => update('is_active', event.target.checked)} /> Kích hoạt sale</label>
        <div className="format-note"><AlertCircle size={15} /><span>App Store không tự áp dụng % này. Tạo offer code hoặc điều chỉnh giá trên App Store Connect để khớp với chương trình hiển thị.</span></div>
      </div>
      <div className="modal-foot"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="button primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Đang lưu</> : <>Lưu sale <span>↗</span></>}</button></div>
    </form>
  </div>
}

function VoucherWorkspace({ vouchers, plans, saving, onEdit, onToggle, onDelete, onNotice }: {
  vouchers: VoucherRecord[]
  plans: PlanRecord[]
  saving: boolean
  onEdit: (voucher: VoucherRecord) => void
  onToggle: (voucher: VoucherRecord) => void
  onDelete: (voucher: VoucherRecord) => void
  onNotice: (notice: Notice) => void
}) {
  const [testCode, setTestCode] = useState('')
  const [testPlanID, setTestPlanID] = useState(plans.find(plan => plan.tier > 0)?.id ?? plans[0]?.id ?? '')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<VoucherValidation | null>(null)

  useEffect(() => {
    if (!testPlanID && plans.length > 0) setTestPlanID(plans.find(plan => plan.tier > 0)?.id ?? plans[0].id)
  }, [plans, testPlanID])

  const planNames = useMemo(() => Object.fromEntries(plans.map(plan => [plan.id, plan.name])), [plans])

  async function testVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!testCode.trim() || !testPlanID) { onNotice({ tone: 'error', text: 'Nhập mã và chọn gói để kiểm tra.' }); return }
    setTesting(true); setResult(null); onNotice(null)
    const { data, error } = await supabase.rpc('validate_voucher', {
      p_code: normalizeVoucherCode(testCode), p_plan_id: testPlanID, p_device_id: crypto.randomUUID(),
    })
    if (error) onNotice({ tone: 'error', text: error.message })
    else setResult(data as unknown as VoucherValidation)
    setTesting(false)
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      onNotice({ tone: 'success', text: `Đã copy ${code}.` })
    } catch {
      onNotice({ tone: 'error', text: 'Trình duyệt không cho phép copy tự động. Hãy chọn và copy mã thủ công.' })
    }
  }

  return <div className="voucher-layout">
    <section className="content-card voucher-test-card">
      <div className="commerce-section-head"><div><h2>Kiểm tra mã chính xác</h2><p>Chỉ mã trùng hoàn toàn (sau khi chuẩn hóa hoa/thường và khoảng trắng) mới được tính giảm giá.</p></div><ShieldCheckIcon /></div>
      <form className="voucher-test-form" onSubmit={testVoucher}>
        <label className="field-label">Mã cần kiểm tra<input value={testCode} onChange={event => setTestCode(event.target.value)} placeholder="NTH-XXXX-XXXX-XXXX" /></label>
        <label className="field-label">Áp dụng cho gói<select value={testPlanID} onChange={event => setTestPlanID(event.target.value)}>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <button className="button secondary" disabled={testing}>{testing ? <><span className="button-spinner" /> Đang kiểm tra</> : <><BadgePercent size={15} /> Kiểm tra</>}</button>
      </form>
      {result && (result.valid ? <div className="voucher-result valid"><CheckCircle2 size={18} /><div><strong>Mã hợp lệ · giảm {result.voucher_type === 'percent' ? `${Number(result.discount_percent)}%` : formatVND(result.discount_amount_vnd)}</strong><span>{formatVND(result.base_price_vnd)} → <b>{formatVND(result.final_price_vnd)}</b>{result.app_store_offer_code ? ` · Offer: ${result.app_store_offer_code}` : ' · Chưa nối offer App Store'}</span></div></div> : <div className="voucher-result invalid"><AlertCircle size={18} /><div><strong>Không áp dụng</strong><span>{result.message} ({result.reason_code})</span></div></div>)}
    </section>

    <section className="content-card">
      <div className="commerce-section-head"><div><h2>Voucher đã phát hành</h2><p>{vouchers.length} mã · quản lý thời hạn, lượt dùng và phạm vi gói.</p></div><Ticket size={19} /></div>
      {vouchers.length === 0 ? <div className="table-empty">Chưa có voucher. Tạo mã đầu tiên để chạy chương trình ưu đãi.</div> : <div className="voucher-list">{vouchers.map(voucher => {
        const status = voucherStatus(voucher)
        const scope = voucher.voucher_plans && voucher.voucher_plans.length > 0
          ? voucher.voucher_plans.map(item => planNames[item.plan_id] ?? 'Gói đã xóa').join(', ')
          : 'Tất cả gói'
        return <article className="voucher-card" key={voucher.id}>
          <div className="voucher-code-line"><span className="voucher-code">{voucher.code}</span><button className="icon-button" title="Copy mã" onClick={() => void copyCode(voucher.code)}><Copy size={14} /></button></div>
          <div className="voucher-main"><div><strong>{voucher.name}</strong><span>{voucherTypeLabel(voucher.voucher_type)} · {voucher.voucher_type === 'percent' ? `${Number(voucher.discount_percent)}%` : voucher.voucher_type === 'fixed' ? formatVND(voucher.discount_amount_vnd) : `${voucher.trial_days} ngày`} · {scope}</span></div><span className={`commerce-status ${status.tone}`}><i />{status.label}</span></div>
          <div className="voucher-meta"><span><CalendarClock size={13} /> {formatDate(voucher.starts_at, true)} → {formatDate(voucher.ends_at, true)}</span><span><Users size={13} /> {voucher.used_count}{voucher.usage_limit ? ` / ${voucher.usage_limit}` : ''} lượt</span><span><Percent size={13} /> {voucher.per_device_limit} lượt / thiết bị</span></div>
          {voucher.app_store_offer_code ? <div className="voucher-offer">App Store offer: <b>{voucher.app_store_offer_code}</b></div> : <div className="voucher-offer muted">Chưa nối App Store offer code — chỉ dùng để kiểm tra nội bộ.</div>}
          <div className="plan-actions"><button className="button secondary small" onClick={() => onEdit(voucher)}><Pencil size={13} /> Sửa</button><button className="button secondary small" onClick={() => onToggle(voucher)} disabled={saving}>{voucher.is_active ? 'Tạm dừng' : 'Kích hoạt'}</button><button className="icon-button danger-icon" title="Xóa voucher" onClick={() => onDelete(voucher)} disabled={saving}><Trash2 size={15} /></button></div>
        </article>
      })}</div>}
    </section>
  </div>
}

function ShieldCheckIcon() {
  return <span className="icon-badge"><Check size={16} /></span>
}

function VoucherEditor({ form, plans, saving, onChange, onClose, onSubmit, onGenerate }: {
  form: VoucherForm
  plans: PlanRecord[]
  saving: boolean
  onChange: (value: VoucherForm) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onGenerate: () => void
}) {
  function update<K extends keyof VoucherForm>(key: K, value: VoucherForm[K]) { onChange({ ...form, [key]: value }) }
  function togglePlan(planID: string) {
    const exists = form.planIds.includes(planID)
    update('planIds', exists ? form.planIds.filter(id => id !== planID) : [...form.planIds, planID])
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form className="editor-modal compact-modal voucher-editor" onSubmit={onSubmit}>
      <div className="modal-head"><div><div className="eyebrow">{form.id ? 'CẬP NHẬT VOUCHER' : 'VOUCHER MỚI'}</div><h2>{form.id ? 'Sửa mã ưu đãi' : 'Phát hành mã ưu đãi'}</h2></div><button type="button" className="icon-button close-button" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      <div className="editor-scroll">
        <div className="voucher-code-input"><label className="field-label">Mã voucher<input value={form.code} onChange={event => update('code', normalizeVoucherCode(event.target.value))} placeholder="NTH-XXXX-XXXX-XXXX" required maxLength={40} /></label><button type="button" className="button secondary" onClick={onGenerate} disabled={saving}><Sparkles size={14} /> Sinh mã</button></div>
        <label className="field-label">Tên chương trình<input value={form.name} onChange={event => update('name', event.target.value)} placeholder="Ưu đãi độc giả mùa thu" required /></label>
        <div className="field-pair"><label className="field-label">Loại voucher<select value={form.voucher_type} onChange={event => update('voucher_type', event.target.value as VoucherType)}><option value="percent">Giảm phần trăm</option><option value="fixed">Giảm số tiền</option><option value="trial">Dùng thử</option></select></label>{form.voucher_type === 'percent' ? <label className="field-label">Giảm (%)<input type="number" min={1} max={100} step={0.01} value={form.discount_percent} onChange={event => update('discount_percent', Number(event.target.value))} /></label> : form.voucher_type === 'fixed' ? <label className="field-label">Giảm (VND)<input type="number" min={1} step={1000} value={form.discount_amount_vnd} onChange={event => update('discount_amount_vnd', Number(event.target.value))} /></label> : <label className="field-label">Số ngày dùng thử<input type="number" min={1} max={365} value={form.trial_days} onChange={event => update('trial_days', Number(event.target.value))} /></label>}</div>
        {form.voucher_type === 'percent' && <div className="field-pair"><label className="field-label">Giảm tối đa (VND)<input type="number" min={0} step={1000} value={form.max_discount_vnd ?? ''} onChange={event => update('max_discount_vnd', event.target.value ? Number(event.target.value) : null)} placeholder="Không giới hạn" /></label><label className="field-label">Giá trị đơn tối thiểu<input type="number" min={0} step={1000} value={form.min_order_vnd} onChange={event => update('min_order_vnd', Number(event.target.value))} /></label></div>}
        <div className="field-pair"><label className="field-label">Bắt đầu<input type="datetime-local" value={form.starts_at} onChange={event => update('starts_at', event.target.value)} required /></label><label className="field-label">Kết thúc<input type="datetime-local" value={form.ends_at} onChange={event => update('ends_at', event.target.value)} /></label></div>
        <div className="field-pair"><label className="field-label">Tổng lượt dùng<input type="number" min={1} value={form.usage_limit ?? ''} onChange={event => update('usage_limit', event.target.value ? Number(event.target.value) : null)} placeholder="Không giới hạn" /></label><label className="field-label">Lượt / thiết bị<input type="number" min={1} value={form.per_device_limit} onChange={event => update('per_device_limit', Number(event.target.value))} /></label></div>
        <label className="check-line"><input type="checkbox" checked={form.all_plans} onChange={event => update('all_plans', event.target.checked)} /> Áp dụng cho tất cả gói</label>
        {!form.all_plans && <div className="plan-checks">{plans.map(plan => <label className="check-card" key={plan.id}><input type="checkbox" checked={form.planIds.includes(plan.id)} onChange={() => togglePlan(plan.id)} /><span>{plan.name}</span></label>)}</div>}
        <label className="field-label">App Store offer code (tùy chọn)<input value={form.app_store_offer_code} onChange={event => update('app_store_offer_code', event.target.value.toUpperCase())} placeholder="Mã offer đã tạo trong App Store Connect" /></label>
        <div className="field-hint">Nếu để trống, voucher chỉ dùng để kiểm tra/đối soát nội bộ, không thể giảm giá IAP thật.</div>
        <label className="field-label">Mô tả<textarea rows={2} value={form.description} onChange={event => update('description', event.target.value)} /></label>
        <label className="check-line"><input type="checkbox" checked={form.is_active} onChange={event => update('is_active', event.target.checked)} /> Kích hoạt ngay</label>
      </div>
      <div className="modal-foot"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="button primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Đang lưu</> : <>Lưu voucher <span>↗</span></>}</button></div>
    </form>
  </div>
}

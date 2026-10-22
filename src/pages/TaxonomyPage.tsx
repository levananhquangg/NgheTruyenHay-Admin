import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle, BookOpen, Check, CheckCircle2, Pencil, Plus, RefreshCw, Sparkles,
  Tag, Tags, Trash2, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { slugify } from '../lib/content'
import type { TagKind, TagRecord } from '../lib/content'

type Notice = { tone: 'success' | 'error'; text: string } | null

type TagForm = {
  id?: string
  name: string
  slug: string
  kind: TagKind
  description: string
  color: string
  icon: string
  is_active: boolean
  sort_order: number
}

const emptyForm = (kind: TagKind): TagForm => ({
  name: '', slug: '', kind, description: '', color: kind === 'genre' ? '#B9A7FF' : '#D4AF37',
  icon: '', is_active: true, sort_order: 10,
})

const kindCopy: Record<TagKind, { label: string; hint: string }> = {
  genre: { label: 'Thể loại', hint: 'Dùng cho bộ lọc chính và thể loại hiển thị trên thẻ truyện.' },
  tag: { label: 'Nhãn nội dung', hint: 'Nhãn phụ như Đề cử, Giọng đọc hay, Mọt truyện.' },
  theme: { label: 'Chủ đề', hint: 'Cách nhóm linh hoạt cho bộ sưu tập hoặc chiến dịch.' },
}

export function TaxonomyPage() {
  const [tags, setTags] = useState<TagRecord[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [form, setForm] = useState<TagForm | null>(null)

  async function load(showLoader = true) {
    if (showLoader) setLoading(true)
    const [tagResult, usageResult] = await Promise.all([
      supabase.from('content_tags').select('*').order('kind').order('sort_order', { ascending: true }),
      supabase.from('story_tags').select('tag_id'),
    ])
    const error = tagResult.error ?? usageResult.error
    if (error) setNotice({ tone: 'error', text: error.message })
    else {
      setTags((tagResult.data ?? []) as unknown as TagRecord[])
      const counts: Record<string, number> = {}
      for (const row of (usageResult.data ?? []) as { tag_id: string }[]) counts[row.tag_id] = (counts[row.tag_id] ?? 0) + 1
      setUsage(counts)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const groups = useMemo(() => ({
    genre: tags.filter(tag => tag.kind === 'genre'),
    tag: tags.filter(tag => tag.kind === 'tag'),
    theme: tags.filter(tag => tag.kind === 'theme'),
  }), [tags])

  async function saveTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || !form.name.trim() || !form.slug.trim()) {
      setNotice({ tone: 'error', text: 'Tên và slug không được để trống.' }); return
    }
    setSaving(true); setNotice(null)
    const payload = {
      name: form.name.trim(), slug: slugify(form.slug), kind: form.kind,
      description: form.description.trim(), color: form.color || '#B9FF66',
      icon: form.icon.trim() || null, is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0, updated_at: new Date().toISOString(),
    }
    const result = form.id
      ? await supabase.from('content_tags').update(payload).eq('id', form.id)
      : await supabase.from('content_tags').insert(payload)
    if (result.error) setNotice({ tone: 'error', text: result.error.message })
    else {
      setForm(null)
      setNotice({ tone: 'success', text: form.id ? 'Đã cập nhật nhãn.' : 'Đã thêm nhãn mới.' })
      await load(false)
    }
    setSaving(false)
  }

  async function toggleTag(tag: TagRecord) {
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('content_tags').update({ is_active: !tag.is_active, updated_at: new Date().toISOString() }).eq('id', tag.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: tag.is_active ? 'Đã ẩn nhãn khỏi app.' : 'Đã hiển thị lại nhãn.' }); await load(false) }
    setSaving(false)
  }

  async function deleteTag(tag: TagRecord) {
    const count = usage[tag.id] ?? 0
    if (count > 0 && !window.confirm(`Nhãn “${tag.name}” đang gắn với ${count} truyện. Xóa sẽ gỡ nhãn khỏi các truyện đó. Tiếp tục?`)) return
    if (count === 0 && !window.confirm(`Xóa nhãn “${tag.name}”?`)) return
    setSaving(true); setNotice(null)
    const { error } = await supabase.from('content_tags').delete().eq('id', tag.id)
    if (error) setNotice({ tone: 'error', text: error.message })
    else { setNotice({ tone: 'success', text: 'Đã xóa nhãn.' }); await load(false) }
    setSaving(false)
  }

  return <div className="page-content">
    <section className="page-heading">
      <div><div className="eyebrow"><Sparkles size={13} /> TAXONOMY</div><h1>Thể loại &amp; nhãn</h1><p>Bộ từ vựng dùng để phân loại, gợi ý và làm bộ lọc trong ứng dụng.</p></div>
      <div className="heading-actions">
        <button className="button secondary" onClick={() => void load(false)} disabled={loading || saving}><RefreshCw size={15} /> Làm mới</button>
        <button className="button primary" onClick={() => setForm(emptyForm('genre'))}><Plus size={16} /> Thêm thể loại</button>
      </div>
    </section>

    {notice && <div className={`notice ${notice.tone}`} role="status"><span className="notice-icon">{notice.tone === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}</span><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Đóng thông báo"><X size={16} /></button></div>}

    <section className="taxonomy-summary">
      <div><span className="taxonomy-icon"><Tags size={18} /></span><div><b>{tags.length}</b><span>nhãn đang quản lý</span></div></div>
      <div><span className="taxonomy-icon"><BookOpen size={18} /></span><div><b>{groups.genre.length}</b><span>thể loại</span></div></div>
      <div><span className="taxonomy-icon"><Tag size={18} /></span><div><b>{groups.tag.length + groups.theme.length}</b><span>nhãn phụ &amp; chủ đề</span></div></div>
      <div className="taxonomy-note"><CheckCircle2 size={17} /><span>Nhãn “Mới”, “Hot”, “Full” được bật nhanh ở từng truyện trong Kho truyện, không cần tạo trùng tại đây.</span></div>
    </section>

    {loading ? <div className="table-empty"><div className="loader" /><span>Đang tải bộ phân loại</span></div> : (['genre', 'tag', 'theme'] as TagKind[]).map(kind => (
      <section className="content-card taxonomy-card" key={kind}>
        <div className="commerce-section-head">
          <div><h2>{kindCopy[kind].label}</h2><p>{kindCopy[kind].hint}</p></div>
          <button className="button secondary small" onClick={() => setForm(emptyForm(kind))}><Plus size={14} /> Thêm {kindCopy[kind].label.toLowerCase()}</button>
        </div>
        {groups[kind].length === 0 ? <div className="table-empty">Chưa có mục nào.</div> : <div className="tag-grid">{groups[kind].map(tag => (
          <article className={`tag-card ${tag.is_active ? '' : 'inactive'}`} key={tag.id}>
            <div className="tag-card-top"><span className="tag-color" style={{ background: tag.color }} /><span className="tag-kind">{tag.kind === 'genre' ? 'Thể loại' : tag.kind === 'tag' ? 'Nhãn' : 'Chủ đề'}</span><span className={`commerce-status ${tag.is_active ? 'active' : 'paused'}`}><i />{tag.is_active ? 'Hiển thị' : 'Đang ẩn'}</span></div>
            <h3>{tag.name}</h3>
            <span className="tag-slug">#{tag.slug}</span>
            {tag.description && <p>{tag.description}</p>}
            <div className="tag-card-foot"><span>{usage[tag.id] ?? 0} truyện</span><div className="row-actions"><button className="icon-button" title="Sửa nhãn" onClick={() => setForm({ id: tag.id, name: tag.name, slug: tag.slug, kind: tag.kind, description: tag.description, color: tag.color, icon: tag.icon ?? '', is_active: tag.is_active, sort_order: tag.sort_order })}><Pencil size={14} /></button><button className="button secondary small" onClick={() => void toggleTag(tag)} disabled={saving}>{tag.is_active ? 'Ẩn' : 'Hiện'}</button><button className="icon-button danger-icon" title="Xóa nhãn" onClick={() => void deleteTag(tag)} disabled={saving}><Trash2 size={14} /></button></div></div>
          </article>
        ))}</div>}
      </section>
    ))}

    <footer className="page-footer"><span>NGHE TRUYỆN HAY <i>STUDIO</i></span><span>Thể loại đồng bộ vào bộ lọc và thẻ truyện trên app</span></footer>

    {form && <TagEditor form={form} saving={saving} onChange={setForm} onClose={() => !saving && setForm(null)} onSubmit={saveTag} />}
  </div>
}

function TagEditor({ form, saving, onChange, onClose, onSubmit }: {
  form: TagForm
  saving: boolean
  onChange: (value: TagForm) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  function update<K extends keyof TagForm>(key: K, value: TagForm[K]) {
    if (key === 'name' && !form.id) {
      onChange({ ...form, name: value as string, slug: slugify(value as string) })
      return
    }
    onChange({ ...form, [key]: value })
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <form className="editor-modal compact-modal" onSubmit={onSubmit}>
      <div className="modal-head"><div><div className="eyebrow">{form.id ? 'CẬP NHẬT NHÃN' : 'NHÃN MỚI'}</div><h2>{form.id ? 'Sửa phân loại' : 'Thêm phân loại'}</h2></div><button type="button" className="icon-button close-button" onClick={onClose} disabled={saving}><X size={20} /></button></div>
      <div className="editor-scroll">
        <div className="field-pair"><label className="field-label">Loại<select value={form.kind} onChange={event => update('kind', event.target.value as TagKind)}><option value="genre">Thể loại</option><option value="tag">Nhãn nội dung</option><option value="theme">Chủ đề</option></select></label><label className="field-label">Thứ tự<input type="number" value={form.sort_order} onChange={event => update('sort_order', Number(event.target.value))} /></label></div>
        <label className="field-label">Tên hiển thị<input value={form.name} onChange={event => update('name', event.target.value)} placeholder="Ví dụ: Trinh thám" required maxLength={60} /></label>
        <label className="field-label">Slug<input value={form.slug} onChange={event => update('slug', event.target.value)} onBlur={() => update('slug', slugify(form.slug))} placeholder="trinh-tham" required /></label>
        <label className="field-label">Mô tả<textarea rows={2} value={form.description} onChange={event => update('description', event.target.value)} placeholder="Dùng để gợi ý hoặc mô tả nhóm truyện." /></label>
        <div className="field-pair"><label className="field-label">Màu nhận diện<input type="color" value={form.color} onChange={event => update('color', event.target.value)} className="color-input" /></label><label className="field-label">Biểu tượng SF Symbol (tùy chọn)<input value={form.icon} onChange={event => update('icon', event.target.value)} placeholder="sparkles" /></label></div>
        <label className="check-line"><input type="checkbox" checked={form.is_active} onChange={event => update('is_active', event.target.checked)} /> Hiển thị trong app</label>
      </div>
      <div className="modal-foot"><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="button primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Đang lưu</> : <>Lưu nhãn <span>↗</span></>}</button></div>
    </form>
  </div>
}

import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type Item = {
  id: string
  space_code: string
  file_path: string
  file_url: string
  file_name: string
  file_type: string
  x: number
  y: number
}

export default function Canvas({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [items, setItems] = useState<Record<string, Item>>({})
  const [busy, setBusy] = useState(0)
  const dragging = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    supabase
      .from('items')
      .select('*')
      .eq('space_code', code)
      .then(({ data }) => {
        if (active && data) setItems(Object.fromEntries((data as Item[]).map((i) => [i.id, i])))
      })

    // Delete events can't be filtered server-side, so we filter on the client.
    const channel = supabase
      .channel(`space-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as { id: string }).id
          setItems((prev) => {
            if (!prev[id]) return prev
            const next = { ...prev }
            delete next[id]
            return next
          })
          return
        }
        const it = p.new as Item
        if (it.space_code !== code || dragging.current === it.id) return
        setItems((prev) => ({ ...prev, [it.id]: it }))
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [code])

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const rect = e.currentTarget.getBoundingClientRect()
    const baseX = e.clientX - rect.left
    const baseY = e.clientY - rect.top

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setBusy((b) => b + 1)
      try {
        const id = crypto.randomUUID()
        const safeName = file.name.replace(/[^\w.\-]/g, '_')
        const file_path = `${code}/${id}-${safeName}`
        const { error: upErr } = await supabase.storage
          .from('files')
          .upload(file_path, file, { contentType: file.type || 'application/octet-stream' })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('files').getPublicUrl(file_path)
        const row: Item = {
          id,
          space_code: code,
          file_path,
          file_url: data.publicUrl,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          x: baseX + i * 24,
          y: baseY + i * 24,
        }
        const { error } = await supabase.from('items').insert(row)
        if (error) throw error
        setItems((prev) => ({ ...prev, [id]: row }))
      } catch (err) {
        alert(`Could not add ${file.name}: ${(err as Error).message}`)
      } finally {
        setBusy((b) => b - 1)
      }
    }
  }

  const move = (id: string, x: number, y: number) =>
    setItems((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], x, y } } : prev))

  const commit = (id: string, x: number, y: number) => {
    dragging.current = null
    supabase.from('items').update({ x, y }).eq('id', id).then()
  }

  const remove = async (item: Item) => {
    setItems((prev) => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    await supabase.from('items').delete().eq('id', item.id)
    await supabase.storage.from('files').remove([item.file_path])
  }

  return (
    <div className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {Object.values(items).map((item) => (
        <ItemView
          key={item.id}
          item={item}
          onStart={() => (dragging.current = item.id)}
          onMove={move}
          onCommit={commit}
          onRemove={remove}
        />
      ))}
      <div className="corner">
        <span>Space {code}</span>
        {busy > 0 && <span> · uploading…</span>}
        <button onClick={onLeave}>Leave</button>
      </div>
    </div>
  )
}

function ItemView({
  item,
  onStart,
  onMove,
  onCommit,
  onRemove,
}: {
  item: Item
  onStart: () => void
  onMove: (id: string, x: number, y: number) => void
  onCommit: (id: string, x: number, y: number) => void
  onRemove: (item: Item) => void
}) {
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const last = useRef({ x: item.x, y: item.y })

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { px: e.clientX, py: e.clientY, x: item.x, y: item.y }
    last.current = { x: item.x, y: item.y }
    onStart()
  }
  const movePtr = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s) return
    const x = s.x + e.clientX - s.px
    const y = s.y + e.clientY - s.py
    last.current = { x, y }
    onMove(item.id, x, y)
  }
  const up = () => {
    if (!start.current) return
    start.current = null
    onCommit(item.id, last.current.x, last.current.y)
  }

  return (
    <div className="item" style={{ left: item.x, top: item.y }}>
      <div className="bar" onPointerDown={down} onPointerMove={movePtr} onPointerUp={up}>
        <span className="name" title={item.file_name}>
          {item.file_name}
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(item)}
          title="Remove"
        >
          ×
        </button>
      </div>
      {item.file_type.startsWith('image/') ? (
        <img src={item.file_url} draggable={false} />
      ) : item.file_type.startsWith('video/') ? (
        <video src={item.file_url} controls />
      ) : (
        <a className="file" href={item.file_url} target="_blank" rel="noreferrer">
          Open file
        </a>
      )}
    </div>
  )
}

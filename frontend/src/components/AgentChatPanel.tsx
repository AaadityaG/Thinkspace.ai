import { useEffect, useRef, useState } from 'react'
import {
  createShapeId,
  renderPlaintextFromRichText,
  toRichText,
  type Editor,
  type TLRichText,
  type TLShapeId,
} from 'tldraw'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/services/authApi'

interface Msg {
  role: 'user' | 'agent'
  content: string
}

interface CanvasCommand {
  command: string
  arguments: Record<string, unknown>
}

// label -> tldraw shape id, per page (the agent references shapes by label).
type LabelMap = Map<string, TLShapeId>

function centerOf(editor: Editor, id: TLShapeId) {
  const bounds = editor.getShapePageBounds(id)
  return { x: bounds?.midX ?? 0, y: bounds?.midY ?? 0 }
}

function executeCommands(
  editor: Editor,
  commands: CanvasCommand[],
  labels: LabelMap,
  place: () => { x: number; y: number },
) {
  for (const { command, arguments: a } of commands) {
    const label = typeof a.label === 'string' ? a.label : ''
    const pos = () =>
      typeof a.x === 'number' && typeof a.y === 'number'
        ? { x: a.x, y: a.y }
        : place()

    switch (command) {
      case 'create_node':
      case 'create_note': {
        if (!label && command === 'create_node') break
        const text =
          command === 'create_note'
            ? typeof a.text === 'string'
              ? a.text
              : label
            : label
        if (!text) break
        const { x, y } = pos()
        const id = createShapeId()
        editor.createShape(
          command === 'create_note'
            ? {
                id,
                type: 'note',
                x,
                y,
                props: { richText: toRichText(text) },
              }
            : {
                id,
                type: 'geo',
                x,
                y,
                props: {
                  geo: a.shape === 'ellipse' ? 'ellipse' : 'rectangle',
                  w: typeof a.width === 'number' ? a.width : 180,
                  h: typeof a.height === 'number' ? a.height : 60,
                  richText: toRichText(text),
                },
              },
        )
        if (label) labels.set(label, id)
        editor.select(id)
        break
      }
      case 'create_text': {
        const text = typeof a.text === 'string' ? a.text : ''
        if (!text) break
        const { x, y } = pos()
        editor.createShape({
          type: 'text',
          x,
          y,
          props: { richText: toRichText(text) },
        })
        break
      }
      case 'connect': {
        const fromId = labels.get(String(a.from_label ?? ''))
        const toId = labels.get(String(a.to_label ?? ''))
        if (!fromId || !toId) break
        const arrowId = createShapeId()
        const start = centerOf(editor, fromId)
        editor.run(() => {
          editor.createShape({ id: arrowId, type: 'arrow', x: start.x, y: start.y })
          editor.createBinding({
            fromId: arrowId,
            toId: fromId,
            type: 'arrow',
            props: { terminal: 'start' },
          })
          editor.createBinding({
            fromId: arrowId,
            toId: toId,
            type: 'arrow',
            props: { terminal: 'end' },
          })
          if (typeof a.label === 'string' && a.label)
            editor.updateShape({
              id: arrowId,
              type: 'arrow',
              props: { richText: toRichText(a.label) },
            })
        })
        break
      }
      case 'update_label': {
        const id = labels.get(label)
        const next = String(a.new_label ?? '')
        if (!id || !next) break
        editor.updateShape({ id, type: 'geo', props: { richText: toRichText(next) } })
        labels.delete(label)
        labels.set(next, id)
        break
      }
      case 'move_node': {
        const id = labels.get(label)
        if (!id || typeof a.x !== 'number' || typeof a.y !== 'number') break
        editor.updateShape({ id, type: 'geo', x: a.x, y: a.y })
        break
      }
      case 'delete_nodes': {
        if (!Array.isArray(a.labels)) break
        const ids = a.labels
          .map((l) => labels.get(String(l)))
          .filter((id): id is TLShapeId => Boolean(id))
        if (ids.length) {
          editor.deleteShapes(ids)
          for (const l of a.labels as string[]) labels.delete(l)
        }
        break
      }
    }
  }
}

// Compact canvas description shipped with every chat message so the agent
// can see what's already drawn. Aliases (n1, n2…) are how the agent refers
// back to existing shapes.
function summarizeCanvas(editor: Editor): {
  text: string
  ids: Map<string, TLShapeId>
} | null {
  const shapes = editor.getCurrentPageShapes()
  const lines: string[] = []
  const aliasOf = new Map<TLShapeId, string>()
  const ids = new Map<string, TLShapeId>()
  for (const shape of shapes) {
    if (lines.length >= 60) break
    if (shape.type !== 'geo' && shape.type !== 'note' && shape.type !== 'text')
      continue
    const richText = (shape.props as { richText?: TLRichText }).richText
    const label = richText
      ? renderPlaintextFromRichText(editor, richText)
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80)
      : ''
    const alias = `n${lines.length + 1}`
    aliasOf.set(shape.id, alias)
    ids.set(alias, shape.id)
    if (label) ids.set(label, shape.id)
    const pos = `at (${Math.round(shape.x)},${Math.round(shape.y)})`
    lines.push(
      `${alias} ${shape.type}${label ? ` "${label}"` : ''} ${pos}`,
    )
  }
  if (!lines.length) return null

  const edges: string[] = []
  for (const shape of shapes) {
    if (shape.type !== 'arrow') continue
    const bindings = editor.getBindingsFromShape(shape.id, 'arrow')
    const from = bindings.find((b) => b.props.terminal === 'start')?.toId
    const to = bindings.find((b) => b.props.terminal === 'end')?.toId
    const fa = from ? aliasOf.get(from) : undefined
    const ta = to ? aliasOf.get(to) : undefined
    if (fa && ta) edges.push(`${fa}->${ta}`)
  }

  const text =
    `[CANVAS STATE]\n` +
    lines.join('\n') +
    (edges.length ? `\nedges: ${edges.join(', ')}` : '')
  return { text, ids }
}

// Reads the backend's NDJSON stream, executing each canvas command the
// instant it arrives so shapes appear live while the agent is still working.
async function* ndjsonEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ type: string; command?: string; arguments?: Record<string, unknown>; response?: string }> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line)
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer)
}

const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-pro-latest',
]
const MODEL_KEY = 'thinkspace-model'

export function AgentChatPanel({
  activeId,
  editorRef,
}: {
  activeId: string | null
  editorRef: React.RefObject<Editor | null>
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(true)
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS)
  const [model, setModel] = useState(
    () => localStorage.getItem(MODEL_KEY) || '',
  )

  useEffect(() => {
    fetch('/api/agents/models', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.models && setModels(d.models))
      .catch(() => {})
  }, [])

  // Thread + label map per workspace, so switching canvases keeps context.
  const threadsRef = useRef(new Map<string, Msg[]>())
  const labelsRef = useRef(new Map<string, LabelMap>())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const thread = (activeId ? threadsRef.current.get(activeId) : null) ?? []
  const setThread = (msgs: Msg[]) => {
    if (activeId) threadsRef.current.set(activeId, msgs)
  }

  // Reset auto-placement grid when switching workspaces.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [activeId])

  const stop = () => abortRef.current?.abort()

  const send = async () => {
    const message = input.trim()
    if (!message || !activeId || isLoading) return
    setInput('')
    setIsLoading(true)
    setProgress(null)
    let msgs = [...thread, { role: 'user' as const, content: message }]
    setThread(msgs)
    let reply = ''
    try {
      // Give the agent eyes: summarize the canvas and seed the executor's
      // alias map so its commands can reference existing shapes.
      let canvas: string | undefined
      const editor = editorRef.current
      if (editor) {
        const summary = summarizeCanvas(editor)
        if (summary) {
          canvas = summary.text
          let labels = labelsRef.current.get(activeId) ?? new Map()
          for (const [alias, id] of summary.ids) labels.set(alias, id)
          labelsRef.current.set(activeId, labels)
        }
      }

      const controller = new AbortController()
      abortRef.current = controller
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page_id: activeId, canvas, model }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`)

      const labels = editor ? labelsRef.current.get(activeId) : undefined
      // Anchor auto-placement to where the user is looking right now.
      const vp = editor?.getViewportPageBounds()
      const p = { col: 0, row: 0 }
      const place = () => ({
        x: (vp?.x ?? 0) + 80 + p.col * 240,
        y: (vp?.y ?? 0) + 80 + p.row * 160,
      })

      let drew = 0
      for await (const ev of ndjsonEvents(res.body)) {
        if (ev.type === 'cmd' && editor && labels) {
          executeCommands(
            editor,
            [{ command: ev.command!, arguments: ev.arguments ?? {} }],
            labels,
            place,
          )
          setProgress(`Drawing… ${++drew}`)
        } else if (ev.type === 'text') {
          reply = ev.response ?? ''
        }
      }
      if (editor) {
        editor.selectNone()
        // Bring the new shapes into view if they landed outside it.
        if (drew > 0) editor.zoomToFit({ animation: { duration: 400 } })
      }
      msgs = [...msgs, { role: 'agent', content: reply }]
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        msgs = [
          ...msgs,
          { role: 'agent', content: reply ? `${reply}\n(stopped)` : 'Stopped.' },
        ]
      } else {
        msgs = [
          ...msgs,
          { role: 'agent', content: `Error: ${errorMessage(err)}` },
        ]
      }
    }
    abortRef.current = null
    setThread(msgs)
    setIsLoading(false)
    setProgress(null)
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }),
    )
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        className="h-auto shrink-0 writing-mode-vertical"
        onClick={() => setOpen(true)}
      >
        Agent chat
      </Button>
    )
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Partner</span>
        <div className="flex items-center gap-1">
          <select
            aria-label="Model"
            value={model}
            onChange={(e) => {
              setModel(e.target.value)
              localStorage.setItem(MODEL_KEY, e.target.value)
            }}
            className="max-w-36 bg-transparent text-xs text-muted-foreground outline-none"
          >
            <option value="">Server default</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m.replace(/^gemini-/, '')}
              </option>
            ))}
          </select>
          <Button
            aria-label="Close agent chat"
            size="sm"
            variant="ghost"
            className="size-7 p-0"
            onClick={() => setOpen(false)}
          >
            ×
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {thread.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ask your partner to plan something — e.g. “Map out an auth flow”.
          </p>
        )}
        {thread.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'ml-6 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                : 'mr-6 rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap'
            }
          >
            {m.content}
          </div>
        ))}
        {isLoading && (
          <div className="mr-6 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {progress ?? 'Thinking…'}
          </div>
        )}
      </div>

      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your partner…"
          disabled={!activeId || isLoading}
        />
        {isLoading ? (
          <Button type="button" size="sm" variant="destructive" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim()}>
            Send
          </Button>
        )}
      </form>
    </aside>
  )
}

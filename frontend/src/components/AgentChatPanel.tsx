import { useEffect, useRef, useState } from 'react'
import {
  createShapeId,
  renderPlaintextFromRichText,
  toRichText,
  type Editor,
  type TLGeoShape,
  type TLNoteShape,
  type TLRichText,
  type TLShapeId,
  type TLTextShape,
} from 'tldraw'
import dagre from 'dagre'
import { Bot, MessageSquare, Send, Square, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/services/authApi'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Thinking">
      {[0, 150, 300].map((delay, i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

const VALID_STYLES = {
  color: [
    'black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue',
    'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white',
  ],
  fill: ['none', 'solid', 'semi'],
  font: ['draw', 'sans', 'serif', 'mono'],
  dash: ['draw', 'solid', 'dashed', 'dotted'],
  size: ['s', 'm', 'l', 'xl'],
} as const

// Curated style props the agent may attach to a shape. Unknown or invalid
// values are dropped so a sloppy model call can't corrupt the canvas.
function styleOf(a: Record<string, unknown>): Partial<TLGeoShape['props']> {
  const out = {} as Partial<TLGeoShape['props']>
  for (const key of Object.keys(VALID_STYLES) as (keyof typeof VALID_STYLES)[]) {
    const v = a[key]
    if (
      typeof v === 'string' &&
      (VALID_STYLES[key] as readonly string[]).includes(v)
    ) {
      ;(out as Record<string, string>)[key] = v
    }
  }
  return out
}

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

function createArrow(
  editor: Editor,
  fromId: TLShapeId,
  toId: TLShapeId,
  label?: string,
) {
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
      toId,
      type: 'arrow',
      props: { terminal: 'end' },
    })
    if (label)
      editor.updateShape({
        id: arrowId,
        type: 'arrow',
        props: { richText: toRichText(label) },
      })
  })
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
        const style = styleOf(a)
        editor.createShape(
          command === 'create_note'
            ? {
                id,
                type: 'note',
                x,
                y,
                props: {
                  richText: toRichText(text),
                  ...(style.color ? { color: style.color } : {}),
                } as TLNoteShape['props'],
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
                  ...style,
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
        const style = styleOf(a)
        editor.createShape({
          type: 'text',
          x,
          y,
          props: {
            richText: toRichText(text),
            color: style.color,
            font: style.font,
            size: style.size,
          } as TLTextShape['props'],
        })
        break
      }
      case 'connect': {
        const fromId = labels.get(String(a.from_label ?? ''))
        const toId = labels.get(String(a.to_label ?? ''))
        if (!fromId || !toId) break
        createArrow(editor, fromId, toId, typeof a.label === 'string' ? a.label : undefined)
        break
      }
      case 'update_label': {
        const id = labels.get(label)
        const next = String(a.new_label ?? '')
        if (!id || !next) break
        const shape = editor.getShape(id)
        if (!shape) break
        if (shape.type === 'geo' || shape.type === 'note' || shape.type === 'text') {
          editor.updateShape({
            id,
            type: shape.type,
            props: { richText: toRichText(next) },
          })
          labels.delete(label)
          labels.set(next, id)
        }
        break
      }
      case 'move_node': {
        const id = labels.get(label)
        if (!id || typeof a.x !== 'number' || typeof a.y !== 'number') break
        const shape = editor.getShape(id)
        if (!shape) break
        editor.updateShape({ id, type: shape.type, x: a.x, y: a.y })
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

// The agent emits structure (labels + edges), never positions. This runs
// dagre's layered layout so diagrams come out clean instead of a coordinate
// mess, then creates shapes staggered for the live-drawing feel.
async function drawStructured(
  editor: Editor,
  commands: CanvasCommand[],
  labels: LabelMap,
) {
  const nodeCmds = commands.filter(
    ({ command }) =>
      command === 'create_node' || command === 'create_note',
  )
  const edgeCmds = commands.filter(({ command }) => command === 'connect')
  if (!nodeCmds.length && !edgeCmds.length) return

  // Unique node refs in emission order.
  const refs: string[] = []
  const refKind = new Map<string, 'geo' | 'note'>()
  const refStyle = new Map<string, Partial<TLGeoShape['props']>>()
  const pushRef = (label: string, kind: 'geo' | 'note', style = {}) => {
    // Existing-canvas refs join the layout graph but are never re-created
    // (guarded at creation time via labels.has).
    if (!label || refs.includes(label)) return
    refs.push(label)
    refKind.set(label, kind)
    refStyle.set(label, style)
  }
  for (const { command, arguments: a } of nodeCmds) {
    const label =
      command === 'create_note'
        ? String(a.text ?? a.label ?? '')
        : String(a.label ?? '')
    pushRef(label, command === 'create_note' ? 'note' : 'geo', styleOf(a))
  }
  for (const { arguments: a } of edgeCmds) {
    pushRef(String(a.from_label ?? ''), 'geo')
    pushRef(String(a.to_label ?? ''), 'geo')
  }
  if (!refs.length) return

  const size = (ref: string) => {
    const w = Math.min(240, Math.max(140, ref.length * 9 + 50))
    return { width: w, height: refKind.get(ref) === 'note' ? 140 : 60 }
  }

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 110 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const ref of refs) g.setNode(ref, size(ref))
  for (const { arguments: a } of edgeCmds) {
    const from = String(a.from_label ?? '')
    const to = String(a.to_label ?? '')
    if (refs.includes(from) && refs.includes(to)) g.setEdge(from, to)
  }
  dagre.layout(g)

  const anchor = editor.getViewportPageBounds()
  const topLeft = new Map<string, { x: number; y: number }>()
  for (const ref of refs) {
    const n = g.node(ref)
    topLeft.set(ref, {
      x: anchor.x + 80 + (n.x - n.width / 2),
      y: anchor.y + 80 + (n.y - n.height / 2),
    })
  }

  // Staggered creation at final positions — keeps the live feel.
  for (const ref of refs) {
    if (labels.has(ref)) continue
    const id = createShapeId()
    const pos = topLeft.get(ref)!
    const style = refStyle.get(ref) ?? {}
    if (refKind.get(ref) === 'note') {
      editor.createShape({
        id,
        type: 'note',
        x: pos.x,
        y: pos.y,
        props: {
          richText: toRichText(ref),
          ...(style.color ? { color: style.color } : {}),
        } as TLNoteShape['props'],
      })
    } else {
      editor.createShape({
        id,
        type: 'geo',
        x: pos.x,
        y: pos.y,
        props: {
          geo: 'rectangle',
          w: size(ref).width,
          h: 60,
          richText: toRichText(ref),
          ...style,
        },
      })
    }
    labels.set(ref, id)
    await sleep(70)
  }
  await sleep(100)
  for (const { arguments: a } of edgeCmds) {
    const fromId = labels.get(String(a.from_label ?? ''))
    const toId = labels.get(String(a.to_label ?? ''))
    if (fromId && toId) createArrow(editor, fromId, toId)
    await sleep(60)
  }
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
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line)
        // Some models stringify the arguments object — normalize.
        if (typeof ev.arguments === 'string') {
          try {
            ev.arguments = JSON.parse(ev.arguments)
          } catch {
            ev.arguments = {}
          }
        }
        yield ev
      } catch {
        // Skip malformed lines instead of killing the whole stream.
      }
    }
  }
  if (buffer.trim()) {
    try {
      const ev = JSON.parse(buffer)
      if (typeof ev.arguments === 'string') {
        try {
          ev.arguments = JSON.parse(ev.arguments)
        } catch {
          ev.arguments = {}
        }
      }
      yield ev
    } catch {
      // Ignore trailing garbage.
    }
  }
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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

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
      // alias map so its commands can reference existing shapes. The map
      // exists even for an EMPTY canvas — otherwise build commands would
      // have nowhere to register new shape ids.
      let canvas: string | undefined
      const editor = editorRef.current
      const labels = editor
        ? (labelsRef.current.get(activeId) ?? new Map())
        : undefined
      if (editor && labels) labelsRef.current.set(activeId, labels)
      if (editor && labels) {
        const summary = summarizeCanvas(editor)
        if (summary) {
          canvas = summary.text
          for (const [alias, id] of summary.ids) labels.set(alias, id)
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

      // Anchor auto-placement to where the user is looking right now.
      const vp = editor?.getViewportPageBounds()
      const p = { col: 0, row: 0 }
      const place = () => ({
        x: (vp?.x ?? 0) + 80 + p.col * 240,
        y: (vp?.y ?? 0) + 80 + p.row * 160,
      })

      let drew = 0
      // Creates + connects are buffered and laid out as one graph at the end
      // (dagre needs the full structure). Everything else runs immediately.
      const structured: CanvasCommand[] = []
      for await (const ev of ndjsonEvents(res.body)) {
        if (ev.type === 'cmd' && editor && labels) {
          const cmd: CanvasCommand = {
            command: ev.command!,
            arguments: ev.arguments ?? {},
          }
          if (
            cmd.command === 'create_node' ||
            cmd.command === 'create_note' ||
            cmd.command === 'connect'
          ) {
            structured.push(cmd)
          } else {
            executeCommands(editor, [cmd], labels, place)
          }
          setProgress(`Designing… ${++drew}`)
        } else if (ev.type === 'text') {
          reply = ev.response ?? ''
        }
      }
      if (editor && labels) {
        if (structured.length) {
          setProgress('Drawing…')
          await drawStructured(editor, structured, labels)
        }
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
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
      textareaRef.current?.focus()
    })
  }

  return (
    <aside
      aria-label="Agent chat"
      className={`relative h-full shrink-0 overflow-hidden rounded-lg border transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        open ? 'w-80' : 'w-10'
      }`}
    >
      {open ? (
        <div className="flex h-full w-80 flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Bot className="text-muted-foreground size-4" />
              <span className="text-sm font-medium">Partner</span>
            </div>
            <div className="flex items-center gap-1">
              <select
                aria-label="Model"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  localStorage.setItem(MODEL_KEY, e.target.value)
                }}
                className="text-muted-foreground max-w-32 truncate bg-transparent text-xs outline-none"
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
                size="icon-sm"
                variant="ghost"
                className="size-6"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
          >
            {thread.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <Bot className="text-muted-foreground/60 size-8" />
                <p className="text-xs text-muted-foreground">
                  Ask your partner to plan something — e.g. “Map out an auth
                  flow”.
                </p>
              </div>
            )}
            {thread.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-6 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'mr-6 rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div className="mr-6 flex min-h-8 w-fit min-w-14 items-center rounded-lg bg-muted px-3 py-2">
                {progress ? (
                  <span className="text-xs text-muted-foreground">
                    {progress}
                  </span>
                ) : (
                  <TypingDots />
                )}
              </div>
            )}
          </div>

          <form
            className="border-t p-2"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Message"
              placeholder="Ask your partner…"
              disabled={!activeId || isLoading}
              className="max-h-40 min-h-9"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[10px]">
                Enter to send · Shift+Enter for a new line
              </span>
              {isLoading ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={stop}
                >
                  <Square /> Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || !activeId}
                >
                  <Send /> Send
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Open agent chat"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="text-muted-foreground flex h-full w-10 flex-col items-center justify-center gap-2 rounded-lg outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MessageSquare className="size-4" />
          <span className="text-xs font-medium [writing-mode:vertical-rl]">
            Partner
          </span>
        </button>
      )}
    </aside>
  )
}

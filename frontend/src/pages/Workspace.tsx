import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { Editor, Tldraw, useEditor } from 'tldraw'
import 'tldraw/tldraw.css'

import { AppShell } from '@/components/AppShell'
import { useTheme } from '@/components/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/services/authApi'
import {
  useCreatePageMutation,
  useDeletePageMutation,
  useGetPageQuery,
  useGetPagesQuery,
  useRenamePageMutation,
  useSaveSnapshotMutation,
  type PageSummary,
} from '@/services/pagesApi'

type Snapshot = Parameters<Editor['loadSnapshot']>[0]

// Keeps the canvas in sync with the app-wide theme toggle.
function ThemeSync() {
  const { theme } = useTheme()
  const editor = useEditor()
  useEffect(() => {
    editor.user.updateUserPreferences({ colorScheme: theme })
  }, [theme, editor])
  return null
}

function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

export default function Workspace() {
  const { data: pagesData } = useGetPagesQuery()
  const [createPage] = useCreatePageMutation()
  const [deletePage] = useDeletePageMutation()
  const [renamePage] = useRenamePageMutation()
  const [saveSnapshot] = useSaveSnapshotMutation()

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [activeId, setActiveId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const pages: PageSummary[] = pagesData?.pages ?? []
  const activePage = pages.find((p) => p.id === activeId)

  // Auto-select most recent page.
  useEffect(() => {
    if (!activeId && pages.length > 0) setActiveId(pages[0].id)
  }, [pages, activeId])

  // First visit: create an initial page automatically.
  useEffect(() => {
    if (pagesData && pages.length === 0 && activeId === null) {
      createPage({})
        .unwrap()
        .then((res) => setActiveId(res.page.id))
        .catch(() => {})
    }
  }, [pagesData, pages.length, activeId, createPage])

  const { data: detail } = useGetPageQuery(activeId ?? '', { skip: !activeId })

  const editorRef = useRef<Editor | null>(null)
  // Pristine snapshot captured at mount — used to reset the editor when the
  // active page has never been drawn on (snapshot: null).
  const emptySnapRef = useRef<Snapshot | null>(null)
  // Session source of truth for each open page's latest content. The RTK
  // detail cache goes stale after autosaves (we skip invalidating it while
  // editing), so switching pages must read from here, not the cache.
  const snapCacheRef = useRef(new Map<string, Snapshot>())
  const loadedJsonRef = useRef('')
  const detailRef = useRef(detail)
  detailRef.current = detail
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const saveFnRef = useRef(saveSnapshot)
  saveFnRef.current = saveSnapshot
  const saveTimerRef = useRef<number | undefined>(undefined)

  const flushSave = useCallback(() => {
    if (!saveTimerRef.current) return
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = undefined
    const editor = editorRef.current
    const id = activeIdRef.current
    if (!editor || !id) return
    const snap = editor.getSnapshot() as unknown as Record<string, unknown>
    const json = JSON.stringify(snap)
    // Loading a page also fires the store listener — skip no-op saves so
    // merely opening a page doesn't bump updated_at or add versions.
    if (json === loadedJsonRef.current) return
    snapCacheRef.current.set(id, snap as Snapshot)
    loadedJsonRef.current = json
    saveFnRef.current({ id, snapshot: snap }).unwrap().catch(() => {})
  }, [])

  const tryLoadSnapshot = useCallback(() => {
    const editor = editorRef.current
    const id = activeIdRef.current
    if (!editor || !id) return

    let snap = snapCacheRef.current.get(id)
    if (snap === undefined) {
      // Not seen this session — seed from the server response for THIS page.
      const page = detailRef.current?.page
      if (!page || page.id !== id) return
      const seeded = (page.snapshot ?? emptySnapRef.current) as Snapshot | null
      if (!seeded) return
      snap = seeded
      snapCacheRef.current.set(id, seeded)
    }

    const json = JSON.stringify(snap)
    if (json === loadedJsonRef.current) return
    loadedJsonRef.current = json
    editor.loadSnapshot(snap as Snapshot)
  }, [])

  useEffect(() => {
    tryLoadSnapshot()
  }, [detail, activeId, tryLoadSnapshot])

  useEffect(() => {
    return () => window.clearTimeout(saveTimerRef.current)
  }, [])

  const handleDeletePage = async (id: string) => {
    if (!window.confirm('Delete this page and its history?')) return
    flushSave()
    snapCacheRef.current.delete(id)
    await deletePage(id).unwrap().catch((err) => errorMessage(err))
    if (activeIdRef.current === id) {
      const remaining = pages.filter((p) => p.id !== id)
      setActiveId(remaining[0]?.id ?? null)
      loadedJsonRef.current = ''
    }
  }

  const handleSelectPage = (id: string) => {
    if (id === activeIdRef.current) return
    flushSave()
    loadedJsonRef.current = ''
    setActiveId(id)
  }

  const startRename = (page: PageSummary) => {
    setRenamingId(page.id)
    setRenameValue(page.name)
  }

  const commitRename = async () => {
    const id = renamingId
    const name = renameValue.trim()
    setRenamingId(null)
    if (!id || !name || name === pages.find((p) => p.id === id)?.name) return
    await renamePage({ id, name }).unwrap().catch((err) => errorMessage(err))
  }

  const headerActions = (
    <>
      <span className="text-sm font-medium">
        {activePage?.name ?? ''}
      </span>
      <span className="text-muted-foreground text-xs">
        {saveState === 'saving'
          ? 'Saving…'
          : saveState === 'saved'
            ? 'Saved'
            : ''}
      </span>
    </>
  )

  return (
    <AppShell actions={headerActions}>
      <div className="flex h-[calc(100svh-6.5rem)] min-h-0 flex-1 gap-4">
        <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border">
          <Tldraw
            onMount={(editor) => {
              editorRef.current = editor
              emptySnapRef.current = editor.getSnapshot()
              editor.store.listen(
                () => {
                  setSaveState('saving')
                  window.clearTimeout(saveTimerRef.current)
                  saveTimerRef.current = window.setTimeout(() => {
                    saveTimerRef.current = undefined
                    const id = activeIdRef.current
                    if (!id) return
                    const snap = editor.getSnapshot() as unknown as Record<
                      string,
                      unknown
                    >
                    const json = JSON.stringify(snap)
                    // Skip no-op saves (e.g. ones triggered by loadSnapshot).
                    if (json === loadedJsonRef.current) {
                      setSaveState('idle')
                      return
                    }
                    snapCacheRef.current.set(id, snap as Snapshot)
                    loadedJsonRef.current = json
                    saveFnRef
                      .current({ id, snapshot: snap })
                      .unwrap()
                      .then(() => setSaveState('saved'))
                      .catch(() => setSaveState('idle'))
                  }, 1500)
                },
                { scope: 'document' },
              )
              tryLoadSnapshot()
            }}
          >
            <ThemeSync />
          </Tldraw>
        </section>

      {/* Pages panel */}
      <aside className="flex w-64 shrink-0 flex-col rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Workspaces</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              createPage({})
                .unwrap()
                .then((res) => handleSelectPage(res.page.id))
                .catch((err) => errorMessage(err))
            }
          >
            <Plus /> New
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {pages.map((page) => (
            <div
              key={page.id}
              className={`group flex items-center gap-1 px-2 py-1.5 ${
                page.id === activeId ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
            >
              {renamingId === page.id ? (
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  className="h-7 text-sm"
                />
              ) : (
                <>
                  <button
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    title="Click to open · double-click to rename"
                    onClick={() => handleSelectPage(page.id)}
                    onDoubleClick={() => startRename(page)}
                  >
                    <span className="block truncate text-sm">{page.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatWhen(page.updated_at)}
                    </span>
                  </button>
                  <Button
                    aria-label={`Rename ${page.name}`}

                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => startRename(page)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    aria-label={`Delete ${page.name}`}
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeletePage(page.id)}
                  >
                    <X />
                  </Button>
                </>
              )}
            </div>
          ))}
          {pages.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No workspaces yet
            </p>
          )}
        </div>
      </aside>
      </div>
    </AppShell>
  )
}

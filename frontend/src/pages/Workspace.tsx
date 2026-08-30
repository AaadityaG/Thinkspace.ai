import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Editor, Tldraw, useEditor } from 'tldraw'
import 'tldraw/tldraw.css'

import { AppShell } from '@/components/AppShell'
import { AgentChatPanel } from '@/components/AgentChatPanel'
import { useTheme } from '@/components/ThemeProvider'
import {
  useCreatePageMutation,
  useGetPageQuery,
  useGetPagesQuery,
  useSaveSnapshotMutation,
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

export default function Workspace() {
  const { data: pagesData } = useGetPagesQuery()
  const [createPage] = useCreatePageMutation()
  const [saveSnapshot] = useSaveSnapshotMutation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeId = searchParams.get('id')

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )

  const pages = pagesData?.pages ?? []
  const activePage = pages.find((p) => p.id === activeId)
  const firstId = pages[0]?.id
  const hasActive = activeId ? pages.some((p) => p.id === activeId) : false

  // Auto-select most recent page.
  useEffect(() => {
    if (!activeId && firstId)
      setSearchParams({ id: firstId }, { replace: true })
  }, [firstId, activeId, setSearchParams])

  // First visit: create an initial page automatically.
  useEffect(() => {
    if (pagesData && !hasActive && pages.length === 0 && !activeId) {
      createPage({})
        .unwrap()
        .then((res) => setSearchParams({ id: res.page.id }, { replace: true }))
        .catch(() => {})
    }
  }, [pagesData, hasActive, pages.length, activeId, createPage, setSearchParams])

  // Active page was deleted elsewhere (or bad id) — fall back to first.
  useEffect(() => {
    if (activeId && firstId && !hasActive)
      setSearchParams({ id: firstId }, { replace: true })
  }, [hasActive, firstId, activeId, setSearchParams])

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

  // Save the previous page before switching (switches now come from the
  // sidebar, outside this component's control).
  const prevIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevIdRef.current
    prevIdRef.current = activeId
    if (!prev || prev === activeId || !prev) return

    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = undefined
    const editor = editorRef.current
    if (!editor) return
    const snap = editor.getSnapshot() as unknown as Record<string, unknown>
    const json = JSON.stringify(snap)
    if (json !== loadedJsonRef.current) {
      snapCacheRef.current.set(prev, snap as Snapshot)
      saveSnapshot({ id: prev, snapshot: snap }).unwrap().catch(() => {})
    }
    loadedJsonRef.current = ''
  }, [activeId, saveSnapshot])

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

  const headerActions = (
    <>
      <span className="text-sm font-medium">{activePage?.name ?? ''}</span>
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
    <AppShell actions={headerActions} dense>
      <div className="flex h-[calc(100svh-4.5rem)] min-h-0 w-full gap-2">
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
        {pages.length > 0 && (
          <AgentChatPanel activeId={activeId} editorRef={editorRef} />
        )}
      </div>
    </AppShell>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  PenTool,
  Plus,
  Sun,
  X,
} from 'lucide-react'

import { api } from '@/services/api'
import {
  errorMessage,
  useGetMeQuery,
  useLogoutMutation,
  useSetPasswordMutation,
} from '@/services/authApi'
import {
  useCreatePageMutation,
  useDeletePageMutation,
  useGetPagesQuery,
  useRenamePageMutation,
} from '@/services/pagesApi'
import { useTheme } from '@/components/ThemeProvider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const navMain = [
  { title: 'Workspace', icon: PenTool, to: '/workspace' },
  { title: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label="Toggle theme"
          tooltip="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [setPassword, { isLoading }] = useSetPasswordMutation()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    try {
      await setPassword({ password: value }).unwrap()
      setValue('')
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex flex-col gap-2 px-2 pt-1 pb-2"
    >
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Password saved
        </p>
      )}
      <Input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={hasPassword ? 'New password (min 8 chars)' : 'Set a password (min 8 chars)'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-xs"
      />
      <Button type="submit" size="sm" disabled={isLoading}>
        {isLoading ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}

function UserFooter() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { data } = useGetMeQuery()
  const [logout] = useLogoutMutation()
  const user = data?.user

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')

  const handleLogout = async () => {
    await logout().unwrap().catch((err) => errorMessage(err))
    dispatch(api.util.resetApiState())
    navigate('/login')
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user.name}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8">
                {user.picture && (
                  <AvatarImage src={user.picture} alt={user.name} />
                )}
                <AvatarFallback>{initials || '?'}</AvatarFallback>
              </Avatar>
              <span
                className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden"
              >
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={4}
            className="z-[9999] w-(--radix-dropdown-menu-trigger-width) min-w-56"
          >
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ChangePasswordForm hasPassword={user.has_password} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function WorkspacesSection() {
  const { data } = useGetPagesQuery()
  const [createPage] = useCreatePageMutation()
  const [renamePage] = useRenamePageMutation()
  const [deletePage] = useDeletePageMutation()
  const [params, setParams] = useSearchParams()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const pages = data?.pages ?? []
  const activeId = params.get('id')
  const select = (id: string) => setParams({ id })

  const commitRename = async () => {
    const id = renamingId
    const name = renameValue.trim()
    setRenamingId(null)
    if (!id || !name || name === pages.find((p) => p.id === id)?.name) return
    await renamePage({ id, name }).unwrap().catch((err) => errorMessage(err))
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this workspace?')) return
    await deletePage(id).unwrap().catch((err) => errorMessage(err))
    if (activeId === id) {
      const remaining = pages.filter((p) => p.id !== id)
      if (remaining[0]) select(remaining[0].id)
    }
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="items-center justify-between">
        Workspaces
        <button
          aria-label="New workspace"
          className="hover:bg-sidebar-accent rounded p-0.5"
          onClick={() =>
            createPage({})
              .unwrap()
              .then((res) => select(res.page.id))
              .catch((err) => errorMessage(err))
          }
        >
          <Plus className="size-4" />
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {pages.map((page) => (
            <SidebarMenuItem key={page.id} className="group/ws relative">
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
                  <SidebarMenuButton asChild isActive={page.id === activeId} tooltip={page.name}>
                    <NavLink to={`/workspace?id=${page.id}`}>
                      <PenTool />
                      <span className="truncate">{page.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  <div className="absolute top-1/2 right-1 hidden -translate-y-1/2 gap-0.5 group-hover/ws:flex">
                    <button
                      aria-label={`Rename ${page.name}`}
                      className="hover:bg-sidebar-accent rounded p-1"
                      onClick={() => {
                        setRenamingId(page.id)
                        setRenameValue(page.name)
                      }}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      aria-label={`Delete ${page.name}`}
                      className="text-destructive hover:bg-sidebar-accent rounded p-1"
                      onClick={() => handleDelete(page.id)}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </>
              )}
            </SidebarMenuItem>
          ))}
          {pages.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">None yet</li>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  T
                </span>
                <span className="font-semibold group-data-[collapsible=icon]:hidden">
                  Thinkspace.ai
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink to={item.to}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} tooltip={item.title}>
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <WorkspacesSection />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <UserFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppShell({
  children,
  actions,
}: {
  children: ReactNode
  actions?: ReactNode
}) {
  const { pathname } = useLocation()
  const title =
    navMain.find((item) => pathname.startsWith(item.to))?.title ?? 'Dashboard'
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1 h-4!" />
            <span className="text-sm font-medium">{title}</span>
            {actions && (
              <div className="ml-auto flex items-center gap-2">{actions}</div>
            )}
          </header>
          <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

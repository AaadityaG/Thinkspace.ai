import { Link } from 'react-router-dom'
import { LayoutDashboard, PenTool, Search, Workflow } from 'lucide-react'
import { ShaderBackground } from '@/components/ui/hero-shader'
import { ShaderBackground as RedBlackShader } from '@/components/ui/red-black-vanila'
import { Button } from '@/components/ui/button'
import { useGetMeQuery } from '@/services/authApi'

const proof = [
  {
    icon: Workflow,
    title: 'Infinite canvas',
    body: 'Sketch, map, and diagram on an endless board that autosaves as you work.',
  },
  {
    icon: PenTool,
    title: 'Agents beside you',
    body: 'Your partner reads the canvas and draws on it alongside you — never a locked image.',
  },
  {
    icon: Search,
    title: 'Research in place',
    body: 'Grounded answers with sources, pinned straight onto the board for later.',
  },
]

export default function Landing() {
  const { data } = useGetMeQuery()
  const loggedIn = Boolean(data?.user)

  return (
    <ShaderBackground className="min-h-svh bg-[#0a0914] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-80">
        <RedBlackShader className="h-full w-full" />
      </div>
      <header className="relative z-10 flex items-center justify-between p-6 sm:px-10">
        <a href="/" className="flex items-center gap-2" aria-label="Thinkspace home">
          <span className="flex size-7 items-center justify-center rounded-lg bg-violet-500/20 text-indigo-200 ring-1 ring-inset ring-white/15">
            <span className="text-sm font-black leading-none">T</span>
          </span>
          <span className="text-xl font-semibold tracking-tight">Thinkspace.ai</span>
        </a>

       

        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Button asChild className="rounded-full bg-white text-black text-xs hover:bg-white/90">
              <Link to="/dashboard">
                <LayoutDashboard className="size-3.5" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-full text-xs text-white/80 hover:bg-white/10 hover:text-white">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild className="rounded-full bg-white text-black text-xs hover:bg-white/90">
                <Link to="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100svh-88px)] flex-col items-center justify-center px-6 pb-20 text-center">
        <div className="flex max-w-3xl flex-col items-center gap-6">
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            A canvas where you and AI
            <span className="italic font-light text-indigo-200"> plan together</span>
          </h1>

          <p className="max-w-xl text-balance text-sm font-light leading-relaxed text-white/70">
            Thinkspace is an infinite whiteboard where you sketch the architecture,
            research the details, and build the plan — with AI agents.
          </p>

         
        </div>

        <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {proof.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-indigo-200">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
                <p className="mt-1 text-xs font-light leading-relaxed text-white/60">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </ShaderBackground>
  )
}

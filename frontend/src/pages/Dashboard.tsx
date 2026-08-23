import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Download, History, PenTool } from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useGetMeQuery } from '@/services/authApi'
import { useGetPagesQuery } from '@/services/pagesApi'

const features = [
  {
    icon: PenTool,
    title: 'Infinite canvas',
    description:
      'Draw, write, and sketch freely on tldraw. Every page is saved with version history.',
  },
  {
    icon: Bot,
    title: 'AI partner',
    description:
      'An expert beside your canvas — ask questions, research, and visualize ideas together.',
  },
  {
    icon: Download,
    title: 'Export anywhere',
    description:
      'Download any page as PNG or SVG. Your diagrams stay fully editable.',
  },
]

export default function Dashboard() {
  const { data } = useGetMeQuery()
  const user = data?.user
  const { data: pagesData } = useGetPagesQuery()
  const recentPages = (pagesData?.pages ?? []).slice(0, 5)

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-transparent to-primary/5 p-8">
          <p className="text-sm font-medium text-primary">Thinkspace.ai</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg">
            A space where human + Agents think together. Sketch your thoughts,
            research deeply, and let AI build the diagrams.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/workspace">
              Open Workspace <ArrowRight />
            </Link>
          </Button>
        </div>

        {/* Features */}
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="bg-primary/10 text-primary mb-2 flex size-9 items-center justify-center rounded-lg">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Recent pages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent workspaces</CardTitle>
                <CardDescription>Pick up where you left off</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/workspace">
                  View all <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentPages.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No workspaces yet — open the workspace to start thinking.
              </p>
            ) : (
              <ul className="divide-y">
                {recentPages.map((page) => (
                  <li key={page.id}>
                    <Link
                      to="/workspace"
                      className="hover:bg-accent flex items-center gap-3 rounded-md px-2 py-2.5"
                    >
                      <PenTool className="text-muted-foreground size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {page.name}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <History className="size-3" />
                        {page.updated_at
                          ? new Date(page.updated_at).toLocaleDateString()
                          : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

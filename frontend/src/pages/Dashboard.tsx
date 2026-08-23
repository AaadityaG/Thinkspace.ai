import { AppShell } from '@/components/AppShell'
import { useGetMeQuery } from '@/services/authApi'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const overviewCards = [
  { title: 'Sources', description: 'Confluence, GitHub, Jira, Teams' },
  { title: 'Memory', description: 'Project context & decisions' },
  { title: 'Chat', description: 'Cited, grounded answers' },
]

export default function Dashboard() {
  const { data } = useGetMeQuery()
  const user = data?.user

  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Here's your project context at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {overviewCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}

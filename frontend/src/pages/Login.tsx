import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import {
  errorMessage,
  useLoginMutation,
} from '../services/authApi'
import GoogleButton from '../components/GoogleButton'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useTheme } from '@/components/ThemeProvider'

export default function Login() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [login, { isLoading }] = useLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login({ email, password }).unwrap()
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="bg-background text-foreground relative flex min-h-svh flex-col items-center justify-center p-8">
      <Link
        to="/"
        className="absolute top-4 left-4 flex w-fit items-center gap-2 rounded-lg"
        aria-label="Go to homepage"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          T
        </span>
        <span className="text-lg font-semibold">Thinkspace.ai</span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
        className="absolute top-4 right-4 rounded-full"
      >
        {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </Button>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Log in to your Thinkspace.ai account
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <Card>
            <CardContent>
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <FieldGroup>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? 'Logging in…' : 'Log in'}
                  </Button>
                  <FieldDescription className="sr-only">
                    Or continue with Google
                  </FieldDescription>
                  <GoogleButton
                    onSuccess={() => navigate('/dashboard')}
                    onError={setError}
                  />
                </FieldGroup>
              </FieldGroup>
            </CardContent>
          </Card>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          No account?{' '}
          <Link
            to="/register"
            className="text-foreground underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

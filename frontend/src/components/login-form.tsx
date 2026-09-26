"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { ROLE_HOME } from "@/types"
import { BASE_URL } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RowsIcon, CircleNotch } from "@phosphor-icons/react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [slowNotice, setSlowNotice] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Pre-warm the backend immediately when login page mounts (reduces perceived Render cold-start time)
  useEffect(() => {
    fetch(`${BASE_URL}/api/v1/auth/roles/`, { method: "HEAD" }).catch(() => {})
  }, [])

  // Timer for server wake-up message
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (submitting) {
      timer = setTimeout(() => {
        setSlowNotice(true)
      }, 3500)
    } else {
      setSlowNotice(false)
    }
    return () => clearTimeout(timer)
  }, [submitting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      const user = await login(username, password)
      navigate(ROLE_HOME[user.role] ?? "/login", { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed"
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = (user: string) => {
    setUsername(user)
    setPassword("Password123!")
    setError("")
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-none shadow-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex size-12 items-center justify-center rounded-none bg-[#0F172A]">
              <RowsIcon className="size-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center text-[#102f71]">Oil Ordering System</CardTitle>
          <CardDescription className="text-center text-[#102f71]">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-[#102f71]">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                className="rounded-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#102f71]">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                className="rounded-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="whitespace-pre-line text-sm text-red-600 bg-red-50 p-3 rounded-none border border-red-200">
                {error}
              </div>
            )}
            {slowNotice && submitting && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-none border border-amber-200">
                <CircleNotch className="size-4 animate-spin text-amber-600 shrink-0" />
                <span>Waking up live backend container (Render free-tier cold start). Please allow 30–60 seconds on first request...</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-none bg-[#7fb445] hover:bg-[#6ea138] text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <CircleNotch className="size-4 animate-spin" />}
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <div className="mt-5 border-t pt-4 text-sm text-[#102f71]">
            <p className="font-semibold text-xs mb-2">Click to quick-fill demo credentials (Password: Password123!):</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => fillDemo("manager")}
                className="p-1.5 text-left bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                Manager: <strong>manager</strong>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("customs")}
                className="p-1.5 text-left bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                Customs: <strong>customs</strong>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("dock")}
                className="p-1.5 text-left bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                Loading Bay: <strong>dock</strong>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("customer")}
                className="p-1.5 text-left bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
              >
                Customer: <strong>customer</strong>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

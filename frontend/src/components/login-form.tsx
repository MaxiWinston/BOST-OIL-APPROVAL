"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { ROLE_HOME } from "@/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RowsIcon } from "@phosphor-icons/react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      const user = await login(username, password)
      navigate(ROLE_HOME[user.role] ?? "/login", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-none">
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
              <div className="whitespace-pre-line text-sm text-red-600 bg-red-50 p-3 rounded-none">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-none bg-[#7fb445] hover:bg-[#7fb445] text-white disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-sm text-[#102f71]">
            <p className="font-medium mb-2">Demo credentials (password: Password123!):</p>
            <div className="space-y-1 text-xs">
              <p>Depot Manager: manager</p>
              <p>Customs Officer: customs</p>
              <p>Loading Bay: dock</p>
              <p>Administrator: admin</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

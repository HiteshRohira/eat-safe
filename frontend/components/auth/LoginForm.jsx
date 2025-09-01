import { useState } from "react"
import { useNavigate } from "react-router-dom"

import api from "@/src/api"
import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/src/constants"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function Spinner({ className }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

/**
 * LoginForm
 * - Supports both "login" and "register" flows, mirroring the old shared/Form.jsx behavior.
 * - Props:
 *    - route: API endpoint (e.g., "/api/token/" for login, "/api/user/register/" for register)
 *    - method: "login" | "register"
 */
function LoginForm({
  className,
  route = "/api/token/",
  method = "login",
  ...props
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const title = method === "login" ? "Login" : "Register"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await api.post(route, { username, password })
      if (method === "login") {
        localStorage.setItem(ACCESS_TOKEN, res.data.access)
        localStorage.setItem(REFRESH_TOKEN, res.data.refresh)
        navigate("/")
      } else {
        // Register success -> go to login
        navigate("/login")
      }
    } catch (err) {
      // Match old behavior with a simple alert, plus inline message
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Something went wrong."
      alert(message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>
            {method === "login"
              ? "Enter your credentials to continue"
              : "Create a new account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Your username"
                disabled={loading}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={method === "login" ? "current-password" : "new-password"}
                placeholder="Your password"
                disabled={loading}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  {title}...
                </span>
              ) : (
                title
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export { LoginForm }
export default LoginForm

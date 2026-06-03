import { createServerClient } from "@supabase/ssr"
import { CREATOR_AI_USER_AGENT, type UserRole } from "@repo/validation"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const BYPASS_PATHS = [
  "/api/auth/callback",
  "/api/track-referral",
  "/api/contact-us",
  "/api/report-issue",
  "/api/youtube/callback",
]

async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<UserRole | undefined> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single<{ role: UserRole }>()

    if (error || !data) return undefined
    return data.role
  } catch {
    return undefined
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (BYPASS_PATHS.includes(pathname)) {
    const response = NextResponse.next()
    response.headers.set("Server", CREATOR_AI_USER_AGENT)
    return response
  }

  const response = NextResponse.next()
  response.headers.set("Server", CREATOR_AI_USER_AGENT)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Login page guards for already-authenticated users
  if (pathname === "/login" && session) {
    const role = await getUserRole(supabase, session.user.id)
    if (role === "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  if (pathname === "/admin/login" && session) {
    const role = await getUserRole(supabase, session.user.id)
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Dashboard guards
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      const loginPath = pathname.startsWith("/dashboard/admin") ? "/admin/login" : "/login"
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = loginPath
      redirectUrl.searchParams.set("redirectedFrom", pathname)
      return NextResponse.redirect(redirectUrl)
    }

    const role = await getUserRole(supabase, session.user.id)

    if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    if (!pathname.startsWith("/dashboard/admin") && role === "admin") {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/admin/:path*"],
}

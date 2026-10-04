"use client"

import type React from "react";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { type SupabaseClient, type User, type Session } from "@supabase/supabase-js"
// Type-only: a value import here dragged all of @repo/validation (zod, ~56kB)
// into every page's first-load JS, including the marketing pages.
import type { UserProfile } from "@repo/validation"
import { captureAttribution } from "@/lib/attribution"

type SupabaseContext = {
  /**
   * `null` until the auth client finishes loading. The client is ~210kB and is
   * only needed once a real auth/data call happens, so it is code-split out of
   * the first-load bundle and imported on mount. Anything that already gates on
   * `user`/`session` is implicitly safe — those are only set after the client
   * exists. Anything firing on a raw user event must null-check.
   */
  supabase: SupabaseClient | null
  user: User | null
  session: Session | null
  providerToken: string | null
  loading: boolean
  setSession: Dispatch<SetStateAction<Session | null>>
  setProviderToken: Dispatch<SetStateAction<string | null>>
  profile: UserProfile | null
  setProfile: Dispatch<SetStateAction<UserProfile | null>>
  profileLoading: boolean
  fetchUserProfile: (userId: string) => Promise<void>
  logout: () => Promise<void>
}

// Suspense boundary helpers
let sessionPromise: Promise<Session | null> | null = null
const profilePromises = new Map<string, Promise<UserProfile | null>>() // keyed by userId

const Context = createContext<SupabaseContext | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)

  useEffect(() => {
    let mounted = true
    import("@/lib/supabase/client").then(({ createClient }) => {
      if (mounted) setSupabase(createClient())
    })
    return () => {
      mounted = false
    }
  }, [])

  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [providerToken, setProviderToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const isLoggingOut = useRef(false)
  // The current profile for fetchUserProfile, which listeners call with an old closure.
  const profileRef = useRef(profile)
  profileRef.current = profile

  function generateReferralCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => chars[b % chars.length]).join("")
  }

  // Profile fetch with suspense support
  const fetchUserProfile = async (userId: string): Promise<void> => {
    if (!supabase) return
    if (!profileRef.current) setProfileLoading(true)
    try {
      let profilePromise = profilePromises.get(userId)
      // if (!profilePromise) {
      profilePromise = (async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "avatar_url, email, full_name, credits, ai_trained, free_training_used, youtube_connected, language, referral_code, role"
          )
          .eq("user_id", userId)
          .single()

        if (error) {
          console.error("Profile fetch error:", error.message)
          return null
        }

        // Ensure referral_code exists
        if (!data.referral_code) {
          const referral = generateReferralCode()
          const { data: updated, error: updateError } = await supabase
            .from("profiles")
            .update({ referral_code: referral })
            .eq("user_id", userId)
            .select(
              "avatar_url, email, full_name, credits, ai_trained, free_training_used, youtube_connected, language, referral_code, role"
            )
            .single()

          if (!updateError && updated) {
            return updated as UserProfile
          }
        }

        return data as UserProfile
      })()
      profilePromises.set(userId, profilePromise)
      // }

      const result = await profilePromise
      // A failed read keeps the last good profile rather than blanking credits and setup state.
      if (result) setProfile(result)
    } finally {
      setProfileLoading(false)
    }
  }

  // Initial session loader
  const getInitialSession = async (client: SupabaseClient): Promise<Session | null> => {
    const { data, error } = await client.auth.getSession()
    if (error) {
      console.error("Error fetching session:", error.message)
      return null
    }
    return data.session
  }

  useEffect(() => {
    captureAttribution()
  }, [])

  useEffect(() => {
    if (!supabase) return
    let mounted = true

    if (!sessionPromise) {
      sessionPromise = getInitialSession(supabase)
    }

    sessionPromise
      .then((sess) => {
        if (!mounted) return
        setSession(sess)
        setUser(sess?.user ?? null)
        setProviderToken((sess as any)?.provider_token ?? null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isLoggingOut.current) return
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setProviderToken((newSession as any)?.provider_token ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const logout = async () => {
    if (!supabase) return
    isLoggingOut.current = true
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setProviderToken(null)
    sessionPromise = null
    profilePromises.clear()
    isLoggingOut.current = false
  }

  // Fetch profile when user changes, and again when the tab regains focus, so credits,
  // setup state and a read that failed catch up without a reload.
  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    const refresh = () => fetchUserProfile(user.id)
    refresh()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [user?.id])

  const value: SupabaseContext = {
    supabase,
    user,
    session,
    providerToken,
    loading,
    setSession,
    setProviderToken,
    profile,
    setProfile,
    profileLoading,
    fetchUserProfile,
    logout,
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useSupabase = () => {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error("useSupabase must be used inside SupabaseProvider")
  }
  return context
}

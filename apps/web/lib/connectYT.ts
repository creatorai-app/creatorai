import { toast } from "sonner";
import type { SupabaseClient, User } from "@supabase/supabase-js"

interface ConnectYoutubeProps {
  /** Null while the code-split auth client is still loading — see supabase-provider. */
  supabase: SupabaseClient | null
  user: User | null
  setIsConnectingYoutube: (value: boolean) => void
  loginHint?: string
}

export const isGoogleProvider = (user: User | null): boolean => {
  const provider = user?.app_metadata?.provider
  const providers: string[] = user?.app_metadata?.providers ?? []
  return provider === "google" || providers.includes("google")
}

export const connectYoutubeChannel = async ({
  supabase,
  user,
  setIsConnectingYoutube,
  loginHint,
}: ConnectYoutubeProps) => {
  setIsConnectingYoutube(true)
  try {
    if (!supabase) throw new Error("Auth client not ready yet — please retry.")
    if (!user?.id) throw new Error("User not authenticated.")

    const queryParams: Record<string, string> = {
      access_type: "offline",
      prompt: "consent",
    }

    if (loginHint) {
      queryParams.login_hint = loginHint
    }

    // Proceed directly with Supabase OAuth
    const { data: oauthData, error: oauthError } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/youtube/callback`,
          scopes:
            "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/youtube.readonly",
          queryParams,
        },
      })

    if (oauthError) throw oauthError
    if (oauthData?.url) {
      window.location.href = oauthData.url
      return
    }
    throw new Error("Failed to retrieve Google authentication URL.")
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred."
    // Error is already shown to the user via toast
    toast.error(errorMessage)
  } finally {
    setIsConnectingYoutube(false)
  }
}
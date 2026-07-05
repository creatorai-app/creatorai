import { api } from "@/lib/api-client"
import { toast } from "sonner"
import { DubResponse } from "@repo/validation"

export interface DubbingProject {
  id: string
  project_id: string
  user_id: string
  original_media_url: string
  target_language: string
  status: "queued" | "processing" | "cloning" | "completed" | "failed"
  is_video: boolean
  dubbedUrl?: string
  credits_consumed?: number
  created_at: string
  media_name?: string
}

export async function getDubbings(accessToken?: string): Promise<DubbingProject[]> {
  try {
    return await api.get<DubbingProject[]>("/api/v1/dubbing", {
      requireAuth: true,
      accessToken,
    })
  } catch {
    toast.error("Failed to load dubbings")
    return []
  }
}

export async function getDubbing(
  projectId: string,
  accessToken?: string
): Promise<DubResponse | null> {
  try {
    return await api.get<DubResponse>(`/api/v1/dubbing/${projectId}`, {
      requireAuth: true,
      accessToken,
    })
  } catch {
    toast.error("Failed to load dubbing details")
    return null
  }
}

export async function deleteDubbing(
  projectId: string,
  accessToken?: string
): Promise<boolean> {
  try {
    await api.delete(`/api/v1/dubbing/${projectId}`, {
      requireAuth: true,
      accessToken,
    })
    return true
  } catch {
    return false
  }
}

/** Re-run a dub with the same source + target language (reuses the stored GCS object). */
export async function regenerateDubbing(
  projectId: string,
  accessToken?: string
): Promise<{ projectId: string; jobId: string }> {
  return api.post<{ projectId: string; jobId: string }>(
    `/api/v1/dubbing/${projectId}/regenerate`,
    {},
    { requireAuth: true, accessToken },
  )
}


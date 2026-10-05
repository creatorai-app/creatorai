import { api } from "@/lib/api-client"
import { toast } from "sonner"
import { DubEngine, DubResponse, DubStatus, RegenerateDubInput } from "@repo/validation"

export interface DubbingProject {
  id: string
  project_id: string
  user_id: string
  original_media_url: string
  target_language: string
  status: DubStatus
  video_status?: "uploading" | "uploaded" | null
  engine?: DubEngine | null
  /** Every language the media was dubbed into, across its regenerated dubs too. */
  languages: string[]
  /** The original and every dub regenerated from it. */
  dub_count: number
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

/** Every dub of one media, from any of them: the original first, then each regeneration. */
export async function getDubbingGroup(
  projectId: string,
  accessToken?: string
): Promise<DubResponse[] | null> {
  try {
    return await api.get<DubResponse[]>(`/api/v1/dubbing/${projectId}/group`, {
      requireAuth: true,
      accessToken,
    })
  } catch {
    toast.error("Failed to load dubbing details")
    return null
  }
}

/** Dub the same media again with other settings. Nothing is uploaded; the dub starts right away. */
export async function regenerateDubbing(
  projectId: string,
  input: RegenerateDubInput,
  accessToken?: string
): Promise<{ projectId: string; jobId: string }> {
  return api.post<{ projectId: string; jobId: string }>(
    `/api/v1/dubbing/${projectId}/regenerate`,
    input,
    { requireAuth: true, accessToken },
  )
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

/** Retry a failed dub from where it stopped (keeps the translation and finished segments). */
export async function resumeDubbing(
  projectId: string,
  accessToken?: string
): Promise<{ projectId: string; jobId: string }> {
  return api.post<{ projectId: string; jobId: string }>(
    `/api/v1/dubbing/${projectId}/resume`,
    {},
    { requireAuth: true, accessToken },
  )
}

/** Cancel a dub: stops its job, ends a wait for the video upload, or discards one that never started. */
export async function cancelDubbing(projectId: string, accessToken?: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/api/v1/dubbing/${projectId}/cancel`, {}, { requireAuth: true, accessToken })
}

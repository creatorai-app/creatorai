import { api } from "@/lib/api-client"
import { toast } from "sonner"
import type { VideoGenerationJob } from "@/hooks/useVideoGeneration"

export type { VideoGenerationJob }

export interface VideoGenerationAccess {
  success: boolean
  allowed: boolean
  plan: string | null
}

export async function getVideoGenerationAccess(): Promise<VideoGenerationAccess> {
  try {
    return await api.get<VideoGenerationAccess>('/api/v1/video-generation/access', { requireAuth: true })
  } catch {
    return { success: false, allowed: false, plan: null }
  }
}

export async function getVideoGeneration(id: string): Promise<VideoGenerationJob | null> {
  try {
    const res = await api.get<{ success: boolean; job: VideoGenerationJob }>(
      `/api/v1/video-generation/${id}`,
      { requireAuth: true },
    )
    return res.job ?? null
  } catch {
    return null
  }
}

export async function editVideoGeneration(
  id: string,
  instruction: string,
): Promise<{ videoJobId: string; jobId: string }> {
  return api.post<{ success: boolean; videoJobId: string; jobId: string }>(
    `/api/v1/video-generation/${id}/edit`,
    { instruction },
    { requireAuth: true },
  )
}

export async function deleteVideoGeneration(id: string): Promise<boolean> {
  try {
    await api.delete(`/api/v1/video-generation/${id}`, { requireAuth: true })
    return true
  } catch {
    toast.error("Failed to delete video")
    return false
  }
}

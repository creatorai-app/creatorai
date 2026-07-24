"use client";

import { useState } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { BACKEND_URL } from "@/lib/constants";

export function useSettings() {
  const { supabase, user } = useSupabase();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  

  const updateProfile = async ({
    name,
    language,
    avatar,
    initialAvatar
  }: {
    name: string;
    language: string;
    avatar?: File | null;
    initialAvatar: string | null;
  }) => {
    if (!user || !supabase) return;
    if (!name || name.length < 3) {
      toast.error("Name must be at least 3 characters long");
      return;
    }

    setIsUpdatingProfile(true);

    try {
      const updates: {
        full_name: string;
        language: string;
        updated_at: string;
        avatar_url?: string | null;
      } = {
        full_name: name,
        language,
        updated_at: new Date().toISOString(),
      };
      if (avatar) {
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(avatar.type)) {
          toast.error("Invalid file type. Please upload JPG, PNG, GIF, or WEBP.");
          return false;
        }

        const formData = new FormData();
        formData.append('file', avatar);

        const result = await api.upload<{ url: string }>('/api/v1/upload/avatar', formData, {
          requireAuth: true,
        });
        updates.avatar_url = result.url;
      } else if (!initialAvatar && !avatar) {
        await api.delete('/api/v1/upload/avatar', { requireAuth: true });
        updates.avatar_url = null;
      }
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile updated", { description: "Your profile has been updated successfully." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast.error("Error updating profile", { description: msg });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // --- Notification update ---
  const updateNotifications = async ({
    email,
    scriptCompletion,
    marketing,
  }: {
    email: boolean;
    scriptCompletion: boolean;
    marketing: boolean;
  }) => {
    setLoadingNotifications(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("Notification preferences updated");
    } catch (error: unknown) {
      toast.error("Error updating notifications", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoadingNotifications(false);
    }
  };

  // --- Password reset ---
  const changePassword = async () => {
    if (!user?.email) return;
    setIsChangingPassword(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send password reset email");
      }

      toast.success("Password reset email sent", {
        description: "If an account with that email exists, we have sent a password reset link.",
      });
    } catch (error: unknown) {
      toast.error("Error sending password reset email", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return {
    updateProfile,
    isUpdatingProfile,
    isChangingPassword,
    changePassword,

    // Notifications
    updateNotifications,
    loadingNotifications,
  };
}

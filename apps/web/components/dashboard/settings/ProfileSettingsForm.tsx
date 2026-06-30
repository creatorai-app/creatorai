"use client";

import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/card";
import { useSettings } from "@/hooks/useSettings"; // Imported the hook
import { Loader2, Save, Shield } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/select";
import { ImageDropzone } from "@repo/ui/image-dropzone";
import { useEffect, useState } from "react";
import { useSupabase } from "../../supabase-provider";
import { profileLanguages } from "@repo/validation";
import ProfileSettingSkeleton from "./loadingSkeleton/ProfileSettingSkeleton";

interface formDataState {
    name: string;
    email: string;
    language: string;
    initialAvatar: string | null;
}


export function ProfileSettingsForm() {
    const { user, profile, fetchUserProfile } = useSupabase();
    const { updateProfile, changePassword, isUpdatingProfile, isChangingPassword } = useSettings();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [formData, setFormData] = useState<formDataState>({
        name: "",
        email: "",
        language: "en",
        initialAvatar: null,
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [nameError, setNameError] = useState("");

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!profile) {
                setIsLoadingData(true);
                return;
            }
            setFormData({
                name: profile.full_name || "",
                email: profile.email || "",
                language: profile.language || "en",
                initialAvatar: profile.avatar_url || null,
            });
            setIsLoadingData(false);


        };
        fetchUserProfile();
    }, [user, profile]);

    const handleSave = async () => {
        setNameError("");
        if (formData.name.length < 3) {
            setNameError("Name must be at least 3 characters long.");
            return;
        }
        await updateProfile({
            name: formData.name,
            language: formData.language,
            avatar: avatarFile,
            initialAvatar: formData.initialAvatar,
        });
        await fetchUserProfile(user?.id || "");

    };

    const isSaving = isLoadingData || isUpdatingProfile;

    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                    Update your personal information and account settings.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {isLoadingData ? (
                    <ProfileSettingSkeleton />
                ) : (
                    <>
                        {/* --- Avatar Upload --- */}
                        <ImageDropzone
                            avatar={avatarFile}
                            setAvatar={setAvatarFile}
                            initialAvatar={formData.initialAvatar}
                            setInitialAvatar={(url) =>
                                setFormData((prev) => ({ ...prev, initialAvatar: url }))
                            }
                            disabled={isSaving}
                        />

                        {/* --- Full Name --- */}
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                                }
                                disabled={isSaving}
                                className="max-w-sm"
                            />
                            {nameError && (
                                <p className="text-xs text-red-500">{nameError}</p>
                            )}
                        </div>

                        {/* --- Email Address --- */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                disabled
                                className="max-w-sm cursor-not-allowed bg-muted"
                            />
                        </div>

                        {/* --- Language --- */}
                        <div className="space-y-1.5">
                            <Label htmlFor="languageSelector">Language</Label>
                            <Select
                                value={formData.language}
                                onValueChange={(value) =>
                                    setFormData((prev) => ({ ...prev, language: value }))
                                }
                                disabled={isSaving}
                            >
                                <SelectTrigger id="languageSelector" className="max-w-sm">
                                    <SelectValue placeholder="Select a language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profileLanguages.map((lang) => (
                                        <SelectItem key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* --- Security --- */}
                        <div className="border-t border-border pt-6 space-y-3">
                            <Label className="text-sm font-medium">Security</Label>
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    onClick={changePassword}
                                    disabled={isChangingPassword}
                                >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Change Password
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    We’ll send you an email with reset instructions.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>

            {/* Footer Save Button */}
            {!isLoadingData && (
                <CardFooter className="flex justify-end border-t bg-slate-50 dark:bg-slate-900/50 rounded-b-lg px-6 py-4">
                    <Button onClick={handleSave} disabled={isUpdatingProfile}>
                        {isUpdatingProfile ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save
                    </Button>
                </CardFooter>
            )}
        </Card>

    );
}
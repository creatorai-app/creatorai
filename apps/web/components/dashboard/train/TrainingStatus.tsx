"use client"
import * as motion from "motion/react-m";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import { Loader2, CheckCircle, CircleDot, Youtube } from "lucide-react";
import React from "react";
import { UserProfile } from "@repo/validation"

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
}

type StepProps = {
    icon: React.ReactNode;
    title: string;
    description: string;
    isComplete: boolean;
    isActive: boolean;
    children?: React.ReactNode;
}

function Step({ icon, title, description, isComplete, isActive, children }: StepProps) {
    const iconColor = isComplete ? "text-green-500" : isActive ? "text-purple-500" : "text-slate-400 dark:text-slate-600";
    const textColor = isComplete || isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400";

    return (
        <div className="flex items-start gap-4">
            <div className={`mt-1 ${iconColor}`}>{icon}</div>
            <div className="flex-1">
                <h3 className={`font-semibold ${textColor}`}>{title}</h3>
                <p className={`text-sm ${textColor}`}>{description}</p>
                {children && <div className="mt-3">{children}</div>}
            </div>
        </div>
    )
}

type TrainingStatusProps = {
    profile: UserProfile | null
    isConnectingYoutube: boolean
    onConnectYoutube: () => void
}

export function TrainingStatus({ profile, isConnectingYoutube, onConnectYoutube }: TrainingStatusProps) {
    const isYtConnected = profile?.youtube_connected || false;
    const isAiTrained = profile?.ai_trained || false;

    return (
        <motion.div variants={itemVariants}>
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Setup Checklist</CardTitle>
                    <CardDescription>Complete these steps to personalize your AI.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 pb-6 space-y-4">
                    <Step
                        icon={isYtConnected ? <CheckCircle className="h-5 w-5" /> : <Youtube className="h-5 w-5" />}
                        title="Connect YouTube Channel"
                        description={isYtConnected ? "Your channel is successfully connected." : "Allow access to start the training process."}
                        isComplete={isYtConnected}
                        isActive={!isYtConnected}
                    >
                        {!isYtConnected && (
                            <Button onClick={onConnectYoutube} disabled={isConnectingYoutube}>
                                {isConnectingYoutube ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</> : "Connect YouTube Channel"}
                            </Button>
                        )}
                    </Step>


                    <div className="pl-[1.1rem]">
                        <div className="border-l-2 border-dashed border-slate-300 dark:border-slate-700 h-6 ml-[0.3rem]"></div>
                    </div>


                    <Step
                        icon={isAiTrained ? <CheckCircle className="h-5 w-5" /> : <CircleDot className="h-5 w-5" />}
                        title="Train Your AI"
                        description={isAiTrained ? "Your AI is trained and ready to create." : "Provide 3-5 videos in the form below."}
                        isComplete={isAiTrained}
                        isActive={isYtConnected}
                    >

                    </Step>

                </CardContent>
            </Card>
        </motion.div>
    )
}
"use client";
// `Link` here used to come from lucide-react, the chain-link icon, so the
// primary landing-page CTA rendered as <svg href="/signup"> and never navigated.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BackgroundBeams } from "@repo/ui/background-beams";
import { MButton } from "@repo/ui/moving-border";

export default function CTASection() {
    return (
        <>
            <BackgroundBeams className="absolute inset-0 z-0" />

            <div className="relative z-10 container px-4 md:px-6">
                <div className="flex flex-col items-center text-center space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-white">
                        Ready to Transform Your Content Creation?
                    </h2>
                    <p className="max-w-[700px] text-slate-300 md:text-lg">
                        Join thousands of YouTubers who are saving time and creating better content with Creator AI.
                    </p>
                    <Link href="/signup">
                        <MButton
                            size="lg"
                            className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:brightness-110 text-white shadow-md transition-all w-40 h-12"
                        >
                            Get Started Free
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </MButton>
                    </Link>

                    <p className="text-sm text-slate-400">
                        Or{" "}
                        <Link
                            href="/tools"
                            className="font-medium text-purple-300 underline underline-offset-2 hover:text-purple-200"
                        >
                            try the free tools first
                        </Link>
                        . No account needed.
                    </p>
                </div>
            </div>

            {/*SVG Wave Divider at bottom */}
            <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 120" xmlns="http://www.w3.org/2000/svg">
                <path fill="#fff" fillOpacity="0.05" d="M0,0 C480,120 960,0 1440,120 L1440,0 L0,0 Z" />
            </svg></>
    )
}
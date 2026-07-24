"use client"

import * as motion from "motion/react-m";

interface StepperProps {
    steps: { id: number; name: string }[]
    currentStep: number
}

export default function ScriptGenerationStepper({
    steps,
    currentStep,
}: StepperProps) {
    return (
        <div className="flex w-full items-center px-2">
            {steps.map((s, index) => (
                <motion.div
                    key={s.id}
                    // - The `w-full` was removed here; it's not needed as the inner `flex-1` line handles width.
                    className="flex items-center flex-1"
                >
                    <div className="flex flex-col items-center text-center">
                        <motion.div
                            animate={currentStep >= s.id ? { scale: 1.1 } : { scale: 1 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-white transition-colors ${currentStep >= s.id
                                ? "bg-purple-600 dark:bg-purple-500"
                                : "bg-slate-300 dark:bg-slate-700"
                                }`}
                        >
                            {currentStep > s.id ? "✓" : s.id}
                        </motion.div>
                        <p
                            className={`mt-2 text-xs font-normal transition-colors md:font-medium md:text-sm truncate max-w-[150px] ${
                                // - Step names are now hidden on mobile and appear on small screens and up.
                                "hidden sm:block"
                                } ${currentStep >= s.id
                                    ? "text-slate-800 dark:text-slate-200"
                                    : "text-slate-400"
                                }`}
                        >
                            {s.name}
                        </p>
                    </div>

                    {index < steps.length - 1 && (
                        <div className="flex-1 h-0.5 mx-2 rounded-full bg-slate-300 dark:bg-slate-700 relative overflow-hidden">
                            <motion.div
                                className="h-0.5 bg-purple-600 dark:bg-purple-500 absolute left-0 top-0"
                                initial={{ width: "0%" }}
                                animate={{
                                    width:
                                        currentStep >= s.id + 1
                                            ? "100%"
                                            : currentStep === s.id
                                                ? "50%"
                                                : "0%",
                                }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                            />
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    )
}
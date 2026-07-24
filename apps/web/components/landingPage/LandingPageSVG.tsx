"use client"
import { BrainCircuit, Mic, Type, Film } from "lucide-react";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import * as motion from "motion/react-m";

const LandingPageSVG = () => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smooth the motion using spring
    const springConfig = { stiffness: 120, damping: 15 };
    const smoothX = useSpring(x, springConfig);
    const smoothY = useSpring(y, springConfig);

    const handleMouseMove = (event: React.MouseEvent) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - rect.left - rect.width / 2);
        y.set(event.clientY - rect.top - rect.height / 2);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    const rotateX = useTransform(smoothY, [-200, 200], [10, -10]);
    const rotateY = useTransform(smoothX, [-200, 200], [-10, 10]);

    const cardX = useTransform(smoothX, [-200, 200], [-10, 10]);
    const cardY = useTransform(smoothY, [-200, 200], [-6, 6]);

    const float1X = useTransform(smoothX, [-200, 200], [15, -15]);
    const float1Y = useTransform(smoothY, [-200, 200], [12, -12]);

    const float2X = useTransform(smoothX, [-200, 200], [-12, 12]);
    const float2Y = useTransform(smoothY, [-200, 200], [-18, 18]);

    const float3X = useTransform(smoothX, [-200, 200], [10, -10]);
    const float3Y = useTransform(smoothY, [-200, 200], [14, -14]);

    return (
        <motion.div
            className="relative w-full h-full flex items-center justify-center"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: 1200 }}
        >
            {/* SVG glow filter */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="premium-glow">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
                            result="glow"
                        />
                        <feComposite in="glow" in2="SourceGraphic" operator="out" />
                    </filter>
                </defs>
            </svg>

            <motion.div
                className="relative w-[300px] h-[250px] md:w-[350px] md:h-[300px]"
                style={{
                    transformStyle: "preserve-3d",
                    rotateX,
                    rotateY,
                }}
                initial={{ scale: 0.98 }}
                whileHover={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 150, damping: 12 }}
            >
                {/* Abstract AI brain */}
                <motion.div className="absolute inset-0" style={{ transform: "translateZ(10px)", zIndex: "100" }}
                    initial={{ opacity: 0, y: 40, }}
                    animate={{ opacity: 1, y: 10, }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    <BrainCircuit className="absolute w-20 h-20 text-purple-500 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 opacity-90" />

                    {/* Radiating Aura */}
                    <motion.div
                        className="absolute w-36 h-36 border border-purple-400/40 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                    />

                    {/* AI Mesh Background */}
                    <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
                        <motion.path
                            d="M10,70 C30,10 70,90 90,30"
                            stroke="rgba(147, 51, 234, 0.4)"
                            strokeWidth="0.4"
                            fill="none"
                            strokeDasharray="4 4"
                            animate={{ strokeDashoffset: [20, 0] }}
                            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                        />
                        <motion.circle
                            cx="60"
                            cy="60"
                            r="1"
                            fill="white"
                            animate={{ r: [1, 2, 1], opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                        />
                    </svg>

                    {/* AI Sparks */}
                    <motion.div
                        className="absolute w-1 h-1 rounded-full bg-pink-400 top-[42%] left-[28%]"
                        animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0.8, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2.4 }}
                    />
                    <motion.div
                        className="absolute w-1.5 h-1.5 rounded-full bg-sky-400 top-[66%] left-[60%]"
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
                        transition={{ repeat: Infinity, duration: 2.8, delay: 0.5 }}
                    />
                </motion.div>


                {/* Glass base card */}
                <motion.div
                    className="absolute w-full h-full rounded-xl border bg-white/30 border-slate-200 backdrop-blur-md shadow-lg"
                    style={{ x: cardX, y: cardY, transform: "translateZ(30px) rotate(-4deg)" }}
                    initial={{ opacity: 0, y: 40, rotate: -8 }}
                    animate={{ opacity: 1, y: 10, rotate: -4 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                />

                {/* Main content card */}
                <motion.div
                    className="absolute w-full h-full rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 flex flex-col shadow-xl"
                    style={{
                        x: cardX,
                        y: cardY,
                        transform: "translateZ(50px)"
                    }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Mic className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="w-1/2 h-3 bg-purple-200 rounded-full"></div>
                    </div>
                    <div className="space-y-2">
                        <div className="w-full h-2 bg-slate-200 rounded-full"></div>
                        <div className="w-5/6 h-2 bg-slate-200 rounded-full"></div>
                        <div className="w-3/4 h-2 bg-slate-200 rounded-full"></div>
                        <div className="w-1/2 h-2 bg-slate-200 rounded-full"></div>
                    </div>
                </motion.div>

                {/* Floating card 1 - Script */}
                <motion.div
                    className="absolute top-[-20px] right-[-40px] w-44 h-28 bg-white border border-slate-200 rounded-lg p-3 shadow-2xl flex flex-col"
                    style={{ x: float1X, y: float1Y, transform: "translateZ(90px) rotate(6deg)" }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
                >
                    <div className="flex items-center gap-1 mb-2">
                        <Type className="w-3 h-3 text-pink-500" />
                        <div className="w-1/3 h-2 bg-pink-400 rounded-full"></div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                        <div className="w-5/6 h-1.5 bg-slate-200 rounded-full"></div>
                        <div className="w-2/3 h-1.5 bg-slate-200 rounded-full"></div>
                    </div>
                </motion.div>

                {/* Floating card 2 - Thumbnail */}
                <motion.div
                    className="absolute bottom-[-40px] left-[-30px] w-36 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-2 shadow-xl flex items-center justify-center"
                    style={{ x: float2X, y: float2Y, transform: "translateZ(75px) rotate(-10deg)" }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.7 }}
                >
                    <div className="w-full h-full border-2 border-white/30 rounded-md flex items-center justify-center">
                        <Film className="w-8 h-8 text-white/80" />
                    </div>
                </motion.div>

                {/* Floating card 3 - Subtitles */}
                <motion.div
                    className="absolute bottom-[-60px] right-[-20px] w-32 h-16 bg-white border border-slate-200 rounded-lg p-2 shadow-lg flex flex-col justify-center"
                    style={{ x: float3X, y: float3Y, transform: "translateZ(60px) rotate(4deg)" }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.9 }}
                >
                    <div className="w-full h-1.5 bg-slate-300 rounded-full mb-1.5"></div>
                    <div className="w-full h-1.5 bg-slate-300 rounded-full"></div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

export default LandingPageSVG;
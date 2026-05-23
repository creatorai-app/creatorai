export const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function formatNumber(num: number | null | undefined): string {
    if (!num) return "0";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

export function parseDuration(iso: string): string {
    const match = iso.replace("PT", "").match(/(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return "";
    const h = match[1] ? match[1].replace("H", "") + ":" : "";
    const m = match[2] ? match[2].replace("M", "") : "0";
    const s = match[3] ? match[3].replace("S", "").padStart(2, "0") : "00";
    return h ? `${h}${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}
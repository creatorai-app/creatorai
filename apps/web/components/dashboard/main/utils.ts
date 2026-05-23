import type { DashboardData } from "@/app/dashboard/page";
import type { ActivityPeriod } from "./types";

export function buildActivityData(data: DashboardData, period: ActivityPeriod) {
  const now = new Date();
  type Bucket = { label: string; key: string; scripts: number; ideas: number; thumbnails: number; subtitles: number };
  const buckets: Bucket[] = [];

  if (period === "weekly") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({ label: d.toLocaleDateString("en", { weekday: "short" }), key: d.toISOString().split("T")[0]!, scripts: 0, ideas: 0, thumbnails: 0, subtitles: 0 });
    }
  } else if (period === "monthly") {
    for (let i = 29; i >= 0; i -= 5) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({ label: d.toLocaleDateString("en", { month: "short", day: "numeric" }), key: `${Math.floor(i / 5)}`, scripts: 0, ideas: 0, thumbnails: 0, subtitles: 0 });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ label: d.toLocaleDateString("en", { month: "short" }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, scripts: 0, ideas: 0, thumbnails: 0, subtitles: 0 });
    }
  }

  const assignToBucket = (items: { created_at: string }[], field: "scripts" | "ideas" | "thumbnails" | "subtitles") => {
    const cutoff = period === "weekly" ? 7 : period === "monthly" ? 30 : 365;
    items.forEach((item) => {
      const itemDate = new Date(item.created_at);
      const daysAgo = Math.floor((now.getTime() - itemDate.getTime()) / 86400000);
      if (daysAgo > cutoff) return;

      if (period === "weekly") {
        const dateStr = itemDate.toISOString().split("T")[0];
        const b = buckets.find((b) => b.key === dateStr);
        if (b) b[field]++;
      } else if (period === "monthly") {
        const bucketIdx = Math.floor(daysAgo / 5);
        const b = buckets.find((b) => b.key === `${bucketIdx}`);
        if (b) b[field]++;
      } else {
        const key = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, "0")}`;
        const b = buckets.find((b) => b.key === key);
        if (b) b[field]++;
      }
    });
  };

  assignToBucket(data.scripts, "scripts");
  assignToBucket(data.ideations, "ideas");
  assignToBucket(data.thumbnails, "thumbnails");
  assignToBucket(data.subtitles, "subtitles");

  return buckets;
}

export function buildRecentActivity(data: DashboardData) {
  type ActivityItem = { id: string; title: string; type: string; date: string; status?: string };
  const items: ActivityItem[] = [];

  data.scripts.forEach((s) => items.push({ id: s.id, title: s.title, type: "script", date: s.created_at, status: s.status }));
  data.ideations.forEach((i) => items.push({ id: i.id, title: i.context || i.niche_focus || "Ideation", type: "ideation", date: i.created_at, status: i.status }));
  data.thumbnails.forEach((t) => items.push({ id: t.id, title: (t as any).title || "Thumbnail", type: "thumbnail", date: t.created_at, status: (t as any).status }));
  data.subtitles.forEach((s) => items.push({ id: s.id, title: s.title || s.filename || "Subtitle", type: "subtitle", date: s.created_at, status: s.status }));
  data.dubbings.forEach((d) => items.push({ id: d.id, title: d.media_name || "Dubbing", type: "dubbing", date: d.created_at, status: d.status }));

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
}

export function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

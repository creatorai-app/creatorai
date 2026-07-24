"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-m";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Clock, AlertCircle, FileVideo, Edit, Download, Trash2, MoreVertical, Clapperboard } from "lucide-react";
import { SubtitleResponse } from "@repo/validation";
import { api } from "@/lib/api-client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@repo/ui/dropdown-menu";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@repo/ui/alert-dialog";
import { SubtitleHistorySkeleton } from "./skeleton/SubtitleHistorySkeleton";
import { convertJsonToSrt } from "@repo/validation";
import { convertJsonToVTT } from "@/utils/vttHelper";
import { downloadBlob } from "@/lib/download";

export function SubtitleHistory({ subtitles, isLoading, error, onDelete }: { subtitles: SubtitleResponse[], isLoading: boolean, error: string | null, onDelete: (id: string) => Promise<void> }) {
    const [deleteItem, setDeleteItem] = useState<SubtitleResponse | null>(null);

    // Sort: Newest first
    const sorted = useMemo(() => [...subtitles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [subtitles]);

    if (error) return <div className="text-red-500 p-4 border border-red-200 rounded bg-red-50">Error: {error}</div>;

    return (
        <>
            <Card className="border-0 shadow-sm">
                <CardHeader className="border-b border-gray-100 py-4"><CardTitle>Recent Projects</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {isLoading ? <SubtitleHistorySkeleton /> : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>File Name</TableHead>
                                    <TableHead className="hidden md:table-cell">Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Language</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence mode="popLayout">
                                    {sorted.length ? sorted.map(item => (
                                        <Row key={item.id} item={item} onDelete={() => setDeleteItem(item)} />
                                    )) : <EmptyState />}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete {deleteItem?.filename}?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button variant="destructive" onClick={() => { if(deleteItem) onDelete(deleteItem.id); setDeleteItem(null); }}>Delete</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function Row({ item, onDelete }: { item: SubtitleResponse, onDelete: () => void }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Helper to download files
    const download = async (fmt: "srt" | "vtt") => {
        setLoading(true);
        try {
            const { success, subtitle } = await api.get<any>(`/api/v1/subtitle/${item.id}`, { requireAuth: true });
            if (!success) throw new Error();
            const data = JSON.parse(subtitle.subtitles_json || "[]");
            const txt = fmt === "srt" ? convertJsonToSrt(data) : convertJsonToVTT(data);

            const blob = new Blob([txt], { type: "text/plain" });
            downloadBlob(blob, `${item.filename}.${fmt}`);
            toast.success(`Downloaded .${fmt}`);
        } catch { toast.error("Download failed"); }
        setLoading(false);
    };

    return (
        <motion.tr
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="group cursor-pointer border-b hover:bg-purple-50/40"
            onClick={(e) => !(e.target as HTMLElement).closest('button, [role="menuitem"]') && router.push(`/dashboard/subtitles/${item.id}`)}
        >
            <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                    {/* RESTORED: Conditional Logic for Icon Color */}
                    <Clapperboard
                        className={`h-9 w-9 border p-2 rounded-lg ${
                            item.status === "done"
                                ? "text-purple-500 bg-purple-100 border-purple-200"
                                : "text-gray-500 bg-gray-50 border-gray-200"
                        }`}
                    />
                    <div className="flex flex-col">
                        <span className="truncate max-w-[150px] md:max-w-xs font-semibold text-gray-900">{item.filename}</span>
                        <span className="md:hidden text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()} • {item.language}</span>
                    </div>
                </div>
            </TableCell>
            <TableCell className="hidden md:table-cell text-gray-500">{new Date(item.created_at).toLocaleDateString()}</TableCell>
            <TableCell><StatusBadge status={item.status} /></TableCell>
            <TableCell className="hidden md:table-cell uppercase text-xs font-bold text-gray-500">{item.language}</TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/subtitles/${item.id}`)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        {item.status === "done" && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>} Download</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); download('srt'); }}>.SRT</DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); download('vtt'); }}>.VTT</DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </motion.tr>
    );
}

const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
        done: "bg-emerald-50 text-emerald-700 border-emerald-100",
        processing: "bg-violet-50 text-violet-700 border-violet-100 animate-pulse",
        failed: "bg-red-50 text-red-700 border-red-100",
        queued: "bg-amber-50 text-amber-700 border-amber-100"
    };
    const Icons: any = { done: CheckCircle2, processing: Loader2, failed: AlertCircle, queued: Clock };
    const Icon = Icons[status] || Clock;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || "bg-gray-100"}`}>
            <Icon className={`w-3.5 h-3.5 mr-1.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const EmptyState = () => (
    <TableRow><TableCell colSpan={5} className="h-32 text-center text-gray-400"><FileVideo className="h-8 w-8 mx-auto mb-2 opacity-20"/>No projects found.</TableCell></TableRow>
);
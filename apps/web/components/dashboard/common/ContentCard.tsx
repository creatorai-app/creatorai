import { useState } from "react";
import * as motion from "motion/react-m";
import Link from "next/link";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import {
    FileText,
    BookOpen,
    MoreHorizontal,
    ExternalLink,
    Trash2,
    Download,
    CalendarDays,
    Loader2,
    Languages,
    ImageIcon,
    Clapperboard,
} from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/alert-dialog";
import { toast } from "sonner";

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
};

interface ContentCardProps {
    id: string;
    title: string;
    created_at: string;
    onDelete: () => Promise<void>;
    onExport?: (scriptId: string) => Promise<void>;
    setToDelete: (id: string | null) => void;
    type: "scripts" | "research" | "dubbing" | "thumbnails" | "subtitles" | "story-builder";
    imagePreview?: string;
    statusBadge?: React.ReactNode;
}

export function ContentCard({
    id,
    title,
    created_at,
    onDelete,
    onExport,
    setToDelete,
    type,
    imagePreview,
    statusBadge,
}: ContentCardProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);

    const creationDate = new Date(created_at).toLocaleDateString();

    // Dynamic values based on type
    const linkHref = `/dashboard/${type}/${id}`;
    const iconMap = { scripts: FileText, dubbing: Languages, thumbnails: ImageIcon, subtitles: Clapperboard, research: BookOpen, "story-builder": BookOpen };
    const Icon = iconMap[type] || BookOpen;
    const labelMap = { scripts: "Delete Script", dubbing: "Delete Dubbing", thumbnails: "Delete Thumbnail", subtitles: "Delete Subtitle", research: "Delete Research", "story-builder": "Delete Blueprint" };
    const deleteLabel = labelMap[type];
    const descMap = {
        scripts: "This will permanently delete your script and all its associated data.",
        dubbing: "This will permanently delete your dubbed media and all its associated data.",
        thumbnails: "This will permanently delete this thumbnail job and all its generated images.",
        subtitles: "This will permanently delete this subtitle project and all its associated data.",
        research: "This will permanently delete your research and all its associated data.",
        "story-builder": "This will permanently delete this story blueprint and all its associated data.",
    };
    const dialogDescription = descMap[type];


    const handleExport = () => {
        if (!onExport) return;
        const exportPromise = onExport(id);
        const contentTypeName = type === 'scripts' ? 'script' : type === 'dubbing' ? 'dubbing' : type === 'story-builder' ? 'blueprint' : 'research';

        setIsExporting(true);

        toast.promise(exportPromise, {
            loading: `Exporting your ${contentTypeName}...`,
            success: `Your ${contentTypeName} has been exported successfully!`,
            error: (err) => `Failed to export: ${err.message || 'An unknown error occurred'}`,
        });

        exportPromise.finally(() => {
            setIsExporting(false);
        });
    };

    const openDeleteDialog = () => {
        setToDelete(id);
        setMenuOpen(false);
        setDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setDialogOpen(false);
        setToDelete(null);
    };

    const handleConfirmDelete = async () => {
        setDialogOpen(false);
        await onDelete();
    };

    const handleDialogOpenChange = (open: boolean) => {
        setDialogOpen(open);
        if (!open) setToDelete(null);
    };

    return (
        <motion.div
            variants={itemVariants}
            whileTap={{ scale: 0.985 }}
            whileHover={{ scale: 1.008 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="h-full"
        >
            <Card className="group relative h-full overflow-hidden rounded-lg transition-all duration-300 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:shadow-xl hover:shadow-purple-500/10 dark:hover:shadow-purple-400/5">
                <Link href={linkHref} passHref legacyBehavior>
                    <a className="block cursor-pointer p-5">
                        <div className="flex items-start gap-4">
                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt={title}
                                    className="h-14 w-14 shrink-0 rounded-lg object-cover border"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex-shrink-0 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                                    <Icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                            )}

                            <div className="flex-grow min-w-0">
                                <h3 className="md:font-semibold md:text-lg text-slate-800 dark:text-slate-100 md:leading-tight text-base font-medium truncate">
                                    {title}
                                </h3>
                                <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                    <CalendarDays className="h-4 w-4" />
                                    <span>{creationDate}</span>
                                    {statusBadge}
                                </div>
                            </div>
                        </div>
                    </a>
                </Link>

                <div className="absolute top-4 right-4 z-10">
                    <AlertDialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    className="h-8 w-8 rounded-full transform-gpu transition-all duration-200 opacity-100 md:opacity-0 md:translate-x-2 md:group-hover:opacity-100 md:group-hover:translate-x-0"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <DropdownMenuItem className="cursor-pointer" onClick={() => (window.location.href = linkHref)}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    <span>View</span>
                                </DropdownMenuItem>
                                {onExport &&
                                    (isExporting ? (
                                        <DropdownMenuItem disabled>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            <span>Exporting...</span>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
                                            <Download className="mr-2 h-4 w-4" />
                                            <span>Export</span>
                                        </DropdownMenuItem>
                                    ))}

                                <DropdownMenuItem
                                    className="text-red-500 focus:text-red-500 cursor-pointer"
                                    onClick={openDeleteDialog}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>{deleteLabel}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={closeDeleteDialog}>
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleConfirmDelete}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    {deleteLabel}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </Card>
        </motion.div>
    );
}
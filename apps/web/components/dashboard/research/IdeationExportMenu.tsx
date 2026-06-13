"use client";

import { useState } from "react";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Download, FileText, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { downloadBlob } from "@/lib/download";

interface IdeationExportMenuProps {
  ideationId: string;
}

export default function IdeationExportMenu({ ideationId }: IdeationExportMenuProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExportPdf = async () => {
    setExporting("pdf");
    try {
      const blob = await api.get<Blob>(`/api/v1/ideation/${ideationId}/export/pdf`, {
        requireAuth: true,
        responseType: "blob",
      });
      downloadBlob(blob, `ideation_${ideationId}.pdf`);
      toast.success("PDF exported");
    } catch {
      toast.error("PDF export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleExportJson = async () => {
    setExporting("json");
    try {
      const data = await api.get<Record<string, unknown>>(`/api/v1/ideation/${ideationId}/export/json`, {
        requireAuth: true,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `ideation_${ideationId}.json`);
      toast.success("JSON exported");
    } catch {
      toast.error("JSON export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!!exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportPdf} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" /> Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJson} className="cursor-pointer">
          <FileJson className="mr-2 h-4 w-4" /> Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

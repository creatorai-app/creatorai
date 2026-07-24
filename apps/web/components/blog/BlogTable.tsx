// Server Component — pure presentational table, no interactivity.
import { Check, Star, X } from "lucide-react";
import {
  countStars,
  detectTableVariant,
  isCreatorAiColumn,
  isHighlightRow,
  stripMarkdownBold,
  type ParsedTable,
  type TableVariant,
} from "@/lib/parse-blog-tables";
import { cn } from "@/lib/utils";

interface BlogTableProps {
  table: ParsedTable;
}

function CellContent({ value }: { value: string }) {
  const trimmed = value.trim();

  if (trimmed === "✅" || trimmed.startsWith("✅ ")) {
    const label = trimmed.replace(/^✅\s*/, "");
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        {label ? <span className="text-slate-600">{label}</span> : null}
      </span>
    );
  }

  if (trimmed === "❌" || trimmed.startsWith("❌ ")) {
    const label = trimmed.replace(/^❌\s*/, "");
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-500">
          <X className="h-3 w-3" strokeWidth={3} />
        </span>
        {label ? <span className="text-slate-500">{label}</span> : null}
      </span>
    );
  }

  const starCount = countStars(trimmed);
  if (starCount > 0) {
    const withoutStars = trimmed.replace(/⭐/g, "").trim();
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="inline-flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < starCount
                  ? "fill-amber-400 text-amber-400"
                  : "fill-slate-100 text-slate-200"
              )}
            />
          ))}
        </span>
        {withoutStars ? (
          <span className="text-xs text-slate-400">{withoutStars}</span>
        ) : null}
      </span>
    );
  }

  const { text, bold } = stripMarkdownBold(trimmed);
  if (bold) {
    return <span className="font-semibold text-slate-900">{text}</span>;
  }

  return <span>{text}</span>;
}

function HeaderCell({ value, variant }: { value: string; variant: TableVariant }) {
  const { text, bold } = stripMarkdownBold(value);
  return (
    <th
      className={cn(
        "px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider first:pl-5 last:pr-5 border-b",
        variant === "scorecard"
          ? "text-slate-600 border-purple-100/80"
          : "text-white/90 border-white/10"
      )}
    >
      <span className={bold ? "font-extrabold" : undefined}>{text}</span>
    </th>
  );
}

export default function BlogTable({ table }: BlogTableProps) {
  const variant = detectTableVariant(table.headers);
  const creatorAiColIndex = table.headers.findIndex(isCreatorAiColumn);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.04]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead
            className={cn(
              variant === "scorecard"
                ? "bg-gradient-to-r from-purple-50 via-purple-50/80 to-slate-50"
                : "bg-gradient-to-r from-purple-600 via-purple-600 to-violet-600"
            )}
          >
            <tr>
              {table.headers.map((header) => (
                <HeaderCell key={header} value={header} variant={variant} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.rows.map((row, rowIndex) => {
              const highlighted = isHighlightRow(row);
              return (
                <tr
                  key={rowIndex}
                  className={cn(
                    "transition-colors",
                    highlighted
                      ? "bg-purple-50/70"
                      : rowIndex % 2 === 1
                        ? "bg-slate-50/50"
                        : "bg-white",
                    !highlighted && "hover:bg-purple-50/40"
                  )}
                >
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={cn(
                        "px-4 py-3.5 align-middle leading-relaxed first:pl-5 last:pr-5",
                        colIndex === 0
                          ? "font-medium text-slate-800"
                          : "text-slate-600",
                        colIndex === creatorAiColIndex &&
                          !highlighted &&
                          "bg-emerald-50/40",
                        highlighted && "font-medium text-slate-800",
                        variant === "scorecard" &&
                          colIndex === 1 &&
                          "whitespace-nowrap"
                      )}
                    >
                      <CellContent value={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

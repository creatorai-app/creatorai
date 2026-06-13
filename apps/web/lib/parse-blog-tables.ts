export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export type BlogContentSegment =
  | { type: "markdown"; content: string }
  | { type: "table"; table: ParsedTable };

const TABLE_BLOCK_RE =
  /(?:^|\n)(\|[^\n]+\|\r?\n\|[-:|\s]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g;

function parseRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

export function parseMarkdownTable(tableText: string): ParsedTable {
  const lines = tableText.trim().split(/\r?\n/).filter((line) => line.trim());
  const headers = parseRow(lines[0] ?? "");
  const rows = lines.slice(2).map(parseRow);
  return { headers, rows };
}

export function splitBlogContent(content: string): BlogContentSegment[] {
  const segments: BlogContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(TABLE_BLOCK_RE)) {
    const tableText = match[1];
    if (!tableText) continue;

    const start = match.index ?? 0;
    const prefix = content.slice(lastIndex, start);

    if (prefix) {
      segments.push({ type: "markdown", content: prefix });
    }

    segments.push({ type: "table", table: parseMarkdownTable(tableText) });
    lastIndex = start + tableText.length;
  }

  const remainder = content.slice(lastIndex);
  if (remainder) {
    segments.push({ type: "markdown", content: remainder });
  }

  return segments.length > 0 ? segments : [{ type: "markdown", content }];
}

export function stripMarkdownBold(text: string): { text: string; bold: boolean } {
  const match = /^\*\*(.+)\*\*$/.exec(text.trim());
  if (match?.[1]) {
    return { text: match[1], bold: true };
  }
  return { text, bold: false };
}

export function countStars(text: string): number {
  return (text.match(/⭐/g) ?? []).length;
}

export type TableVariant = "scorecard" | "comparison" | "pricing" | "matrix" | "default";

export function detectTableVariant(headers: string[]): TableVariant {
  const normalized = headers.map((h) => h.toLowerCase());

  if (normalized.includes("rating")) return "scorecard";
  if (normalized.some((h) => h.includes("cost"))) return "pricing";
  if (headers.length >= 5) return "matrix";
  if (headers.length === 3) return "comparison";
  return "default";
}

export function isHighlightRow(cells: string[]): boolean {
  const first = cells[0]?.toLowerCase() ?? "";
  return (
    first.includes("overall") ||
    first.includes("total") ||
    cells.some((cell) => /^\*\*.+\*\*$/.test(cell.trim()))
  );
}

export function isCreatorAiColumn(header: string): boolean {
  return header.toLowerCase().includes("creator ai");
}

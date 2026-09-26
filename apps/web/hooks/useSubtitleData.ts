import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SubtitleResponse, SubtitleLine } from "@repo/validation";
import { api, getApiErrorMessage } from '@/lib/api-client';

function isSubtitleLineArray(value: unknown): value is SubtitleLine[] {
    return Array.isArray(value) && value.every(
        (item) =>
            item &&
            typeof item === 'object' &&
            typeof (item as SubtitleLine).start === 'string' &&
            typeof (item as SubtitleLine).end === 'string' &&
            typeof (item as SubtitleLine).text === 'string',
    );
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
};

// Some transcripts come back HTML-escaped (&quot; &#39; &amp;), which the editor showed literally.
function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
        if (entity.startsWith('#')) {
            const isHex = entity[1]?.toLowerCase() === 'x';
            const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
            const isSurrogate = code >= 0xd800 && code <= 0xdfff;
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !isSurrogate ? String.fromCodePoint(code) : match;
        }
        return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    });
}

function decodeLines(lines: SubtitleLine[]): SubtitleLine[] {
    return lines.map((line) => ({ ...line, text: decodeHtmlEntities(line.text) }));
}

function parseSubtitles(value: SubtitleResponse['subtitles_json']): SubtitleLine[] {
    if (!value) return [];
    if (isSubtitleLineArray(value)) return decodeLines(value);
    if (typeof value !== 'string') return [];

    try {
        const parsed = JSON.parse(value);
        return isSubtitleLineArray(parsed) ? decodeLines(parsed) : [];
    } catch {
        return [];
    }
}

export function useSubtitleData(id: string) {
    const [subtitleData, setSubtitleData] = useState<SubtitleResponse | null>(null);
    const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<{ success: boolean, subtitle: SubtitleResponse }>(`/api/v1/subtitle/${id}`, {
                requireAuth: true,
            });
            // console.log(res);
            if (!res.success) {
                throw new Error('Failed to fetch subtitle data. Job not found.');
            }
            const data: SubtitleResponse = res.subtitle as SubtitleResponse;
            setSubtitleData(data);

            const parsedSubtitles = parseSubtitles(data.subtitles_json);
            if (data.subtitles_json && parsedSubtitles.length === 0) {
                toast.error("Failed to read existing subtitles. They may be corrupt.");
            }
            setSubtitles(Array.isArray(parsedSubtitles) ? parsedSubtitles : []);

        } catch (err) {
            const message = getApiErrorMessage(err, 'Failed to load subtitle data.');
            setError(message);
            toast.error('Could not load subtitle data', { description: message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        fetchData();
    }, [id]);

    return {
        subtitleData,
        subtitles,
        setSubtitles,
        isLoading,
        error,
        refetch: fetchData,
    };
}
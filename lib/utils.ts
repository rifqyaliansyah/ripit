/**
 * Extracts an 11-char YouTube video ID from common URL forms:
 * watch?v=, youtu.be/, embed/, and shorts/.
 */
export function extractVideoId(url: string): string | null {
    const match = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
}

/**
 * Formats a duration in seconds as m:ss (e.g. 125 -> "2:05").
 * Returns "0:00" for invalid or negative input.
 */
export function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const totalSec = Math.round(seconds);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
import { useState, useRef, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { checkYoutubeUrl, ApiError } from "@/lib/api";

interface TrackData {
  id?: string;
  youtubeUrl?: string;
  title: string;
  artist: string;
  duration: string;
  cover: string;
  lyrics?: string;
  hasLyrics?: boolean;
}

interface AddTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrack?: TrackData | null;
  onAddTrack?: (track: {
    youtubeUrl: string;
    title: string;
    artist: string;
    duration: string;
    cover: string;
    lyrics: string;
  }) => void;
  onSaveTrack?: (updatedTrack: {
    id: string;
    youtubeUrl: string;
    title: string;
    artist: string;
    duration: string;
    cover: string;
    lyrics: string;
  }) => void;
}

export default function AddTrackModal({
  isOpen,
  onClose,
  initialTrack,
  onAddTrack,
  onSaveTrack,
}: AddTrackModalProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [lyricTab, setLyricTab] = useState<"text" | "upload">("text");
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(false);
  const prevTrackIdRef = useRef<string | undefined>(undefined);

  const MAX_LYRICS_FILE_SIZE = 100 * 1024;

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const trackChanged = isOpen && initialTrack?.id !== prevTrackIdRef.current;

    if (justOpened || trackChanged) {
      if (initialTrack) {
        setYoutubeUrl(initialTrack.youtubeUrl || "");
        setLyrics(initialTrack.lyrics || "");
      } else {
        setYoutubeUrl("");
        setLyrics("");
      }
      setFileName("");
      setError("");
      setLyricTab("text");
    }

    prevIsOpenRef.current = isOpen;
    prevTrackIdRef.current = initialTrack?.id;
  }, [isOpen, initialTrack?.id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_LYRICS_FILE_SIZE) {
      setError("Lyrics file is too large (max 100KB).");
      e.target.value = "";
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content.length > MAX_LYRICS_FILE_SIZE) {
        setError("Lyrics file is too large (max 100KB).");
        setFileName("");
        return;
      }
      setLyrics(content);
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = youtubeUrl.trim();
    if (!trimmed) {
      setError("YouTube link is required.");
      return;
    }

    // Editing existing track
    if (initialTrack && initialTrack.id) {
      let title = initialTrack.title;
      let artist = initialTrack.artist;
      let duration = initialTrack.duration;
      let cover = initialTrack.cover;

      if (trimmed !== initialTrack.youtubeUrl) {
        setIsSubmitting(true);
        setError("");
        try {
          const metadata = await checkYoutubeUrl(trimmed);
          let durationDisplay = metadata.duration;
          if (metadata.duration_sec > 0) {
            const totalSec = Math.round(metadata.duration_sec);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            durationDisplay = `${m}:${s.toString().padStart(2, "0")}`;
          }
          title = metadata.title;
          artist = metadata.artist;
          duration = durationDisplay;
          cover = metadata.cover_url;
        } catch (err) {
          if (err instanceof ApiError) {
            setError(err.message || "Couldn't fetch video details.");
          } else {
            setError("Couldn't fetch video details. Check the link and try again.");
          }
          setIsSubmitting(false);
          return;
        }
      }

      if (onSaveTrack) {
        onSaveTrack({
          id: initialTrack.id,
          youtubeUrl: trimmed,
          title,
          artist,
          duration,
          cover,
          lyrics,
        });
      }
      handleClose();
      setIsSubmitting(false);
      return;
    }

    // Adding new track
    setIsSubmitting(true);
    setError("");

    try {
      const metadata = await checkYoutubeUrl(trimmed);
      let durationDisplay = metadata.duration;
      if (metadata.duration_sec > 0) {
        const totalSec = Math.round(metadata.duration_sec);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        durationDisplay = `${m}:${s.toString().padStart(2, "0")}`;
      }

      if (onAddTrack) {
        onAddTrack({
          youtubeUrl: metadata.youtube_url || trimmed,
          title: metadata.title,
          artist: metadata.artist,
          duration: durationDisplay,
          cover: metadata.cover_url,
          lyrics,
        });
      }

      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Couldn't fetch video details.");
      } else {
        setError("Couldn't fetch video details. Check the link and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setYoutubeUrl("");
    setLyrics("");
    setFileName("");
    setError("");
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="sm">
      <div className="w-full flex flex-col text-left">
        {/* Header with Title & Close Icon */}
        <div className="flex items-center justify-between pb-space-md mb-space-xs border-b border-[#E5DDD3]">
          <div className="flex items-center gap-space-sm">
            <span className="font-title-sm text-title-sm font-semibold text-[#262422]">
              {initialTrack ? "Track details & lyrics" : "Add track"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-[#7A7672] hover:text-[#262422] transition-colors cursor-pointer rounded"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md mt-space-xs">
          {/* YouTube Link Input */}
          <div className="flex flex-col gap-space-2xs">
            <label className="text-label-sm font-label-sm text-[#7A7672]">
              YouTube Link
            </label>
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                if (error) setError("");
              }}
              className="w-full px-space-md py-space-sm rounded-lg bg-surface-container-lowest border border-[#E5DDD3] text-[#262422] placeholder-[#76726D]/70 focus:outline-none focus:border-[#262422] font-body-sm text-body-sm transition-colors"
            />
            {error && (
              <span className="text-label-sm font-label-sm text-[#EE5522] mt-1">
                {error}
              </span>
            )}
          </div>

          {/* Lyrics Input Section (Text or Upload .lrc) */}
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center justify-between">
              <label className="text-label-sm font-label-sm text-[#7A7672]">
                Lyrics (optional)
              </label>
              {/* Tab Selector */}
              <div className="flex items-center gap-1 bg-[#EAE1D7]/70 p-0.5 rounded-md text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setLyricTab("text")}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    lyricTab === "text"
                      ? "bg-[#FDF9F4] text-[#262422] shadow-xs"
                      : "text-[#7A7672] hover:text-[#262422]"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setLyricTab("upload")}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    lyricTab === "upload"
                      ? "bg-[#FDF9F4] text-[#262422] shadow-xs"
                      : "text-[#7A7672] hover:text-[#262422]"
                  }`}
                >
                  Upload .lrc
                </button>
              </div>
            </div>

            {lyricTab === "text" ? (
              <textarea
                placeholder="[00:12.50] every second with you&#10;[00:16.20] feels like coming home"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={4}
                className="w-full p-space-sm rounded-lg bg-surface-container-lowest border border-[#E5DDD3] text-[#262422] placeholder-[#76726D]/60 focus:outline-none focus:border-[#262422] font-mono text-[12px] leading-relaxed resize-none transition-colors"
              />
            ) : (
              <div className="flex flex-col gap-space-xs">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".lrc,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-space-md px-space-md border border-dashed border-[#C5BCB1] hover:border-[#262422] bg-[#F7EFE8]/50 hover:bg-[#F7EFE8] rounded-lg flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-center"
                >
                  <span className="material-symbols-outlined text-[24px] text-[#7349a7]">
                    upload_file
                  </span>
                  <span className="text-body-sm font-medium text-[#262422]">
                    {fileName ? fileName : "Choose .lrc file from device"}
                  </span>
                  <span className="text-[11px] text-[#7A7672]">
                    {fileName
                      ? "Click to change file"
                      : "Supports synced lyric files (.lrc)"}
                  </span>
                </button>
              </div>
            )}

            <p className="text-[11px] text-[#7A7672] mt-0.5">
              .lrc format, one line per timestamp. Can be added later.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-space-xs">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-space-md px-space-md rounded-lg bg-[#EE5522] hover:bg-[#d84817] active:bg-[#c23f12] text-white font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-xs disabled:opacity-50"
            >
              {isSubmitting
                ? "Fetching & adding..."
                : initialTrack
                ? "Save lyrics & details"
                : "Add to queue"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import type { WSMessage, UserPresencePayload, Room, RoomMember, Track, HostChangedPayload } from "./types";
import { getToken, getUser, getWsTicket } from "./api";

type ResumeOverlayReason = "self-reconnect" | "host-disconnected" | "host-changed";

interface RoomSocketContextValue {
    room: Room | null;
    members: RoomMember[];
    tracks: Track[];
    connected: boolean;
    hostLatencyMs: number | null;
    myLatencyMs: number | null;
    trackDurationMap: Record<string, string>;
    send: (message: WSMessage) => void;
    setTrackDuration: (trackId: string, duration: string) => void;
    leaveRoom: () => void;
    resumeOverlay: ResumeOverlayReason | null;
    showResyncOverlay: boolean;
    clearResumeOverlay: () => void;
    clearResyncOverlay: () => void;
}

const RoomSocketContext = createContext<RoomSocketContextValue | null>(null);

const MAX_TICKET_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function RoomSocketProvider({
    roomId,
    initialRoom,
    onRoomClosed,
    children,
}: {
    roomId: string;
    initialRoom: Room;
    onRoomClosed?: () => void;
    children: ReactNode;
}) {
    const [room, setRoom] = useState<Room>(initialRoom);
    const [members, setMembers] = useState<RoomMember[]>(initialRoom.members || []);
    const [tracks, setTracks] = useState<Track[]>(initialRoom.tracks || []);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const onRoomClosedRef = useRef(onRoomClosed);
    const roomRef = useRef<Room>(initialRoom);
    const [hostLatencyMs, setHostLatencyMs] = useState<number | null>(null);
    const [myLatencyMs, setMyLatencyMs] = useState<number | null>(null);
    const [trackDurationMap, setTrackDurationMap] = useState<Record<string, string>>({});
    const [resumeOverlay, setResumeOverlay] = useState<ResumeOverlayReason | null>(null);
    const [showResyncOverlay, setShowResyncOverlay] = useState(false);

    const setTrackDuration = useCallback((trackId: string, duration: string) => {
        setTrackDurationMap((prev) => {
            if (prev[trackId] === duration) return prev;
            return { ...prev, [trackId]: duration };
        });
    }, []);

    useEffect(() => {
        onRoomClosedRef.current = onRoomClosed;
    }, [onRoomClosed]);

    useEffect(() => {
        roomRef.current = room;
    }, [room]);

    useEffect(() => {
        let cancelled = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let reconnectAttempt = 0;

        const getTicketWithRetry = async (): Promise<string | null> => {
            for (let attempt = 1; attempt <= MAX_TICKET_RETRIES; attempt++) {
                try {
                    return await getWsTicket();
                } catch (err) {
                    const isLastAttempt = attempt === MAX_TICKET_RETRIES;
                    console.error(
                        `[WS] Failed to get connection ticket (attempt ${attempt}/${MAX_TICKET_RETRIES}):`,
                        err
                    );
                    if (isLastAttempt || cancelled) return null;
                    await sleep(RETRY_DELAY_MS * attempt);
                }
            }
            return null;
        };

        const scheduleReconnect = () => {
            if (cancelled) return;
            const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt, RECONNECT_MAX_DELAY_MS);
            reconnectAttempt += 1;
            reconnectTimer = setTimeout(connect, delay);
        };

        const connect = async () => {
            if (cancelled) return;
            const token = getToken();
            if (!token) return;

            const ticket = await getTicketWithRetry();
            if (!ticket || cancelled) return;

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const wsUrl = apiUrl.replace(/^http/, "ws");
            const ws = new WebSocket(`${wsUrl}/ws/rooms/${roomId}?ticket=${ticket}`);
            wsRef.current = ws;

            ws.onopen = () => {
                reconnectAttempt = 0;
                setConnected(true);
            };

            ws.onclose = () => {
                setConnected(false);
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
                // The server drops a connection for lots of ordinary reasons
                // (host restarted, a network blip, Chrome throttling a
                // backgrounded tab) — without this, the client just sits
                // here forever showing stale room/playback state.
                scheduleReconnect();
            };

            ws.onmessage = (event) => {
                const lines: string[] = event.data.split("\n");
                for (const line of lines) {
                    if (!line) continue;
                    let msg: WSMessage;
                    try {
                        msg = JSON.parse(line);
                    } catch {
                        continue;
                    }

                    switch (msg.type) {
                        case "INITIAL_STATE": {
                            const payload = msg.payload as { room: Room };
                            const wasPlaying = payload.room.playback_state === "playing";
                            const safeRoom: Room = { ...payload.room, playback_state: "paused" };

                            const user = getUser();
                            const isListener = !!(user && payload.room.host_id !== user.id);

                            if (wasPlaying) {
                                if (isListener) {
                                    setShowResyncOverlay(true);
                                } else {
                                    setResumeOverlay("self-reconnect");
                                }
                            }

                            setRoom(safeRoom);
                            setMembers(payload.room.members || []);
                            setTracks(payload.room.tracks || []);
                            break;
                        }
                        case "USER_JOINED": {
                            const payload = msg.payload as UserPresencePayload;
                            setMembers((prev) =>
                                prev.some((m) => m.user_id === payload.user_id)
                                    ? prev
                                    : [
                                        ...prev,
                                        {
                                            room_id: roomId,
                                            user_id: payload.user_id,
                                            role: payload.role,
                                            joined_at: new Date().toISOString(),
                                            user: { id: payload.user_id, username: payload.username },
                                        },
                                    ]
                            );
                            break;
                        }
                        case "USER_LEFT": {
                            const payload = msg.payload as UserPresencePayload;
                            setMembers((prev) => prev.filter((m) => m.user_id !== payload.user_id));
                            break;
                        }
                        case "PAUSE_ON_DISCONNECT": {
                            // Host disconnected → show overlay to everyone
                            setResumeOverlay("host-disconnected");
                            break;
                        }
                        case "HOST_CHANGED": {
                            const payload = msg.payload as HostChangedPayload;
                            setRoom((prev) => (prev ? { ...prev, host_id: payload.new_host_id } : prev));
                            setMembers((prev) =>
                                prev
                                    .filter((m) => m.user_id !== payload.old_host_id)
                                    .map((m) =>
                                        m.user_id === payload.new_host_id ? { ...m, role: "host" } : m
                                    )
                            );

                            const user = getUser();
                            if (user?.id === payload.new_host_id) {
                                // If we're the one just promoted and the
                                // "host disconnected" overlay is still up,
                                // upgrade it to explain we're the new host
                                // rather than leaving it pointing at the
                                // old, now-resolved situation.
                                setResumeOverlay((prev) => (prev === "host-disconnected" ? "host-changed" : prev));
                            }
                            break;
                        }
                        case "QUEUE_UPDATED": {
                            const payload = msg.payload as { tracks: Track[] };
                            setTracks(payload.tracks || []);
                            break;
                        }
                        case "SYNC_PLAYBACK": {
                            const payload = msg.payload as {
                                playback_state: string;
                                playback_position_ms: number;
                                current_track_id?: string | null;
                            };
                            setRoom((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        playback_state: payload.playback_state as Room["playback_state"],
                                        playback_position_ms: payload.playback_position_ms,
                                        current_track_id:
                                            payload.current_track_id !== undefined
                                                ? payload.current_track_id
                                                : prev.current_track_id,
                                    }
                                    : prev
                            );
                            break;
                        }
                        case "CHANGE_STATE": {
                            const payload = msg.payload as {
                                playback_state: string;
                                position_ms?: number;
                            };
                            setRoom((prev) =>
                                prev
                                    ? {
                                        ...prev,
                                        playback_state: payload.playback_state as Room["playback_state"],
                                        playback_position_ms:
                                            payload.position_ms !== undefined
                                                ? payload.position_ms
                                                : prev.playback_position_ms,
                                    }
                                    : prev
                            );
                            break;
                        }
                        case "SESSION_STARTED": {
                            const payload = msg.payload as { session_started_at: string };
                            setRoom((prev) => (prev ? { ...prev, session_started_at: payload.session_started_at } : prev));
                            break;
                        }
                        case "ROOM_CLOSED": {
                            onRoomClosedRef.current?.();
                            break;
                        }
                        case "PLAYBACK_SETTINGS": {
                            const payload = msg.payload as { repeat_mode: Room["repeat_mode"]; is_shuffled: boolean };
                            setRoom((prev) =>
                                prev
                                    ? { ...prev, repeat_mode: payload.repeat_mode, is_shuffled: payload.is_shuffled }
                                    : prev
                            );
                            break;
                        }
                        case "PONG": {
                            const payload = msg.payload as { sent_at: number };
                            const latency = Date.now() - payload.sent_at;
                            const user = getUser();
                            const isHost = !!(user && roomRef.current && user.id === roomRef.current.host_id);
                            if (isHost) {
                                const ws = wsRef.current;
                                if (ws?.readyState === WebSocket.OPEN) {
                                    try {
                                        ws.send(
                                            JSON.stringify({ type: "HOST_LATENCY", payload: { latency_ms: latency } })
                                        );
                                    } catch {
                                        // Same TOCTOU gap as send() above.
                                    }
                                }
                            } else {
                                setMyLatencyMs(latency);
                            }
                            break;
                        }
                        case "HOST_LATENCY": {
                            const payload = msg.payload as { latency_ms: number };
                            setHostLatencyMs(payload.latency_ms);
                            break;
                        }
                    }
                }
            };
        };

        connect();

        // Chrome (and other browsers) can throttle or fully suspend timers
        // and network handling in a backgrounded tab, which can silently
        // drop the WebSocket. When the tab comes back to the foreground,
        // check the connection immediately instead of waiting for the
        // backoff timer.
        const handleVisibility = () => {
            if (document.visibilityState !== "visible" || cancelled) return;
            const current = wsRef.current;
            if (!current || current.readyState === WebSocket.CLOSED || current.readyState === WebSocket.CLOSING) {
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
                reconnectAttempt = 0;
                connect();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            cancelled = true;
            document.removeEventListener("visibilitychange", handleVisibility);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [roomId]);

    useEffect(() => {
        if (!connected) return;

        const sendPing = () => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            try {
                ws.send(JSON.stringify({ type: "PING", payload: { sent_at: Date.now() } }));
            } catch {
                // Same TOCTOU gap as send() above — safe to drop this tick.
            }
        };

        sendPing();
        const id = setInterval(sendPing, 5000);

        return () => clearInterval(id);
    }, [connected]);

    const send = useCallback((message: WSMessage) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
            ws.send(JSON.stringify(message));
        } catch {
            // Socket flipped state between the check above and this call
            // (can happen under rapid reconnects) — safe to drop, the next
            // reconnect/heartbeat will catch up.
        }
    }, []);

    const leaveRoom = useCallback(() => {
        send({ type: "LEAVE_ROOM", payload: {} });
        wsRef.current?.close();
    }, [send]);

    return (
        <RoomSocketContext.Provider
            value={{
                room,
                members,
                tracks,
                connected,
                hostLatencyMs,
                myLatencyMs,
                trackDurationMap,
                send,
                setTrackDuration,
                leaveRoom,
                resumeOverlay,
                showResyncOverlay,
                clearResumeOverlay: () => setResumeOverlay(null),
                clearResyncOverlay: () => setShowResyncOverlay(false),
            }}
        >
            {children}
        </RoomSocketContext.Provider>
    );
}

export function useRoomSocketContext() {
    const ctx = useContext(RoomSocketContext);
    if (!ctx) throw new Error("useRoomSocketContext must be used within RoomSocketProvider");
    return ctx;
}
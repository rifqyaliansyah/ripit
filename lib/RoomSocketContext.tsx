"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import type { WSMessage, UserPresencePayload, Room, RoomMember, Track } from "./types";
import { getToken, getUser, getWsTicket } from "./api";

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
}

const RoomSocketContext = createContext<RoomSocketContextValue | null>(null);

const MAX_TICKET_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

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
        let ws: WebSocket | null = null;

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

        (async () => {
            const token = getToken();
            if (!token) return;

            const ticket = await getTicketWithRetry();
            if (!ticket || cancelled) return;

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
            const wsUrl = apiUrl.replace(/^http/, "ws");
            ws = new WebSocket(`${wsUrl}/ws/rooms/${roomId}?ticket=${ticket}`);
            wsRef.current = ws;

            ws.onopen = () => setConnected(true);
            ws.onclose = () => setConnected(false);

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
                            setRoom(payload.room);
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
                                wsRef.current?.send(
                                    JSON.stringify({ type: "HOST_LATENCY", payload: { latency_ms: latency } })
                                );
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
        })();

        return () => {
            cancelled = true;
            ws?.close();
            wsRef.current = null;
        };
    }, [roomId]);

    useEffect(() => {
        if (!connected) return;

        const sendPing = () => {
            wsRef.current?.send(JSON.stringify({ type: "PING", payload: { sent_at: Date.now() } }));
        };

        sendPing();
        const id = setInterval(sendPing, 5000);

        return () => clearInterval(id);
    }, [connected]);

    const send = useCallback((message: WSMessage) => {
        wsRef.current?.send(JSON.stringify(message));
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
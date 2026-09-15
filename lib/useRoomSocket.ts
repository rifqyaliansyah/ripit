"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WSMessage, UserPresencePayload, Room, RoomMember } from "./types";
import { getToken, getWsTicket } from "./api";

interface UseRoomSocketOptions {
    roomId: string | null;
    onRoomClosed?: () => void;
}

const MAX_TICKET_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useRoomSocket({ roomId, onRoomClosed }: UseRoomSocketOptions) {
    const [members, setMembers] = useState<RoomMember[]>([]);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const onRoomClosedRef = useRef(onRoomClosed);

    useEffect(() => {
        onRoomClosedRef.current = onRoomClosed;
    }, [onRoomClosed]);

    useEffect(() => {
        if (!roomId) return;

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
                const lines = event.data.split("\n");
                for (const line of lines) {
                    if (!line) continue;
                    let msg: WSMessage;
                    try {
                        msg = JSON.parse(line);
                    } catch {
                        continue;
                    }

                    if (msg.type === "INITIAL_STATE") {
                        const payload = msg.payload as { room: Room };
                        setMembers(payload.room.members || []);
                    }

                    if (msg.type === "USER_JOINED") {
                        const payload = msg.payload as UserPresencePayload;
                        setMembers((prev) => {
                            if (prev.some((m) => m.user_id === payload.user_id)) return prev;
                            return [
                                ...prev,
                                {
                                    room_id: roomId,
                                    user_id: payload.user_id,
                                    role: payload.role,
                                    joined_at: new Date().toISOString(),
                                    user: { id: payload.user_id, username: payload.username },
                                },
                            ];
                        });
                    }

                    if (msg.type === "USER_LEFT") {
                        const payload = msg.payload as UserPresencePayload;
                        setMembers((prev) => prev.filter((m) => m.user_id !== payload.user_id));
                    }

                    if (msg.type === "ROOM_CLOSED") {
                        onRoomClosedRef.current?.();
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

    const send = useCallback((message: WSMessage) => {
        wsRef.current?.send(JSON.stringify(message));
    }, []);

    return { members, connected, send };
}
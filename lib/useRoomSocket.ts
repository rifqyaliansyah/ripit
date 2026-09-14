"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WSMessage, UserPresencePayload, Room, RoomMember } from "./types";
import { getToken } from "./api";

interface UseRoomSocketOptions {
    roomId: string | null;
    onRoomClosed?: () => void;
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

        const token = getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const wsUrl = apiUrl.replace(/^http/, "ws");
        const ws = new WebSocket(`${wsUrl}/ws/rooms/${roomId}?token=${token}`);
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

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [roomId]);

    const send = useCallback((message: WSMessage) => {
        wsRef.current?.send(JSON.stringify(message));
    }, []);

    return { members, connected, send };
}
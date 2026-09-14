"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import type { WSMessage, UserPresencePayload, Room, RoomMember } from "./types";
import { getToken } from "./api";

interface RoomSocketContextValue {
    room: Room | null;
    members: RoomMember[];
    connected: boolean;
    send: (message: WSMessage) => void;
    leaveRoom: () => void;
}

const RoomSocketContext = createContext<RoomSocketContextValue | null>(null);

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
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const onRoomClosedRef = useRef(onRoomClosed);

    useEffect(() => {
        onRoomClosedRef.current = onRoomClosed;
    }, [onRoomClosed]);

    useEffect(() => {
        const token = getToken();
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const wsUrl = apiUrl.replace(/^http/, "ws");
        const ws = new WebSocket(`${wsUrl}/ws/rooms/${roomId}?token=${token}`);
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
                    case "ROOM_CLOSED": {
                        onRoomClosedRef.current?.();
                        break;
                    }
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

    const leaveRoom = useCallback(() => {
        send({ type: "LEAVE_ROOM", payload: {} });
        wsRef.current?.close();
    }, [send]);

    return (
        <RoomSocketContext.Provider value={{ room, members, connected, send, leaveRoom }}>
            {children}
        </RoomSocketContext.Provider>
    );
}

export function useRoomSocketContext() {
    const ctx = useContext(RoomSocketContext);
    if (!ctx) throw new Error("useRoomSocketContext must be used within RoomSocketProvider");
    return ctx;
}
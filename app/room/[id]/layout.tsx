"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RoomSocketProvider } from "@/lib/RoomSocketContext";
import { getRoomByCode, getToken, getUser } from "@/lib/api";
import type { Room } from "@/lib/types";

export default function RoomLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const roomCode = id.toUpperCase();
    const router = useRouter();
    const [room, setRoom] = useState<Room | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const token = getToken();
        const user = getUser();
        if (!token || !user) {
            router.replace("/");
            return;
        }

        getRoomByCode(roomCode)
            .then((data) => {
                setRoom(data);
                setReady(true);
            })
            .catch(() => router.replace("/"));
    }, [roomCode, router]);

    if (!ready || !room) return null;

    return (
        <RoomSocketProvider
            roomId={room.id}
            initialRoom={room}
            onRoomClosed={() => router.replace("/")}
        >
            {children}
        </RoomSocketProvider>
    );
}
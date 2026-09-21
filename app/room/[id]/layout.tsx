"use client";

import { use, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RoomSocketProvider, useRoomSocketContext } from "@/lib/RoomSocketContext";
import { getRoomByCode, getToken, getUser } from "@/lib/api";
import type { Room } from "@/lib/types";

function RoomSessionGate({ roomCode }: { roomCode: string }) {
    const { room } = useRoomSocketContext();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const onSetupPage = pathname.endsWith("/setup");
        if (room?.session_started_at && onSetupPage) {
            router.replace(`/room/${roomCode}`);
        }
    }, [room?.session_started_at, pathname, roomCode, router]);

    // Keep the browser URL's room code in sync with the room's live code.
    // Without this, a regenerated code leaves the URL pointing at a code
    // that no longer exists in the DB — a refresh would then fail to
    // resolve the room and bounce everyone (host included) back to entry.
    useEffect(() => {
        if (!room?.room_code) return;
        const liveCode = room.room_code.toUpperCase();
        if (liveCode === roomCode) return;

        const onSetupPage = pathname.endsWith("/setup");
        router.replace(onSetupPage ? `/room/${liveCode}/setup` : `/room/${liveCode}`);
    }, [room?.room_code, roomCode, pathname, router]);

    return null;
}

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
            <RoomSessionGate roomCode={roomCode} />
            {children}
        </RoomSocketProvider>
    );
}
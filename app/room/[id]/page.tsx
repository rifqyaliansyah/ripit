"use client";

import TrackQueue from "@/components/room/TrackQueue";
import PlayerStage from "@/components/room/PlayerStage";
import RoomMembers from "@/components/room/RoomMembers";
import { useRoomSocketContext } from "@/lib/RoomSocketContext";

export default function RoomPage() {
  const { room, members } = useRoomSocketContext();

  return (
    <div className="flex flex-col h-[100dvh] w-full font-body-md overflow-hidden bg-[#FDF6F0] text-[#2B2A27]">
      <main className="w-full flex-1 flex flex-col min-h-0">
        <div className="w-full max-w-[1280px] mx-auto grid grid-cols-12 flex-1 min-h-0 h-full">
          <TrackQueue />
          <PlayerStage />
          <RoomMembers
            members={members}
            roomCode={room?.room_code ?? ""}
            currentHostId={room?.host_id}
          />
        </div>
      </main>
    </div>
  );
}
import TrackQueue from "@/components/room/TrackQueue";
import PlayerStage from "@/components/room/PlayerStage";
import RoomMembers from "@/components/room/RoomMembers";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col h-[100dvh] w-full font-body-md overflow-hidden bg-[#FDF6F0] text-[#2B2A27]">
      <main className="w-full flex-1 flex flex-col min-h-0">
        <div className="w-full max-w-[1280px] mx-auto grid grid-cols-12 flex-1 min-h-0 h-full">
          {/* 1. LEFT COLUMN: Song queue */}
          <TrackQueue />

          {/* 2. CENTER COLUMN: Widest Focal Hub */}
          <PlayerStage />

          {/* 3. RIGHT COLUMN: Room members */}
          <RoomMembers roomId={id} />
        </div>
      </main>
    </div>
  );
}


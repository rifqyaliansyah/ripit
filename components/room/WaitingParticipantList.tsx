interface Participant {
  id: string;
  name: string;
  isHost?: boolean;
  initial: string;
}

interface WaitingParticipantListProps {
  participants?: Participant[];
}

const DEFAULT_PARTICIPANTS: Participant[] = [
  {
    id: "1",
    name: "Maya (you)",
    isHost: true,
    initial: "M",
  },
  {
    id: "2",
    name: "Alex",
    isHost: false,
    initial: "A",
  },
];

export default function WaitingParticipantList({
  participants = DEFAULT_PARTICIPANTS,
}: WaitingParticipantListProps) {
  return (
    <div className="w-full flex flex-col gap-space-sm text-left">
      <div className="flex items-center justify-between w-full">
        <span className="text-label-md font-label-md text-[#76726D]">
          Participants in room ({participants.length})
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E5A800]"></span>
          <span className="text-label-sm font-label-sm text-[#76726D]">
            Waiting
          </span>
        </div>
      </div>

      <div className="w-full flex flex-col divide-y divide-[#E5DDD3] bg-[#FDF6F0] border border-[#E5DDD3] rounded-lg px-space-md py-space-xs">
        {participants.map((p) => (
          <div
            key={p.id}
            className="py-space-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-full bg-[#EAE1D7] border border-[#dcd3c8] flex items-center justify-center text-label-md font-label-md font-semibold text-[#2B2A27]">
                {p.initial}
              </div>
              <div className="flex flex-col">
                <span className="font-body-md text-body-md text-[#2B2A27] font-medium leading-tight">
                  {p.name}
                </span>
                {p.isHost && (
                  <span className="text-label-sm font-label-sm text-[#76726D] capitalize">
                    Host
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

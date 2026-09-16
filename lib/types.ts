export type PlaybackState = "playing" | "paused";
export type RoomRole = "host" | "listener";
export type RepeatMode = "off" | "all" | "one";

export interface User {
    id: string;
    username: string;
}

export interface Track {
    id: string;
    room_id: string;
    youtube_url: string;
    title: string;
    artist: string;
    duration: string;
    cover_url: string;
    lyrics?: string;
    has_lyrics: boolean;
    added_by: string;
    sort_order: number;
    created_at: string;
}

export interface RoomMember {
    room_id: string;
    user_id: string;
    role: RoomRole;
    joined_at: string;
    user?: User;
}

export interface Room {
    id: string;
    room_code: string;
    name: string;
    host_id: string;
    current_track_id: string | null;
    playback_state: PlaybackState;
    playback_position_ms: number;
    last_sync_timestamp: string;
    session_started_at: string | null;
    created_at: string;
    host?: User;
    current_track?: Track;
    members?: RoomMember[];
    tracks?: Track[];
    repeat_mode: RepeatMode;
    is_shuffled: boolean;
}

export interface JoinRoomResponse {
    room: Room;
    member: RoomMember;
}

export interface YouTubeMetadata {
    video_id: string;
    title: string;
    artist: string;
    duration: string;
    duration_sec: number;
    cover_url: string;
    youtube_url: string;
}

export type WSEventType =
    | "SYNC_PLAYBACK"
    | "CHANGE_STATE"
    | "QUEUE_UPDATED"
    | "USER_JOINED"
    | "USER_LEFT"
    | "INITIAL_STATE"
    | "ROOM_CLOSED"
    | "LEAVE_ROOM"
    | "SESSION_STARTED"
    | "PLAYBACK_SETTINGS"
    | "ERROR"
    | "PING"
    | "PONG"
    | "HOST_LATENCY"
    | "PAUSE_ON_DISCONNECT";

export interface WSMessage<T = unknown> {
    type: WSEventType;
    payload: T;
}

export interface UserPresencePayload {
    user_id: string;
    username: string;
    avatar_url?: string;
    role: RoomRole;
}
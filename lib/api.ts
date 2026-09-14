const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
}

const TOKEN_KEY = "ripit_token";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
    status: number;
    detail?: string;

    constructor(message: string, status: number, detail?: string) {
        super(message);
        this.status = status;
        this.detail = detail;
    }
}

type ApiResponse<T> = {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
};

export async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
    });

    const body: ApiResponse<T> = await res.json();

    if (!res.ok || !body.success) {
        throw new ApiError(body.message || "Request failed", res.status, body.error);
    }

    return body.data as T;
}

import type { Room, JoinRoomResponse, User } from "./types";

const USER_KEY = "ripit_user";

export function setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): User | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as User;
    } catch {
        return null;
    }
}

export function clearSession(): void {
    clearToken();
    localStorage.removeItem(USER_KEY);
}

export async function registerGuest(username: string): Promise<{ user: User; token: string }> {
    const data = await apiFetch<{ user: User; token: string }>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ username }),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
}

export async function createRoom(name: string): Promise<Room> {
    return apiFetch<Room>("/api/v1/rooms", {
        method: "POST",
        body: JSON.stringify({ name }),
    });
}

export async function joinRoomByCode(code: string): Promise<JoinRoomResponse> {
    return apiFetch<JoinRoomResponse>(`/api/v1/rooms/${code}/join`, {
        method: "POST",
    });
}

export async function getRoomByCode(code: string): Promise<Room> {
    return apiFetch<Room>(`/api/v1/rooms/${code}`, {
        method: "GET",
    });
}
// Bastion Desktop API Client
// Mirrors dashboard/lib/api.ts, adapted for Vite env

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://bastion-gamma.vercel.app/v1';

const getApiKey = (): string => {
    const stored = localStorage.getItem('bastion_api_key');
    if (stored) return stored;
    return import.meta.env.VITE_BASTION_API_KEY || '';
};

interface RequestOptions extends RequestInit {
    params?: Record<string, string>;
}

async function fetchAPI<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...init } = options;

    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey(),
        ...(init.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...init, headers });

    if (!res.ok) {
        throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(endpoint: string, params?: Record<string, string>) =>
        fetchAPI<T>(endpoint, { method: 'GET', params }),

    post: <T>(endpoint: string, body: any) =>
        fetchAPI<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),

    put: <T>(endpoint: string, body: any) =>
        fetchAPI<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),

    delete: <T>(endpoint: string) =>
        fetchAPI<T>(endpoint, { method: 'DELETE' }),
};

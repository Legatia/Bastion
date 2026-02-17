export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://bastion-gamma.vercel.app/v1';

// API key comes from local session storage or explicit env config.
const getApiKey = (): string | null => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('bastion_api_key');
        if (stored) return stored;
    }
    return process.env.NEXT_PUBLIC_BASTION_API_KEY || null;
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

    const headers = {
        'Content-Type': 'application/json',
        ...init.headers,
    };

    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('Missing API key. Log in first or set NEXT_PUBLIC_BASTION_API_KEY.');
    }

    (headers as Record<string, string>)['X-API-Key'] = apiKey;

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

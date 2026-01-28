export const API_BASE_URL = 'http://localhost:3000/v1';

// In production/real integration, this comes from ENV or Auth Context
// For now we use a placeholder or read from a local .env file
const getApiKey = () => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('bastion_api_key');
        if (stored) return stored;
    }
    return process.env.NEXT_PUBLIC_BASTION_API_KEY || 'bst_demo_placeholder_key';
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
        'X-API-Key': getApiKey(),
        ...init.headers,
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

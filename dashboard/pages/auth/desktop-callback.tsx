import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Shield, Loader2 } from 'lucide-react';

export default function DesktopCallback() {
    const router = useRouter();
    const [status, setStatus] = useState('Checking authentication...');

    useEffect(() => {
        // Allow time for hydration and storage check
        const checkAuth = () => {
            const apiKey = localStorage.getItem('bastion_api_key');

            if (!apiKey) {
                setStatus('Redirecting to login...');
                // Redirect to login with return URL
                router.push(`/login?redirect=${encodeURIComponent('/auth/desktop-callback')}`);
                return;
            }

            setStatus('Authenticating desktop app...');

            // Construct deep link
            const deepLink = `bastion://auth?token=${apiKey}`;

            // Attempt to open deep link
            window.location.href = deepLink;

            // Optional: Show success message / close window instruction
            setTimeout(() => {
                setStatus('You can close this window now.');
            }, 2000);
        };

        checkAuth();
    }, [router]);

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-4">
            <Head>
                <title>Connecting to Bastion...</title>
            </Head>

            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                    <Shield className="w-8 h-8 text-blue-500" />
                </div>

                <h1 className="text-xl font-bold mb-2">Bastion Authorization</h1>

                <div className="flex items-center gap-2 text-zinc-400 mb-6">
                    {status.includes('close') ? null : <Loader2 className="animate-spin w-4 h-4" />}
                    <p>{status}</p>
                </div>

                <div className="text-sm text-zinc-500">
                    If the desktop app doesn't open, <a href="#" onClick={(e) => {
                        e.preventDefault();
                        const key = localStorage.getItem('bastion_api_key');
                        if (key) window.location.href = `bastion://auth?token=${key}`;
                    }} className="text-blue-500 hover:underline">click here</a>.
                </div>
            </div>
        </div>
    );
}

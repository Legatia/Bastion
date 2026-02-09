import { PrivyProvider } from '@privy-io/react-auth';
import { baseSepolia, base } from 'viem/chains';
import { ReactNode, useState, useEffect } from 'react';

interface PrivyWrapperProps {
    children: ReactNode;
}

export default function PrivyWrapper({ children }: PrivyWrapperProps) {
    const [mounted, setMounted] = useState(false);
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    // Wait for client-side hydration to complete
    useEffect(() => {
        setMounted(true);
    }, []);

    // Always render children during SSR and initial hydration
    // Only wrap with PrivyProvider after mounting on client
    if (!mounted || !appId || appId === 'your-privy-app-id') {
        return <>{children}</>;
    }

    return (
        <PrivyProvider
            appId={appId}
            config={{
                loginMethods: ['email'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#3b82f6',
                    logo: '/Bastion-logo.png',
                },
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'all-users',
                    },
                },
                defaultChain: baseSepolia,
                supportedChains: [baseSepolia, base],
            }}
        >
            {children}
        </PrivyProvider>
    );
}

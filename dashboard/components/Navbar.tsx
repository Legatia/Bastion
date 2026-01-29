import Link from 'next/link';
import { Shield, User } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Navbar() {
    const router = useRouter();
    const isActive = (path: string) => router.pathname === path;
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Check for session
        const key = localStorage.getItem('bastion_api_key');
        setIsLoggedIn(!!key);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('bastion_api_key');
        setIsLoggedIn(false);
        router.push('/');
    };

    return (
        <nav style={{
            position: 'sticky', top: 0, zIndex: 50,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1rem 2rem',
            background: 'rgba(9, 9, 11, 0.6)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
            {/* Logo Area */}
            <Link href="/" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>
                    <Shield color="#3b82f6" size={24} />
                    <span>BASTION</span>
                </div>
            </Link>

            {/* Center Navigation Links */}
            <div style={{
                display: 'flex', gap: '2rem', alignItems: 'center',
                background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1.5rem',
                borderRadius: '999px', border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <Link href="/analytics" style={{ color: isActive('/analytics') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/analytics') ? '600' : '400' }}>
                    Analytics
                </Link>
                <Link href="/agents" style={{ color: isActive('/agents') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/agents') ? '600' : '400' }}>
                    Agents
                </Link>
                <Link href="/policies" style={{ color: isActive('/policies') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/policies') ? '600' : '400' }}>
                    Policies
                </Link>
                <Link href="/logs" style={{ color: isActive('/logs') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/logs') ? '600' : '400' }}>
                    Logs
                </Link>
                <Link href="/referrals" style={{ color: isActive('/referrals') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/referrals') ? '600' : '400' }}>
                    Referrals
                </Link>
                <Link href="/billing" style={{ color: isActive('/billing') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/billing') ? '600' : '400' }}>
                    Billing
                </Link>
                <Link href="/profile" style={{ color: isActive('/profile') ? '#fff' : '#888', textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive('/profile') ? '600' : '400' }}>
                    Profile
                </Link>
            </div>

            {/* Right Actions */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {isLoggedIn ? (
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: '500', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        Logout
                    </button>
                ) : (
                    <Link href="/login" style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#bbb', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: '500', transition: 'all 0.2s', textDecoration: 'none'
                    }}>
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}

function NavLink({ href, label, active }: { href: string, label: string, active: boolean }) {
    return (
        <Link href={href} style={{
            color: active ? '#fff' : '#888',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: '500',
            transition: 'color 0.2s'
        }}>
            {label}
        </Link>
    );
}

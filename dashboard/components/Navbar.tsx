import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Navbar() {
    const router = useRouter();
    const isActive = (path: string) => router.pathname === path;
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        setIsLoggedIn(!!key);
    }, []);

    // Close menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [router.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('bastion_api_key');
        setIsLoggedIn(false);
        router.push('/');
    };

    const linkStyle = (path: string) => ({
        color: isActive(path) ? '#fff' : '#888',
        textDecoration: 'none' as const,
        fontSize: '0.9rem',
        fontWeight: isActive(path) ? '600' : '400' as any,
    });

    const navLinks = (
        <>
            <Link href="/analytics" style={linkStyle('/analytics')}>Analytics</Link>
            <Link href="/agents" style={linkStyle('/agents')}>Agents</Link>
            <Link href="/policies" style={linkStyle('/policies')}>Policies</Link>
            <Link href="/logs" style={linkStyle('/logs')}>Logs</Link>
            <Link href="/referrals" style={linkStyle('/referrals')}>Referrals</Link>
            <a href="https://bastion-docs.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>Docs</a>
            <Link href="/billing" style={linkStyle('/billing')}>Billing</Link>
            <Link href="/profile" style={linkStyle('/profile')}>Profile</Link>
        </>
    );

    return (
        <nav style={{
            position: 'sticky', top: 0, zIndex: 50,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1rem 2rem',
            background: 'rgba(9, 9, 11, 0.6)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>
                    <Image src="/Bastion-logo.png" alt="Bastion Protocol" width={32} height={32} />
                    <span>BASTION</span>
                </div>
            </Link>

            {/* Desktop Links */}
            <div className="nav-links">
                {navLinks}
            </div>

            {/* Hamburger (mobile) */}
            <button className="nav-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Menu */}
            <div className={`nav-mobile-menu ${menuOpen ? 'open' : ''}`}>
                {navLinks}
                {isLoggedIn ? (
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.9rem', fontWeight: '500', marginTop: '0.5rem',
                        }}
                    >
                        Logout
                    </button>
                ) : (
                    <Link href="/login" style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#bbb', padding: '0.75rem 1rem', borderRadius: '8px',
                        fontSize: '0.9rem', fontWeight: '500', textDecoration: 'none', textAlign: 'center',
                        marginTop: '0.5rem', display: 'block',
                    }}>
                        Login
                    </Link>
                )}
            </div>

            {/* Desktop Right Actions */}
            <div className="nav-links" style={{ background: 'none', border: 'none', padding: 0, borderRadius: 0, gap: '1rem' }}>
                {isLoggedIn ? (
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: '500',
                        }}
                    >
                        Logout
                    </button>
                ) : (
                    <Link href="/login" style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#bbb', padding: '0.5rem 1rem', borderRadius: '8px',
                        fontSize: '0.85rem', fontWeight: '500', textDecoration: 'none',
                    }}>
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';

const navLinks = [
    { path: '/', label: 'Dashboard' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/agents', label: 'Agents' },
    { path: '/policies', label: 'Policies' },
    { path: '/logs', label: 'Logs' },
    { path: '/billing', label: 'Billing' },
    { path: '/referrals', label: 'Referrals' },
    { path: '/profile', label: 'Profile' },
];

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const key = localStorage.getItem('bastion_api_key');
        setIsLoggedIn(!!key);
    }, [location]);

    const handleLogout = () => {
        localStorage.removeItem('bastion_api_key');
        setIsLoggedIn(false);
        navigate('/login');
    };

    return (
        <nav className="sticky top-0 z-50 flex justify-between items-center px-6 h-14 bg-zinc-900/60 backdrop-blur-xl border-b border-zinc-800/50">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 text-white font-bold text-lg no-underline">
                <Shield className="text-blue-500" size={22} />
                <span>BASTION</span>
            </Link>

            {/* Center Nav */}
            <div className="flex items-center gap-1 bg-zinc-800/30 px-3 py-1 rounded-full border border-zinc-800/50">
                {navLinks.map((link) => {
                    const active = location.pathname === link.path;
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`px-3 py-1.5 rounded-full text-sm no-underline transition-colors ${active
                                ? 'text-white font-semibold bg-zinc-700/50'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
                {isLoggedIn ? (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
                    >
                        <LogOut size={14} />
                        Logout
                    </button>
                ) : (
                    <Link
                        to="/login"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 bg-zinc-800/50 border border-zinc-700 hover:text-white transition-colors no-underline"
                    >
                        <User size={14} />
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
}

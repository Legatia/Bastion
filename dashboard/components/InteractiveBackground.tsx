import { useEffect, useState } from 'react';

export default function InteractiveBackground() {
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Calculate offset from center (max 15px shift)
            const x = (e.clientX / window.innerWidth - 0.5) * 30;
            const y = (e.clientY / window.innerHeight - 0.5) * 30;
            setOffset({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            top: -20,
            left: -20,
            right: -20,
            bottom: -20,
            zIndex: -1,
            overflow: 'hidden',
            pointerEvents: 'none'
        }}>
            {/* 1. The Image with Parallax Effect */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                backgroundImage: `url('/hero-bg.png')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transform: `translate(${offset.x * -1}px, ${offset.y * -1}px) scale(1.05)`,
                transition: 'transform 0.1s ease-out',
                filter: 'brightness(0.8) contrast(1.2)'
            }} />

            {/* 2. Heavy Dark Overlay for Readability */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(180deg, rgba(5,5,16,0.85) 0%, rgba(5,5,16,0.6) 50%, rgba(5,5,16,0.95) 100%)',
            }} />

            {/* 3. Cyberpunk Grid Overlay */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                backgroundImage: `
          linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)
        `,
                backgroundSize: '50px 50px',
                maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
            }} />

            {/* 4. Scanline Animation */}
            <div className="scanline" />
        </div>
    );
}

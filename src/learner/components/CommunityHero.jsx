import React from 'react';
import { Users, MessageSquare, Sparkles } from 'lucide-react';
import { Avatar, initialsOf } from '../components/LearnerUI.jsx';

/**
 * Hero banner displayed at the top of the Community Hub page.
 * Matches the tai-hero-card anim-fluid-entrance design pattern used by
 * CohortScreen, StudyGroupScreen, and other app pages.
 */
export default function CommunityHero({ user, onCreatePost }) {
  return (
    <div
      className="tai-card tai-hero-card anim-fluid-entrance"
      style={{
        borderRadius: 14,
        padding: 'clamp(18px, 2.5vw, 24px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative radial glow — matches CohortScreen */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
          <Avatar size={52} src={user?.avatarUrl} initials={initialsOf(user?.name || 'You')} />
          <div style={{ minWidth: 0 }}>
            <h1
              className="tai-hero-title"
              style={{ fontSize: 'clamp(18px, 2.2vw, 22px)', fontWeight: 900, letterSpacing: '-0.025em', margin: '0 0 3px', lineHeight: 1.2 }}
            >
              Community Hub
            </h1>
            <p className="tai-hero-desc" style={{ fontSize: 13, margin: 0, lineHeight: 1.45 }}>
              Connect, collaborate, share ideas, and grow together with your peers.
            </p>
          </div>
        </div>

        <div className="tai-hero-subcard" style={{ textAlign: 'right', flexShrink: 0, padding: '10px 16px', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} color="var(--primary)" />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>Train AI Community</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginTop: 2 }}>Share · Discuss · Learn</div>
        </div>
      </div>
    </div>
  );
}

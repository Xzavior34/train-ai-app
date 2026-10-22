import React from 'react';
import { Users, Plus } from 'lucide-react';

/**
 * CommunityHero: Clean, responsive hero banner for the Community Hub.
 * Beautifully matches the application theme in both Light & Dark modes,
 * with compact mobile proportions and zero empty voids.
 */
export default function CommunityHero({ user, onCreatePost }) {
  return (
    <div
      className="tai-card tai-hero-card tai-community-hero-card anim-fluid-entrance"
      style={{
        borderRadius: 14,
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 240px' }}>
          <div className="tai-decoration-icon"
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.18)',
              flexShrink: 0,
            }}
          >
            <Users size={22} color="#FFFFFF" strokeWidth={2.3} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              className="tai-community-hero-title"
              style={{
                fontSize: 'clamp(20px, 2.4vw, 26px)',
                fontWeight: 900,
                letterSpacing: '-0.025em',
                margin: '0 0 2px',
                lineHeight: 1.25,
              }}
            >
              Community Hub
            </h1>
            <p
              className="tai-community-hero-desc"
              style={{
                fontSize: 13.5,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Connect with peers, discuss AI topics, join study groups, and share insights.
            </p>
          </div>
        </div>

        {onCreatePost && (
          <button
            type="button"
            className="tai-btn tai-btn-primary"
            onClick={onCreatePost}
            style={{
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'none',
              flexShrink: 0,
            }}
          >
            <Plus size={14} /> New Discussion
          </button>
        )}
      </div>
    </div>
  );
}

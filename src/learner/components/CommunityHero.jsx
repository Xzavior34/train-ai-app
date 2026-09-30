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
      className="tai-card tai-community-hero-card anim-fluid-entrance"
      style={{
        borderRadius: 14,
        padding: '14px 16px',
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
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)',
              flexShrink: 0,
            }}
          >
            <Users size={22} color="#FFFFFF" strokeWidth={2.3} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
              <h1
                className="tai-community-hero-title"
                style={{
                  fontSize: 'clamp(17px, 2.2vw, 21px)',
                  fontWeight: 900,
                  letterSpacing: '-0.025em',
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                Community Hub
              </h1>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--primary-tint)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                Active Peer Network
              </span>
            </div>
            <p
              className="tai-community-hero-desc"
              style={{
                fontSize: 12.5,
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
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
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

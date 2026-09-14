import React from 'react';
import { Plus } from 'lucide-react';
import { Avatar, initialsOf } from '../components/LearnerUI.jsx';

/**
 * Hero banner displayed at the top of each Community page.
 * Shows a friendly message and a primary call‑to‑action button.
 * The button opens the post composer (handler passed via props).
 */
export default function CommunityHero({ user, onCreatePost }) {
  return (
    <div
      className="tai-card"
      style={{
        padding: '24px 28px',
        background: 'var(--glass-surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: 16,
        boxShadow: 'var(--glass-shadow)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <Avatar
        size={48}
        src={user.avatarUrl}
        initials={initialsOf(user.name || 'You')}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
          Welcome to the Train AI Community!
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text-2)' }}>
          Share ideas, ask questions, and connect with peers.
        </p>
      </div>
      <button
        className="tai-btn tai-btn-primary"
        style={{ height: 40, padding: '0 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={onCreatePost}
      >
        <Plus size={16} />
        New Post
      </button>
    </div>
  );
}

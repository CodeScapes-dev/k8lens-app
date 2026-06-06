'use client';

import React from 'react';

const VIEW_ICONS = {
  Graph: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="2" />
      <circle cx="2.5" cy="4" r="1.5" />
      <circle cx="13.5" cy="4" r="1.5" />
      <circle cx="2.5" cy="12" r="1.5" />
      <circle cx="13.5" cy="12" r="1.5" />
      <line x1="4" y1="4.5" x2="6.3" y2="6.7" />
      <line x1="12" y1="4.5" x2="9.7" y2="6.7" />
      <line x1="4" y1="11.5" x2="6.3" y2="9.3" />
      <line x1="12" y1="11.5" x2="9.7" y2="9.3" />
    </svg>
  ),
};

export function ComingSoon({ view }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, background: 'var(--kl-surface)', border: '1px solid var(--kl-border)', borderRadius: 8 }}>
      <div style={{ opacity: 0.3 }}>{VIEW_ICONS[view]}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--kl-text)' }}>{view} view</div>
      <div style={{ fontSize: 12.5, color: 'var(--kl-text-muted)' }}>This feature is coming soon.</div>
    </div>
  );
}

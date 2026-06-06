'use client';

import React from 'react';
import { flexRender } from '@tanstack/react-table';

export function CardsView({ table, loading, onRowClick }) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--kl-surface)', border: '1px solid var(--kl-border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 14, borderRadius: 4, background: 'var(--kl-surface-2)', width: '60%', animation: 'kl-pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: 10, borderRadius: 4, background: 'var(--kl-surface-2)', width: '40%', animation: 'kl-pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: 10, borderRadius: 4, background: 'var(--kl-surface-2)', width: '80%', animation: 'kl-pulse 1.4s ease-in-out infinite' }} />
          </div>
        ))}
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--kl-text-muted)', fontSize: 13 }}>
        No resources found
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
      {rows.map((row) => {
        const visibleCells = row.getVisibleCells();
        const [primaryCell, ...restCells] = visibleCells;
        const nsCellIdx = restCells.findIndex((c) => c.column.id === 'namespace');
        const nsCell = nsCellIdx >= 0 ? restCells[nsCellIdx] : null;
        const bodyCells = restCells.filter((c) => c.column.id !== 'namespace');

        return (
          <div
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            style={{
              background: 'var(--kl-surface)',
              border: '1px solid var(--kl-border)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--kl-surface-2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--kl-surface)'; }}
          >
            {/* Header: name + namespace */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'var(--kl-mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--kl-accent)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
              </div>
              {nsCell && (
                <div style={{ fontFamily: 'var(--kl-mono)', fontSize: 10.5, color: 'var(--kl-text-muted)', flexShrink: 0, paddingTop: 1 }}>
                  {flexRender(nsCell.column.columnDef.cell, nsCell.getContext())}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--kl-border)', margin: '0 -2px' }} />

            {/* Body: key-value grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
              {bodyCells.map((cell) => {
                const header = typeof cell.column.columnDef.header === 'string'
                  ? cell.column.columnDef.header
                  : cell.column.id.charAt(0).toUpperCase() + cell.column.id.slice(1);
                return (
                  <div key={cell.id} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, fontFamily: 'var(--kl-mono)', color: 'var(--kl-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{header}</div>
                    <div style={{ fontSize: 12, fontFamily: cell.column.columnDef.meta?.mono ? 'var(--kl-mono)' : 'var(--kl-sans)', color: 'var(--kl-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

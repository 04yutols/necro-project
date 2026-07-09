'use client';

import React from 'react';

type Props = {
  label: string;
  children: React.ReactNode;
};

export default function FormField({ label, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          color: '#a0a0c0',
          fontSize: 13,
          display: 'block',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

'use client';

import React from 'react';

type Props = {
  label: string;
  children: React.ReactNode;
};

export default function FormField({ label, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ color: '#7878a8', fontSize: 11, display: 'block', fontFamily: 'Space Grotesk, sans-serif' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

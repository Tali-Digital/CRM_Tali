import React from 'react';
import logoUrl from '../logo.png';

export const Logo: React.FC<{ className?: string }> = ({ className = "h-8" }) => {
  return (
    <img 
      src={logoUrl} 
      alt="Tali Logo" 
      className={className} 
      style={{ objectFit: 'contain' }}
      referrerPolicy="no-referrer"
    />
  );
};

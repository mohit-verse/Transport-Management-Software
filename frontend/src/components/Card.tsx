import React from 'react';

export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 font-semibold text-gray-900 ${className}`}>
      {children}
    </div>
  );
};

export const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
};

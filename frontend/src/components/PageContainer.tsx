import React from 'react';
import { cn } from '../utils/utils';

interface PageContainerProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  children,
  actions,
  className,
}) => {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      <header className="flex items-center justify-between pb-6 mb-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
};

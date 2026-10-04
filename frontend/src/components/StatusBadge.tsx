import React from 'react';
import { cn } from '../utils/utils';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        {
          'bg-green-100 text-green-800': status === 'success',
          'bg-yellow-100 text-yellow-800': status === 'warning',
          'bg-red-100 text-red-800': status === 'error',
          'bg-blue-100 text-blue-800': status === 'info',
          'bg-gray-100 text-gray-800': status === 'default',
        },
        className
      )}
    >
      {label}
    </span>
  );
};

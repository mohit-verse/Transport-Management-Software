
import { cn } from '../utils/utils';

export type StatusType = 
  | 'success' | 'warning' | 'error' | 'info' | 'default'
  | 'CREATED' | 'LOADING' | 'IN_TRANSIT' | 'COMPLETED' | 'SETTLED' | 'CANCELLED';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const getStyle = () => {
    switch (status) {
      case 'success': case 'COMPLETED': case 'SETTLED': return 'bg-green-100 text-green-800';
      case 'warning': case 'LOADING': return 'bg-yellow-100 text-yellow-800';
      case 'error': case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'info': case 'IN_TRANSIT': return 'bg-blue-100 text-blue-800';
      case 'default': case 'CREATED': default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLabel = () => {
    if (label) return label;
    switch (status) {
      case 'CREATED': return 'Created';
      case 'LOADING': return 'Loading';
      case 'IN_TRANSIT': return 'In Transit';
      case 'COMPLETED': return 'Completed';
      case 'SETTLED': return 'Settled';
      case 'CANCELLED': return 'Cancelled';
      default: return String(status);
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        getStyle(),
        className
      )}
    >
      {getLabel()}
    </span>
  );
};

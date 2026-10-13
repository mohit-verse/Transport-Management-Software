import React from 'react';
import { cn } from '../utils/utils';

interface AmountDisplayProps {
  amount: number | string;
  className?: string;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({ amount, className }) => {
  const num = typeof amount === 'number' ? amount : (parseFloat(String(amount)) || 0);
  const isNegative = num < 0;
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Math.abs(num));

  return (
    <span
      className={cn(
        'font-mono font-medium',
        isNegative ? 'text-red-600' : 'text-gray-900',
        className
      )}
    >
      {isNegative ? '-' : ''}{formattedAmount}
    </span>
  );
};

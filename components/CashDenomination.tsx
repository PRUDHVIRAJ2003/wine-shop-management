'use client';

import { Input } from './ui/Input';
import { Label } from './ui/Label';

interface Denomination {
  value: number;
  count: number;
}

interface CashDenominationProps {
  denominations: {
    denom_500: number;
    denom_200: number;
    denom_100: number;
    denom_50: number;
    denom_20: number;
    denom_10: number;
    denom_5: number;
    denom_2: number;
    denom_1: number;
  };
  onUpdate: (field: string, value: number) => void;
  isLocked: boolean;
}

export default function CashDenomination({ denominations, onUpdate, isLocked }: CashDenominationProps) {
  const denoms: { label: string; field: keyof typeof denominations; value: number }[] = [
    { label: '₹500', field: 'denom_500', value: 500 },
    { label: '₹200', field: 'denom_200', value: 200 },
    { label: '₹100', field: 'denom_100', value: 100 },
    { label: '₹50', field: 'denom_50', value: 50 },
    { label: '₹20', field: 'denom_20', value: 20 },
    { label: '₹10', field: 'denom_10', value: 10 },
    { label: '₹5', field: 'denom_5', value: 5 },
    { label: '₹2', field: 'denom_2', value: 2 },
    { label: '₹1', field: 'denom_1', value: 1 },
  ];

  const totalCash = denoms.reduce((sum, d) => sum + (denominations[d.field] * d.value), 0);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">Cash Denomination</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {denoms.map((denom) => (
          <div key={denom.field} className="flex items-center space-x-2">
            <Label className="w-16 text-right">{denom.label}</Label>
            <span className="text-gray-500">×</span>
            <Input
              type="number"
              value={denominations[denom.field]}
              onChange={(e) => onUpdate(denom.field, parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-24 h-9"
              min="0"
            />
            <span className="text-sm text-gray-600 w-24 text-right">
              = ₹{(denominations[denom.field] * denom.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t pt-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span className="text-primary">Total Cash:</span>
          <span className="text-secondary">₹{totalCash.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

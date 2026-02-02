'use client';

import { Input } from './ui/Input';
import { Label } from './ui/Label';

interface CashDenominationProps {
  denominations: {
    denom_500: number;
    denom_200: number;
    denom_100: number;
    denom_50: number;
    denom_20: number;
    denom_10: number;
    coins: number;
    digital_payments?: number; // Maps to phonepe_paytm in database
  };
  onUpdate: (field: string, value: number) => void;
  isLocked: boolean;
}

export default function CashDenomination({ denominations, onUpdate, isLocked }: CashDenominationProps) {
  const denoms: { label: string; field: keyof typeof denominations; value: number; isAmount?: boolean }[] = [
    { label: '₹500', field: 'denom_500', value: 500 },
    { label: '₹200', field: 'denom_200', value: 200 },
    { label: '₹100', field: 'denom_100', value: 100 },
    { label: '₹50', field: 'denom_50', value: 50 },
    { label: '₹20', field: 'denom_20', value: 20 },
    { label: '₹10', field: 'denom_10', value: 10 },
    { label: 'Coins', field: 'coins', value: 1, isAmount: true },
    // Note: 'digital_payments' in UI maps to 'phonepe_paytm' field in database for backward compatibility
    { label: 'PhonePe/GPay/Paytm/Other Digital', field: 'digital_payments', value: 1, isAmount: true },
  ];

  const totalCash = denoms.reduce((sum, d) => {
    if (d.isAmount) {
      return sum + (denominations[d.field] || 0);
    }
    return sum + ((denominations[d.field] || 0) * d.value);
  }, 0);

  // Calculate physical cash only (excluding digital payments)
  const physicalCashOnly = (
    (denominations.denom_500 || 0) * 500 +
    (denominations.denom_200 || 0) * 200 +
    (denominations.denom_100 || 0) * 100 +
    (denominations.denom_50 || 0) * 50 +
    (denominations.denom_20 || 0) * 20 +
    (denominations.denom_10 || 0) * 10 +
    (denominations.coins || 0)
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">Cash Denomination</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {denoms.map((denom) => (
          <div key={denom.field} className={`flex items-center space-x-2 ${denom.field === 'digital_payments' ? 'col-span-full' : ''}`}>
            <Label className={`${denom.field === 'digital_payments' ? 'w-auto' : 'w-16'} text-right`}>{denom.label}</Label>
            {!denom.isAmount && <span className="text-gray-500">×</span>}
            {denom.isAmount && <span className="text-gray-500 invisible">×</span>}
            <Input
              type="number"
              value={denominations[denom.field] === 0 ? '' : denominations[denom.field]}
              placeholder="0"
              onChange={(e) => onUpdate(denom.field, parseInt(e.target.value) || 0)}
              disabled={isLocked}
              className="w-24 h-9"
              min="0"
            />
            <span className="text-sm text-gray-600 w-24 text-right">
              {denom.isAmount ? '' : `= ₹${((denominations[denom.field] || 0) * denom.value).toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>
      
      {/* Total Physical Cash Display (excluding digital payments) */}
      <div className="col-span-full border-t pt-4 mt-4">
        <div className="flex justify-between items-center bg-amber-50 p-4 rounded-lg">
          <span className="font-semibold text-gray-700">Total Physical Cash (Denominations Only):</span>
          <span className="text-2xl font-bold text-primary">
            {formatCurrency(physicalCashOnly)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          (This is the physical cash count - does NOT include digital payments)
        </p>
      </div>

      {/* Total Cash Including Digital Payments */}
      <div className="border-t pt-4 mt-4">
        <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg">
          <span className="font-semibold text-gray-700">Total Cash (Physical + Digital):</span>
          <span className="text-2xl font-bold text-green-600">
            {formatCurrency(totalCash)}
          </span>
        </div>
      </div>
    </div>
  );
}

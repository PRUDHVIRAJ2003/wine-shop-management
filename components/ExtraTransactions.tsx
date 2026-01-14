'use client';

import { ExtraTransaction } from '@/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Trash2, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ExtraTransactionsProps {
  transactions: Omit<ExtraTransaction, 'id' | 'cash_entry_id' | 'created_at'>[];
  onAdd: () => void;
  onDelete: (index: number) => void;
  onUpdate: (index: number, field: string, value: string | number) => void;
  isLocked: boolean;
}

export default function ExtraTransactions({
  transactions,
  onAdd,
  onDelete,
  onUpdate,
  isLocked,
}: ExtraTransactionsProps) {
  const totalIncome = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-primary">Extra Transactions</h3>
        <Button
          onClick={onAdd}
          disabled={isLocked}
          size="sm"
          className="flex items-center space-x-1"
        >
          <Plus size={16} />
          <span>Add</span>
        </Button>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction, index) => (
          <div key={index} className="grid grid-cols-12 gap-3 items-center">
            {/* Type dropdown - 3 columns */}
            <div className="col-span-3">
              <Select
                value={transaction.transaction_type}
                onChange={(e) => onUpdate(index, 'transaction_type', e.target.value)}
                disabled={isLocked}
              >
                <option value="income">(+) Income</option>
                <option value="expense">(-) Expense</option>
              </Select>
            </div>

            {/* Description - 6 columns (BIGGER) */}
            <div className="col-span-6">
              <Input
                type="text"
                value={transaction.description}
                onChange={(e) => onUpdate(index, 'description', e.target.value)}
                placeholder="Enter description..."
                disabled={isLocked}
                className="w-full"
              />
            </div>

            {/* Amount - 2 columns */}
            <div className="col-span-2">
              <Input
                type="number"
                value={transaction.amount}
                onChange={(e) => onUpdate(index, 'amount', parseFloat(e.target.value) || 0)}
                placeholder="Amount"
                disabled={isLocked}
                min="0"
                step="0.01"
              />
            </div>

            {/* Delete button - 1 column */}
            <div className="col-span-1">
              <Button
                variant="destructive"
                size="icon"
                onClick={() => onDelete(index)}
                disabled={isLocked}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}

        {transactions.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No extra transactions added
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t space-y-2">
        <div className="flex justify-between items-center text-green-600">
          <span className="font-medium">Total Extra Income:</span>
          <span className="font-bold">{formatCurrency(totalIncome)}</span>
        </div>
        <div className="flex justify-between items-center text-red-600">
          <span className="font-medium">Total Expenses:</span>
          <span className="font-bold">{formatCurrency(totalExpense)}</span>
        </div>
      </div>
    </div>
  );
}

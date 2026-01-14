'use client';

import { DailyStockEntry, Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Input } from './ui/Input';

interface StockEntryTableProps {
  entries: (DailyStockEntry & { product?: Product })[];
  onUpdate: (id: string, field: string, value: number) => void;
  isLocked: boolean;
  brandFilter: string;
  sizeFilter: string;
  typeFilter?: string;
}

export default function StockEntryTable({
  entries,
  onUpdate,
  isLocked,
  brandFilter,
  sizeFilter,
  typeFilter = '',
}: StockEntryTableProps) {
  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesBrand = !brandFilter || 
      entry.product?.brand_name.toLowerCase().includes(brandFilter.toLowerCase());
    const matchesSize = !sizeFilter || 
      entry.product?.product_size?.size_ml.toString() === sizeFilter;
    const matchesType = !typeFilter || 
      entry.product?.product_type?.name === typeFilter;
    return matchesBrand && matchesSize && matchesType;
  });

  // Calculate totals
  const totals = filteredEntries.reduce(
    (acc, entry) => ({
      opening_stock: acc.opening_stock + entry.opening_stock,
      purchases: acc.purchases + entry.purchases,
      transfer: acc.transfer + entry.transfer,
      closing_stock: acc.closing_stock + entry.closing_stock,
      sold_qty: acc.sold_qty + entry.sold_qty,
      sale_value: acc.sale_value + entry.sale_value,
      closing_stock_value: acc.closing_stock_value + entry.closing_stock_value,
    }),
    {
      opening_stock: 0,
      purchases: 0,
      transfer: 0,
      closing_stock: 0,
      sold_qty: 0,
      sale_value: 0,
      closing_stock_value: 0,
    }
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary text-white sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left">S.No</th>
              <th className="px-3 py-3 text-left">Brand Name</th>
              <th className="px-3 py-3 text-left">Type</th>
              <th className="px-3 py-3 text-left">Size (ml)</th>
              <th className="px-3 py-3 text-right">MRP</th>
              <th className="px-3 py-3 text-right">Opening Stock</th>
              <th className="px-3 py-3 text-right">Purchases</th>
              <th className="px-3 py-3 text-right">Transfer</th>
              <th className="px-3 py-3 text-right">Closing Stock</th>
              <th className="px-3 py-3 text-right">Sold QTY</th>
              <th className="px-3 py-3 text-right">Sale Value</th>
              <th className="px-3 py-3 text-right">Closing Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry, index) => (
              <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 font-medium">{entry.product?.brand_name}</td>
                <td className="px-3 py-2">{entry.product?.product_type?.name}</td>
                <td className="px-3 py-2 text-right">{entry.product?.product_size?.size_ml}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(entry.product?.mrp || 0)}</td>
                <td className="px-3 py-2 text-right bg-gray-100">{entry.opening_stock}</td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={entry.purchases === 0 ? '' : entry.purchases}
                    placeholder="0"
                    onChange={(e) => onUpdate(entry.id, 'purchases', parseInt(e.target.value) || 0)}
                    disabled={isLocked}
                    className="w-20 h-8 text-right p-1"
                    min="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={entry.transfer === 0 ? '' : entry.transfer}
                    placeholder="0"
                    onChange={(e) => onUpdate(entry.id, 'transfer', parseInt(e.target.value) || 0)}
                    disabled={isLocked}
                    className="w-20 h-8 text-right p-1"
                    min="0"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={entry.closing_stock === 0 ? '' : entry.closing_stock}
                    placeholder="0"
                    onChange={(e) => onUpdate(entry.id, 'closing_stock', parseInt(e.target.value) || 0)}
                    disabled={isLocked}
                    className="w-20 h-8 text-right p-1"
                    min="0"
                  />
                </td>
                <td className={`px-3 py-2 text-right font-medium ${
                  entry.sold_qty < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {entry.sold_qty}
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(entry.sale_value)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(entry.closing_stock_value)}</td>
              </tr>
            ))}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                  No products found
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-secondary text-white font-bold sticky bottom-0">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right">TOTALS:</td>
              <td className="px-3 py-3 text-right">{totals.opening_stock}</td>
              <td className="px-3 py-3 text-right">{totals.purchases}</td>
              <td className="px-3 py-3 text-right">{totals.transfer}</td>
              <td className="px-3 py-3 text-right">{totals.closing_stock}</td>
              <td className="px-3 py-3 text-right">{totals.sold_qty}</td>
              <td className="px-3 py-3 text-right">{formatCurrency(totals.sale_value)}</td>
              <td className="px-3 py-3 text-right">{formatCurrency(totals.closing_stock_value)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

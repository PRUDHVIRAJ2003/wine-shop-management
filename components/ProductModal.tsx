'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProductType, ProductSize } from '@/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Label } from './ui/Label';
import { X, Plus } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  onProductAdded: () => void;
}

export default function ProductModal({ isOpen, onClose, shopId, onProductAdded }: ProductModalProps) {
  const supabase = createClient();
  
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [productSizes, setProductSizes] = useState<ProductSize[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    brand_name: '',
    type_id: '',
    size_id: '',
    mrp: '',
  });
  
  const [showAddType, setShowAddType] = useState(false);
  const [showAddSize, setShowAddSize] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newSizeValue, setNewSizeValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProductTypesAndSizes();
    }
  }, [isOpen]);

  const loadProductTypesAndSizes = async () => {
    // Load product types
    const { data: typesData } = await supabase
      .from('product_types')
      .select('*')
      .order('name');
    
    if (typesData) {
      setProductTypes(typesData);
    }

    // Load product sizes
    const { data: sizesData } = await supabase
      .from('product_sizes')
      .select('*')
      .order('size_ml');
    
    if (sizesData) {
      setProductSizes(sizesData);
    }
  };

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;

    const { data, error } = await supabase
      .from('product_types')
      .insert({ name: newTypeName.trim() })
      .select()
      .single();

    if (!error && data) {
      setProductTypes([...productTypes, data]);
      setFormData({ ...formData, type_id: data.id });
      setNewTypeName('');
      setShowAddType(false);
    }
  };

  const handleAddSize = async () => {
    const sizeValue = parseInt(newSizeValue);
    if (!sizeValue || sizeValue <= 0) return;

    const { data, error } = await supabase
      .from('product_sizes')
      .insert({ size_ml: sizeValue })
      .select()
      .single();

    if (!error && data) {
      setProductSizes([...productSizes, data].sort((a, b) => a.size_ml - b.size_ml));
      setFormData({ ...formData, size_id: data.id });
      setNewSizeValue('');
      setShowAddSize(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('products')
        .insert({
          brand_name: formData.brand_name,
          type_id: formData.type_id,
          size_id: formData.size_id,
          mrp: parseFloat(formData.mrp),
          shop_id: shopId,
          is_active: true,
        });

      if (error) throw error;

      alert('Product added successfully!');
      setFormData({
        brand_name: '',
        type_id: '',
        size_id: '',
        mrp: '',
      });
      onProductAdded();
      onClose();
    } catch (error: any) {
      alert('Error adding product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-primary">Add Product</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={24} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="brand_name">Brand Name</Label>
            <Input
              id="brand_name"
              type="text"
              value={formData.brand_name}
              onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
              placeholder="e.g., Kingfisher, Royal Stag"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="type_id">Type</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowAddType(!showAddType)}
              >
                <Plus size={16} className="mr-1" />
                Add New
              </Button>
            </div>
            
            {showAddType ? (
              <div className="flex space-x-2">
                <Input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Enter new type name"
                />
                <Button type="button" onClick={handleAddType} size="sm">
                  Add
                </Button>
                <Button type="button" onClick={() => setShowAddType(false)} size="sm" variant="outline">
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                id="type_id"
                value={formData.type_id}
                onChange={(e) => setFormData({ ...formData, type_id: e.target.value })}
                required
              >
                <option value="">Select Type</option>
                {productTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <Label htmlFor="size_id">Size</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowAddSize(!showAddSize)}
              >
                <Plus size={16} className="mr-1" />
                Add New
              </Button>
            </div>
            
            {showAddSize ? (
              <div className="flex space-x-2">
                <Input
                  type="number"
                  value={newSizeValue}
                  onChange={(e) => setNewSizeValue(e.target.value)}
                  placeholder="Enter size in ml"
                />
                <Button type="button" onClick={handleAddSize} size="sm">
                  Add
                </Button>
                <Button type="button" onClick={() => setShowAddSize(false)} size="sm" variant="outline">
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                id="size_id"
                value={formData.size_id}
                onChange={(e) => setFormData({ ...formData, size_id: e.target.value })}
                required
              >
                <option value="">Select Size</option>
                {productSizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.size_ml} ml
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="mrp">MRP (₹)</Label>
            <Input
              id="mrp"
              type="number"
              value={formData.mrp}
              onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

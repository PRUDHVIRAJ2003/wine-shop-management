'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User, Shop, Product, ProductType, ProductSize } from '@/types';
import AdminSidebar from '@/components/AdminSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { Trash2, Plus, Filter } from 'lucide-react';

export default function ProductManagementPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [productSizes, setProductSizes] = useState<ProductSize[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [shopFilter, setShopFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  // Form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showSizeForm, setShowSizeForm] = useState(false);
  
  const [productForm, setProductForm] = useState({
    brand_name: '',
    type_id: '',
    size_id: '',
    mrp: 0,
    shop_id: '',
  });

  const [newType, setNewType] = useState('');
  const [newSize, setNewSize] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      router.push('/login');
      return;
    }

    setUser(userData);
    loadData();
    setLoading(false);
  };

  const loadData = async () => {
    // Load products
    const { data: productsData } = await supabase
      .from('products')
      .select(`
        *,
        product_type:product_types(*),
        product_size:product_sizes(*),
        shop:shops(*)
      `)
      .order('brand_name');

    if (productsData) {
      setProducts(productsData as any);
    }

    // Load shops
    const { data: shopsData } = await supabase
      .from('shops')
      .select('*')
      .order('name');

    if (shopsData) {
      setShops(shopsData);
      if (shopsData.length > 0 && !shopFilter) {
        setShopFilter(shopsData[0].id);
      }
    }

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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('products')
      .insert({
        ...productForm,
        is_active: true,
      });

    if (!error) {
      setShowProductForm(false);
      setProductForm({
        brand_name: '',
        type_id: '',
        size_id: '',
        mrp: 0,
        shop_id: '',
      });
      loadData();
    } else {
      alert('Error adding product: ' + error.message);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('product_types')
      .insert({ name: newType });

    if (!error) {
      setShowTypeForm(false);
      setNewType('');
      loadData();
    } else {
      alert('Error adding type: ' + error.message);
    }
  };

  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('product_sizes')
      .insert({ size_ml: newSize });

    if (!error) {
      setShowSizeForm(false);
      setNewSize(0);
      loadData();
    } else {
      alert('Error adding size: ' + error.message);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (!error) {
      loadData();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filteredProducts = products.filter(
    (p) =>
      (!shopFilter || (p as any).shop?.id === shopFilter) &&
      (!typeFilter || p.type_id === typeFilter)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <AdminSidebar onSignOut={handleSignOut} />

      <main className="flex-1 p-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">Product Management</h1>
              <p className="text-gray-600">Manage products, types, and sizes</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowTypeForm(!showTypeForm)}>
                <Plus size={20} className="mr-2" />
                Add Type
              </Button>
              <Button variant="outline" onClick={() => setShowSizeForm(!showSizeForm)}>
                <Plus size={20} className="mr-2" />
                Add Size
              </Button>
              <Button onClick={() => setShowProductForm(!showProductForm)}>
                <Plus size={20} className="mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </div>

        {/* Add Type Form */}
        {showTypeForm && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Add New Product Type</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddType} className="flex space-x-4">
                <Input
                  type="text"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Type name (e.g., Wine, Gin)"
                  required
                  className="flex-1"
                />
                <Button type="submit">Add Type</Button>
                <Button type="button" variant="outline" onClick={() => setShowTypeForm(false)}>
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Add Size Form */}
        {showSizeForm && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Add New Product Size</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSize} className="flex space-x-4">
                <Input
                  type="number"
                  value={newSize}
                  onChange={(e) => setNewSize(parseInt(e.target.value))}
                  placeholder="Size in ml (e.g., 750)"
                  required
                  className="flex-1"
                />
                <Button type="submit">Add Size</Button>
                <Button type="button" variant="outline" onClick={() => setShowSizeForm(false)}>
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Add Product Form */}
        {showProductForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add New Product</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddProduct} className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="brand_name">Brand Name</Label>
                  <Input
                    id="brand_name"
                    type="text"
                    value={productForm.brand_name}
                    onChange={(e) => setProductForm({ ...productForm, brand_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="type_id">Type</Label>
                  <Select
                    id="type_id"
                    value={productForm.type_id}
                    onChange={(e) => setProductForm({ ...productForm, type_id: e.target.value })}
                    required
                  >
                    <option value="">Select Type</option>
                    {productTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="size_id">Size</Label>
                  <Select
                    id="size_id"
                    value={productForm.size_id}
                    onChange={(e) => setProductForm({ ...productForm, size_id: e.target.value })}
                    required
                  >
                    <option value="">Select Size</option>
                    {productSizes.map((size) => (
                      <option key={size.id} value={size.id}>
                        {size.size_ml} ml
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor="mrp">MRP (₹)</Label>
                  <Input
                    id="mrp"
                    type="number"
                    value={productForm.mrp}
                    onChange={(e) => setProductForm({ ...productForm, mrp: parseFloat(e.target.value) })}
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="shop_id">Shop</Label>
                  <Select
                    id="shop_id"
                    value={productForm.shop_id}
                    onChange={(e) => setProductForm({ ...productForm, shop_id: e.target.value })}
                    required
                  >
                    <option value="">Select Shop</option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="col-span-2 flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowProductForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Product</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Filter size={20} className="text-gray-500" />
              <div>
                <Label>Shop</Label>
                <Select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
                  <option value="">All Shops</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">All Types</option>
                  {productTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        <Card>
          <CardHeader>
            <CardTitle>Products ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRP</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product: any) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{product.brand_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{product.product_type?.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{product.product_size?.size_ml} ml</td>
                      <td className="px-6 py-4 whitespace-nowrap">₹{product.mrp.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{product.shop?.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          product.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No products found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

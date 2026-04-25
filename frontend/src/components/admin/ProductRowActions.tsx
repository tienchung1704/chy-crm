'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { apiClientClient } from '@/lib/apiClientClient';

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
}

interface Size {
  id: string;
  name: string;
}

interface Color {
  id: string;
  name: string;
  hexCode?: string | null;
}

interface ProductVariant {
  id: string;
  sizeId: string | null;
  colorId: string | null;
  price: number | null;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  originalPrice: number;
  salePrice: number | null;
  stockQuantity: number;
  weight: number;
  imageUrl: string | null;
  isComboSet: boolean;
  isGiftItem: boolean;
  isActive: boolean;
  categories: { id: string; name: string }[];
  variants: ProductVariant[];
}

interface ProductRowActionsProps {
  product: Product;
  allCategories: Category[];
}

export default function ProductRowActions({ product, allCategories }: ProductRowActionsProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  
  const [newSizeName, setNewSizeName] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  const getCategoryPath = (categoryId: string): string[] => {
    const path: string[] = [];
    let currentId: string | null | undefined = categoryId;
    
    while (currentId) {
      path.unshift(currentId);
      const cat = allCategories.find(c => c.id === currentId);
      currentId = cat?.parentId;
    }
    
    return path;
  };

  const initCategoryLevels = () => {
    if (product.categories.length === 0) {
      return { categoryLevel1: '', categoryLevel2: '', categoryLevel3: '', categoryLevel4: '' };
    }
    
    const path = getCategoryPath(product.categories[0].id);
    return {
      categoryLevel1: path[0] || '',
      categoryLevel2: path[1] || '',
      categoryLevel3: path[2] || '',
      categoryLevel4: path[3] || '',
    };
  };

  const [form, setForm] = useState({
    name: product.name,
    slug: product.slug,
    sku: product.sku || '',
    description: product.description || '',
    originalPrice: product.originalPrice.toString(),
    salePrice: product.salePrice?.toString() || '',
    stockQuantity: product.stockQuantity.toString(),
    weight: product.weight?.toString() || '500',
    imageUrl: product.imageUrl || '',
    ...initCategoryLevels(),
    isComboSet: product.isComboSet,
    isGiftItem: product.isGiftItem,
    isActive: product.isActive,
    variants: product.variants.map(v => ({ 
      id: v.id, 
      sizeId: v.sizeId || '', 
      colorId: v.colorId || '', 
      price: v.price?.toString() || '', 
      stock: v.stock.toString() 
    })),
  });

  useEffect(() => {
    if (showEditModal) {
      apiClientClient.get<any[]>('/sizes').then(setSizes).catch(console.error);
      apiClientClient.get<any[]>('/colors').then(setColors).catch(console.error);
    }
  }, [showEditModal]);

  const handleCreateSize = async () => {
    if (!newSizeName.trim()) return;
    try {
      const newSize = await apiClientClient.post<any>('/sizes', { name: newSizeName });
      setSizes([...sizes, newSize]);
      setNewSizeName('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create size');
    }
  };

  const handleCreateColor = async () => {
    if (!newColorName.trim()) return;
    try {
      const newColor = await apiClientClient.post<any>('/colors', { name: newColorName, hexCode: newColorHex });
      setColors([...colors, newColor]);
      setNewColorName('');
      setNewColorHex('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create color');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const selectedCategoryId = form.categoryLevel4 || form.categoryLevel3 || form.categoryLevel2 || form.categoryLevel1;
      const categoryIds = selectedCategoryId ? [selectedCategoryId] : [];

      await apiClientClient.patch<any>(`/products/${product.id}`, {
        name: form.name,
        slug: form.slug,
        sku: form.sku,
        description: form.description,
        originalPrice: parseFloat(form.originalPrice),
        salePrice: form.salePrice ? parseFloat(form.salePrice) : null,
        weight: parseInt(form.weight) || 500,
        stockQuantity: form.variants.length > 0 
          ? form.variants.reduce((acc, v) => acc + (parseInt(v.stock) || 0), 0)
          : (parseInt(form.stockQuantity) || 0),
        imageUrl: form.imageUrl,
        categoryIds,
        isComboSet: form.isComboSet,
        isGiftItem: form.isGiftItem,
        isActive: form.isActive,
        variants: form.variants,
      });

      setShowEditModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi cập nhật sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError('');

    try {
      await apiClientClient.delete<any>(`/products/${product.id}`);
      setShowDeleteModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi xóa sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: any) => {
    setForm(prev => {
      const newForm = { ...prev, [field]: value };
      
      if (field === 'categoryLevel1') {
        newForm.categoryLevel2 = '';
        newForm.categoryLevel3 = '';
        newForm.categoryLevel4 = '';
      } else if (field === 'categoryLevel2') {
        newForm.categoryLevel3 = '';
        newForm.categoryLevel4 = '';
      } else if (field === 'categoryLevel3') {
        newForm.categoryLevel4 = '';
      }
      
      return newForm;
    });
  };

  const addVariant = () => {
    setForm(prev => ({
      ...prev,
      variants: [...prev.variants, { id: Date.now().toString(), sizeId: '', colorId: '', price: '', stock: '0' }]
    }));
  };

  const removeVariant = (id: string) => {
    setForm(prev => ({ ...prev, variants: prev.variants.filter(v => v.id !== id) }));
  };

  const updateVariant = (id: string, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const getLevel1Categories = () => allCategories.filter(c => !c.parentId);
  const getLevel2Categories = () => form.categoryLevel1 ? allCategories.filter(c => c.parentId === form.categoryLevel1) : [];
  const getLevel3Categories = () => form.categoryLevel2 ? allCategories.filter(c => c.parentId === form.categoryLevel2) : [];
  const getLevel4Categories = () => form.categoryLevel3 ? allCategories.filter(c => c.parentId === form.categoryLevel3) : [];

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowEditModal(true)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Sửa
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Xóa"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <div className="bg-white md:rounded-xl shadow-xl w-full max-w-4xl h-full md:h-auto max-h-[100vh] md:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Sửa Sản phẩm</h2>
              <button 
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none" 
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <span>⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-name">
                      Tên sản phẩm *
                    </label>
                    <input 
                      id="edit-name" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required
                      value={form.name} 
                      onChange={e => update('name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-sku">
                      SKU
                    </label>
                    <input 
                      id="edit-sku" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm" 
                      value={form.sku} 
                      onChange={e => update('sku', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-slug">
                    Slug *
                  </label>
                  <input 
                    id="edit-slug" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm" 
                    required
                    value={form.slug} 
                    onChange={e => update('slug', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-price">
                      Giá gốc (VNĐ) *
                    </label>
                    <input 
                      id="edit-price" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required
                      value={form.originalPrice} 
                      onChange={e => update('originalPrice', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-sale">
                      Giá sale (VNĐ)
                    </label>
                    <input 
                      id="edit-sale" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.salePrice} 
                      onChange={e => update('salePrice', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-weight">
                      Trọng lượng (g)
                    </label>
                    <input 
                      id="edit-weight" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.weight} 
                      onChange={e => update('weight', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-stock">
                      Tồn kho (Mặc định)
                    </label>
                    <input 
                      id="edit-stock" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      value={form.variants.length > 0 ? form.variants.reduce((a, v) => a + (parseInt(v.stock) || 0), 0) : form.stockQuantity} 
                      onChange={e => update('stockQuantity', e.target.value)}
                      disabled={form.variants.length > 0}
                    />
                    {form.variants.length > 0 && <p className="text-xs text-gray-500 mt-1">Tự động tính từ các biến thể</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hình ảnh sản phẩm
                  </label>
                  <ImageUpload
                    value={form.imageUrl}
                    onChange={(url) => update('imageUrl', url)}
                    endpoint="productImage"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-desc">
                    Mô tả
                  </label>
                  <textarea 
                    id="edit-desc" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    rows={3}
                    value={form.description} 
                    onChange={e => update('description', e.target.value)}
                  />
                </div>

                {allCategories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Danh mục sản phẩm
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Level 1 */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Cấp 1 (Root)</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          value={form.categoryLevel1}
                          onChange={e => update('categoryLevel1', e.target.value)}
                        >
                          <option value="">-- Chọn danh mục --</option>
                          {getLevel1Categories().map(cat => (
                            <option key={cat.id} value={cat.id}>📁 {cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Level 2 */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Cấp 2</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100"
                          value={form.categoryLevel2}
                          onChange={e => update('categoryLevel2', e.target.value)}
                          disabled={!form.categoryLevel1}
                        >
                          <option value="">-- Không chọn --</option>
                          {getLevel2Categories().map(cat => (
                            <option key={cat.id} value={cat.id}>📄 {cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Level 3 */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Cấp 3</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100"
                          value={form.categoryLevel3}
                          onChange={e => update('categoryLevel3', e.target.value)}
                          disabled={!form.categoryLevel2}
                        >
                          <option value="">-- Không chọn --</option>
                          {getLevel3Categories().map(cat => (
                            <option key={cat.id} value={cat.id}>📄 {cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Level 4 */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Cấp 4</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100"
                          value={form.categoryLevel4}
                          onChange={e => update('categoryLevel4', e.target.value)}
                          disabled={!form.categoryLevel3}
                        >
                          <option value="">-- Không chọn --</option>
                          {getLevel4Categories().map(cat => (
                            <option key={cat.id} value={cat.id}>📄 {cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Variants Tracking */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">Phân loại hàng (Các biến thể Size/Màu)</label>
                    <button type="button" onClick={addVariant} className="text-sm bg-blue-50 text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                      + Thêm biến thể
                    </button>
                  </div>
                  
                  {form.variants.length > 0 && (
                    <div className="overflow-x-auto mb-4 border border-gray-200 rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                          <tr>
                            <th className="p-3 text-left font-medium">Kích thước</th>
                            <th className="p-3 text-left font-medium">Màu sắc</th>
                            <th className="p-3 text-left font-medium">Giá bán (tùy chọn)</th>
                            <th className="p-3 text-left font-medium">Tồn kho</th>
                            <th className="p-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {form.variants.map(v => (
                            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-2">
                                <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500" value={v.sizeId} onChange={(e) => updateVariant(v.id, 'sizeId', e.target.value)}>
                                  <option value="">-- Cỡ chung --</option>
                                  {sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </td>
                              <td className="p-2">
                                <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500" value={v.colorId} onChange={(e) => updateVariant(v.id, 'colorId', e.target.value)}>
                                  <option value="">-- Màu chung --</option>
                                  {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </td>
                              <td className="p-2">
                                <input type="number" placeholder="Mặc định -> giá gốc" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500" value={v.price} onChange={(e) => updateVariant(v.id, 'price', e.target.value)} />
                              </td>
                              <td className="p-2">
                                <input type="number" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500" value={v.stock} onChange={(e) => updateVariant(v.id, 'stock', e.target.value)} />
                              </td>
                              <td className="p-2 text-center">
                                <button type="button" className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors" onClick={() => removeVariant(v.id)} title="Xóa">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quản lý Kích thước</p>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Tên Size mới (VD: XL)" className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 flex-1" value={newSizeName} onChange={e => setNewSizeName(e.target.value)} />
                        <button type="button" onClick={handleCreateSize} className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">Thêm</button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quản lý Màu sắc</p>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Tên Màu (VD: Đen)" className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 flex-1" value={newColorName} onChange={e => setNewColorName(e.target.value)} />
                        {/* <input type="color" className="w-9 h-9 p-0 border-0 rounded cursor-pointer shrink-0" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} title="Mã màu" /> */}
                        <button type="button" onClick={handleCreateColor} className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">Thêm</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={form.isComboSet}
                      onChange={e => update('isComboSet', e.target.checked)} 
                    />
                    <span className="text-gray-700">Sản phẩm combo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={form.isGiftItem}
                      onChange={e => update('isGiftItem', e.target.checked)} 
                    />
                    <span className="text-gray-700">Sản phẩm quà tặng</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={form.isActive}
                      onChange={e => update('isActive', e.target.checked)} 
                    />
                    <span className="text-gray-700">Kích hoạt sản phẩm</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button 
                  type="button" 
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors" 
                  onClick={() => setShowEditModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={loading}
                >
                  {loading ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 text-center mb-2">
                Xóa sản phẩm?
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Bạn có chắc chắn muốn xóa sản phẩm <strong>{product.name}</strong>? 
                Hành động này không thể hoàn tác.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
                  <span>⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors" 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button 
                  type="button"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

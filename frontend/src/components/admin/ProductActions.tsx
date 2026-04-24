import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface ProductActionsProps {
  categories?: Category[];
}

export default function ProductActions({ categories = [] }: ProductActionsProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  
  const [newSizeName, setNewSizeName] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    sku: '',
    description: '',
    originalPrice: '',
    salePrice: '',
    stockQuantity: '0',
    weight: '500',
    imageUrl: '',
    categoryLevel1: '',
    categoryLevel2: '',
    categoryLevel3: '',
    categoryLevel4: '',
    isComboSet: false,
    isGiftItem: false,
    isActive: true,
    variants: [] as { id: string; sizeId: string; colorId: string; price: string; stock: string }[],
  });

  useEffect(() => {
    if (showModal) {
      apiClientClient.get<any[]>('/sizes').then(setSizes).catch(console.error);
      apiClientClient.get<any[]>('/colors').then(setColors).catch(console.error);
    }
  }, [showModal]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const selectedCategoryId = form.categoryLevel4 || form.categoryLevel3 || form.categoryLevel2 || form.categoryLevel1;
      const categoryIds = selectedCategoryId ? [selectedCategoryId] : [];

      await apiClientClient.post<any>('/products', {
        name: form.name,
        sku: form.sku || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        originalPrice: parseFloat(form.originalPrice),
        salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
        stockQuantity: form.variants.length > 0 
          ? form.variants.reduce((acc, v) => acc + (parseInt(v.stock) || 0), 0)
          : (parseInt(form.stockQuantity) || 0),
        weight: parseInt(form.weight) || 500,
        isComboSet: form.isComboSet,
        isGiftItem: form.isGiftItem,
        isActive: form.isActive,
        categoryIds,
        variants: form.variants.length > 0
          ? form.variants.map(v => ({
              sizeId: v.sizeId || undefined,
              colorId: v.colorId || undefined,
              price: v.price ? parseFloat(v.price) : undefined,
              stock: parseInt(v.stock) || 0,
            }))
          : undefined,
      });

      setShowModal(false);
      setForm({
        name: '',
        slug: '',
        sku: '',
        description: '',
        originalPrice: '',
        salePrice: '',
        stockQuantity: '0',
        weight: '500',
        imageUrl: '',
        categoryLevel1: '',
        categoryLevel2: '',
        categoryLevel3: '',
        categoryLevel4: '',
        isComboSet: false,
        isGiftItem: false,
        isActive: true,
        variants: [],
      });
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi tạo sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: any) => {
    setForm(prev => {
      const newForm = { ...prev, [field]: value };
      if (field === 'name' && typeof value === 'string') {
        newForm.slug = value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
      
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

  const getLevel1Categories = () => categories.filter(c => !c.parentId);
  const getLevel2Categories = () => form.categoryLevel1 ? categories.filter(c => c.parentId === form.categoryLevel1) : [];
  const getLevel3Categories = () => form.categoryLevel2 ? categories.filter(c => c.parentId === form.categoryLevel2) : [];
  const getLevel4Categories = () => form.categoryLevel3 ? categories.filter(c => c.parentId === form.categoryLevel3) : [];

  return (
    <>
      <button 
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors" 
        onClick={() => setShowModal(true)}
      >
        + Tạo Sản phẩm
      </button>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Tạo Sản phẩm mới</h2>
              <button 
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none" 
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <span>⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-name">
                      Tên sản phẩm *
                    </label>
                    <input 
                      id="prod-name" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required
                      value={form.name} 
                      onChange={e => update('name', e.target.value)}
                      placeholder="VD: Áo thun basic" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-sku">
                      SKU
                    </label>
                    <input 
                      id="prod-sku" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm" 
                      value={form.sku} 
                      onChange={e => update('sku', e.target.value)}
                      placeholder="PROD-001" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-slug">
                    Slug *
                  </label>
                  <input 
                    id="prod-slug" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm" 
                    required
                    value={form.slug} 
                    onChange={e => update('slug', e.target.value)}
                    placeholder="ao-thun-basic" 
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-price">
                      Giá gốc (VNĐ) *
                    </label>
                    <input 
                      id="prod-price" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      required
                      value={form.originalPrice} 
                      onChange={e => update('originalPrice', e.target.value)}
                      placeholder="299000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-sale">
                      Giá sale (VNĐ)
                    </label>
                    <input 
                      id="prod-sale" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.salePrice} 
                      onChange={e => update('salePrice', e.target.value)}
                      placeholder="249000" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-weight">
                      Trọng lượng (g)
                    </label>
                    <input 
                      id="prod-weight" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={form.weight} 
                      onChange={e => update('weight', e.target.value)}
                      placeholder="500" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-stock">
                      Tồn kho (Mặc định)
                    </label>
                    <input 
                      id="prod-stock" 
                      type="number" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      value={form.variants.length > 0 ? form.variants.reduce((a, v) => a + (parseInt(v.stock) || 0), 0) : form.stockQuantity} 
                      onChange={e => update('stockQuantity', e.target.value)}
                      placeholder="100" 
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
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="prod-desc">
                    Mô tả
                  </label>
                  <textarea 
                    id="prod-desc" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    rows={3}
                    value={form.description} 
                    onChange={e => update('description', e.target.value)}
                    placeholder="Mô tả chi tiết sản phẩm..." 
                  />
                </div>

                {categories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Danh mục sản phẩm
                    </label>
                    <div className="grid grid-cols-2 gap-4">
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
                                <input type="number" placeholder="Bạc định lấy giá gốc" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500" value={v.price} onChange={(e) => updateVariant(v.id, 'price', e.target.value)} />
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

                  <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
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
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={loading}
                >
                  {loading ? 'Đang tạo...' : 'Tạo Sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

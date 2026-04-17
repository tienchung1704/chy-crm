import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Link from 'next/link';

async function getCart(userId: string) {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              originalPrice: true,
              salePrice: true,
              stockQuantity: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  // Create cart if doesn't exist
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                originalPrice: true,
                salePrice: true,
                stockQuantity: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  return cart;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CartPage() {
  const session = await getSession();
  if (!session) return null;

  const cart = await getCart(session.id);

  // Calculate totals
  const subtotal = cart.items.reduce((sum, item) => {
    const price = item.product.salePrice || item.product.originalPrice;
    return sum + price * item.quantity;
  }, 0);

  const shipping = subtotal > 0 ? 30000 : 0; // 30k shipping fee
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Giỏ hàng của bạn</h1>
          <p className="text-gray-600 text-sm">
            {cart.items.length} sản phẩm trong giỏ hàng
          </p>
        </div>

        {cart.items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Giỏ hàng trống
            </h3>
            <p className="text-gray-600 mb-6">
              Hãy thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm
            </p>
            <Link
              href="/portal/products"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => {
                const price = item.product.salePrice || item.product.originalPrice;
                const itemTotal = price * item.quantity;
                const isOutOfStock = item.product.stockQuantity === 0 || !item.product.isActive;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl shadow-sm p-4 ${
                      isOutOfStock ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            📦
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-1">
                          {item.product.name}
                        </h3>
                        <div className="text-lg font-bold text-blue-600 mb-2">
                          {formatCurrency(price)}
                        </div>

                        {isOutOfStock && (
                          <div className="text-sm text-red-600 mb-2">
                            ⚠️ Sản phẩm hết hàng
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center justify-center"
                              disabled={isOutOfStock}
                            >
                              −
                            </button>
                            <span className="w-12 text-center font-medium">
                              {item.quantity}
                            </span>
                            <button
                              className="w-8 h-8 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors flex items-center justify-center"
                              disabled={isOutOfStock}
                            >
                              +
                            </button>
                          </div>

                          {/* Remove Button */}
                          <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                            Xóa
                          </button>
                        </div>
                      </div>

                      {/* Item Total */}
                      <div className="text-right">
                        <div className="font-bold text-gray-800">
                          {formatCurrency(itemTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Tóm tắt đơn hàng
                </h3>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Tạm tính</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Phí vận chuyển</span>
                    <span className="font-medium">{formatCurrency(shipping)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold text-gray-800">
                    <span>Tổng cộng</span>
                    <span className="text-blue-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                <button className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors mb-3">
                  Thanh toán
                </button>

                <Link
                  href="/portal/products"
                  className="block text-center text-sm text-gray-600 hover:text-gray-800"
                >
                  ← Tiếp tục mua sắm
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

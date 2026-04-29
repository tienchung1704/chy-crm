import OrderVouchersTableClient from '@/components/admin/OrderVouchersTableClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Voucher Đơn Hàng | Quản Trị Viên',
};

export default function OrderVouchersPage() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <OrderVouchersTableClient />
    </div>
  );
}

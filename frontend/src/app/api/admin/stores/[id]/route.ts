import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { sendMail } from '@/lib/mailer';

// Toggle store active status (approve/reject)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { isActive, isBanned, bannedReason } = body;

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) return NextResponse.json({ error: 'Cửa hàng không tồn tại' }, { status: 404 });

    // Handle Banning a store
    if (isBanned === true) {
      const updatedStore = await prisma.store.update({
        where: { id },
        data: {
          isActive: false,
          isBanned: true,
          bannedReason: bannedReason || null,
        },
      });
      // Downgrade the owner's role
      await prisma.user.update({
        where: { id: store.ownerId },
        data: { role: 'CUSTOMER' },
      });
      console.log(`[Store] Banned store: ${store.name} (${id}). Reason: ${bannedReason}`);
      return NextResponse.json({ success: true, store: updatedStore, message: 'Cửa hàng đã bị cấm' });
    }

    // Handle Un-banning a store
    if (isBanned === false && store.isBanned) {
      const updatedStore = await prisma.store.update({
        where: { id },
        data: {
          isActive: true,
          isBanned: false,
          bannedReason: null,
        },
      });
      // Restore the owner's role
      await prisma.user.update({
        where: { id: store.ownerId },
        data: { role: 'MODERATOR' },
      });
      console.log(`[Store] Unbanned store: ${store.name} (${id})`);
      return NextResponse.json({ success: true, store: updatedStore, message: 'Đã gỡ cấm cửa hàng' });
    }

    // Handle Approving newly
    if (isActive && !store.isActive) {
      if (!store.email) {
        return NextResponse.json({ error: 'Cửa hàng này thiếu trường email để cấp phát tài khoản.' }, { status: 400 });
      }

      const rawPassword = 'MK' + Math.random().toString(36).slice(-6).toUpperCase();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      // Create a dedicated system user account for the shop to keep buyer/seller completely separate
      const adminUsername = `admin@${store.slug}.crm`;
      
      let sellerUser = await prisma.user.findUnique({ where: { email: adminUsername } });
      if (!sellerUser) {
        sellerUser = await prisma.user.create({
          data: {
            email: adminUsername,
            name: `${store.name} (Admin)`,
            password: hashedPassword,
            role: 'MODERATOR',
            referralCode: 'MOD-' + Math.random().toString(36).slice(-6).toUpperCase(),
            isActive: true,
          }
        });
      } else {
        sellerUser = await prisma.user.update({
          where: { id: sellerUser.id },
          data: {
            password: hashedPassword,
            role: 'MODERATOR',
            isActive: true,
          }
        });
      }

      await prisma.store.update({
        where: { id },
        data: {
          isActive: true,
          ownerId: sellerUser.id,
        }
      });

      // Send instruction email
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const mailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">Chúc mừng từ CRM Hệ Thống!</h2>
          <p>Cửa hàng <strong>${store.name}</strong> của bạn đã được Admin phê duyệt thành công.</p>
          <p>Để đảm bảo an toàn và giúp bạn tách biệt hoàn toàn giữa tài khoản mua hàng và tài khoản bán hàng, chúng tôi đã cấp riêng cho bạn một tài khoản Quản trị viên (MODERATOR).</p>
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Tài khoản đăng nhập:</strong> ${adminUsername}</p>
            <p style="margin: 0;"><strong>Mật khẩu tạm thời:</strong> <span style="color: #E11D48; font-weight: bold;">${rawPassword}</span></p>
          </div>
          <p>Vui lòng đăng nhập và thay đổi mật khẩu ngay lập tức.</p>
          <a href="${baseUrl}/login" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: #FFF; text-decoration: none; border-radius: 8px; font-weight: bold;">Đăng nhập Cổng Bán Hàng</a>
        </div>
      `;
      await sendMail(store.email, `Cửa hàng ${store.name} đã được phê duyệt!`, mailHtml);

      return NextResponse.json({ success: true, store, message: 'Đã phê duyệt và cấp phát thành công' });
    }

    // Normal update (e.g. pausing store)
    const updatedStore = await prisma.store.update({
      where: { id },
      data: { isActive: !!isActive },
    });

    return NextResponse.json({ success: true, store: updatedStore });
  } catch (error) {
    console.error('Update store error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật cửa hàng' }, { status: 500 });
  }
}

// Delete store
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Reset owner role back to CUSTOMER
    const store = await prisma.store.findUnique({ where: { id } });
    if (store) {
      await prisma.user.update({
        where: { id: store.ownerId },
        data: { role: 'CUSTOMER' },
      });
    }

    await prisma.store.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete store error:', error);
    return NextResponse.json({ error: 'Lỗi xóa cửa hàng' }, { status: 500 });
  }
}

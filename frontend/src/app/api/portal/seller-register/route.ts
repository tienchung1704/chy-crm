import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }

    // Check if user already owns a store
    const existingStore = await prisma.store.findUnique({ where: { ownerId: session.id } });
    if (existingStore) {
      return NextResponse.json({ error: 'Bạn đã đăng ký cửa hàng rồi' }, { status: 400 });
    }

    const body = await req.json();
    const {
      name, slug, description, phone, email,
      addressStreet, addressWard, addressDistrict, addressProvince,
      allowCOD, bankName, bankAccountNo, bankOwnerName,
    } = body;

    // Validate required fields
    if (!name || !slug || !phone || !email) {
      return NextResponse.json({ error: 'Vui lòng điền đủ thông tin bắt buộc' }, { status: 400 });
    }

    // Validate payment info
    if (!bankName || !bankAccountNo || !bankOwnerName) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin ngân hàng' }, { status: 400 });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang' }, { status: 400 });
    }

    // Check slug uniqueness
    const existingSlug = await prisma.store.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json({ error: 'Slug này đã được sử dụng' }, { status: 400 });
    }

    // Create store with isActive = false (pending admin approval)
    const store = await prisma.store.create({
      data: {
        name,
        slug,
        description: description || null,
        phone,
        email,
        addressStreet: addressStreet || null,
        addressWard: addressWard || null,
        addressDistrict: addressDistrict || null,
        addressProvince: addressProvince || null,
        allowCOD: allowCOD !== false,
        bankName,
        bankAccountNo,
        bankOwnerName: bankOwnerName.toUpperCase(),
        ownerId: session.id,
        isActive: false, // Chờ Admin duyệt
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Đăng ký thành công! Cửa hàng đang chờ Admin phê duyệt.',
      store,
    });
  } catch (error) {
    console.error('Seller register error:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi khi đăng ký' }, { status: 500 });
  }
}

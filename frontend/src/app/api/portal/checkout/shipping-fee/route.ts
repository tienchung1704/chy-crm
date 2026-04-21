import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { street, ward, province, totalWeight, storeId } = await req.json();
    
    if (!street || !ward || !province) {
      return NextResponse.json({ error: 'Thiếu thông tin địa chỉ' }, { status: 400 });
    }

    const vtpConfig = await prisma.storeIntegration.findFirst({
      where: { platform: 'VIETTELPOST', isActive: true },
    });
    
    // Explicitly type to allow accessing properties without error
    const configMetadata = (vtpConfig?.metadata as any) || {};

    const token = vtpConfig?.accessToken || process.env.VIETTELPOST_TOKEN;
    
    let senderAddress = process.env.VIETTELPOST_SENDER_ADDRESS || 'Trần Duy Hưng, Trung Hoà, Cầu Giấy, Hà Nội';
    
    // 1. Check if storeId is provided and fetch store address
    if (storeId) {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          addressStreet: true,
          addressWard: true,
          addressDistrict: true,
          addressProvince: true,
        }
      });
      
      if (store && store.addressProvince && store.addressWard && store.addressStreet) {
        senderAddress = [
          store.addressStreet,
          store.addressWard,
          store.addressDistrict,
          store.addressProvince
        ].filter(Boolean).join(', ');
      }
    } 
    // 2. Fallback to Admin integration metadata if no store address found
    else if (configMetadata.senderProvince && configMetadata.senderWard && configMetadata.senderAddress) {
      senderAddress = `${configMetadata.senderAddress}, ${configMetadata.senderWard}, ${configMetadata.senderProvince}`;
    }
    
    // Nếu chưa khai báo Token, tiến hành trả về phí mặc định để không làm đứt mạch check out
    if (!token) {
      console.warn("Missing VIETTELPOST_TOKEN, returning default shipping fee.");
      return NextResponse.json({ fee: 30000 });
    }

    const receiverAddress = `${street}, ${ward}, ${province}`;
    const weight = parseInt(totalWeight) || 500;

    const payload = {
      PRODUCT_WEIGHT: weight,
      PRODUCT_PRICE: 0,
      MONEY_COLLECTION: 0,
      ORDER_SERVICE: "VHT",
      ORDER_SERVICE_ADD: "",
      SENDER_ADDRESS: senderAddress,
      RECEIVER_ADDRESS: receiverAddress,
      PRODUCT_LENGTH: 0,
      PRODUCT_WIDTH: 0,
      PRODUCT_HEIGHT: 0,
      PRODUCT_TYPE: "HH",
      NATIONAL_TYPE: 1
    };

    const response = await fetch('https://partner.viettelpost.vn/v2/order/getPriceNlp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error("ViettelPost HTTP error:", response.statusText);
      return NextResponse.json({ fee: 30000, error: 'Lỗi kết nối HTTP ViettelPost' }, { status: 200 }); // Soft fallback error
    }

    const data = await response.json();
    
    if (data.status === 200 && data.error === false) {
      const fee = data.data?.MONEY_TOTAL || 0;
      return NextResponse.json({ fee });
    } else {
      console.error("ViettelPost Business error:", data);
      return NextResponse.json({ fee: 30000, error: data.message }); // Fallback
    }

  } catch (error) {
    console.error('Shipping fee calculation exception:', error);
    return NextResponse.json({ fee: 30000, error: 'Internal Server Error' }, { status: 500 }); // Default fallback
  }
}

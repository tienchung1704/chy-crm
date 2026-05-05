import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting inventory update...');

  try {
    // Cập nhật tất cả các biến thể có tồn kho >= 0 thành 100
    // Cả sản phẩm có tồn kho = 0 và > 0 đều được chuyển thành 100
    const result = await prisma.productVariant.updateMany({
      where: {
        stock: {
          gte: 0,
        },
      },
      data: {
        stock: 100,
      },
    });

    console.log(`✅ Thành công! Đã cập nhật ${result.count} biến thể sản phẩm lên số lượng tồn kho là 100.`);
  } catch (error) {
    console.error('❌ Có lỗi xảy ra trong quá trình cập nhật:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

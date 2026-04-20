// Script to reset products and categories only
// Usage: node reset-products.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetProductsAndCategories() {
  console.log('🗑️  Resetting products and categories...\n');

  try {
    // Delete in correct order (respect foreign keys)
    console.log('Deleting product variants...');
    await prisma.productVariant.deleteMany({});
    
    console.log('Deleting reviews...');
    await prisma.review.deleteMany({});
    
    console.log('Deleting wishlists...');
    await prisma.wishlist.deleteMany({});
    
    console.log('Deleting cart items...');
    await prisma.cartItem.deleteMany({});
    
    console.log('Deleting order items...');
    await prisma.orderItem.deleteMany({});
    
    console.log('Deleting products...');
    const deletedProducts = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${deletedProducts.count} products`);
    
    console.log('Deleting categories...');
    const deletedCategories = await prisma.category.deleteMany({});
    console.log(`✅ Deleted ${deletedCategories.count} categories`);
    
    console.log('\n✅ Reset completed successfully!');
    console.log('You can now run sync again.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetProductsAndCategories();

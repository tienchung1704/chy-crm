/**
 * Script to sync existing Pancake orders and create OrderItem records
 * Run: node sync-pancake-orders.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncPancakeOrders() {
  console.log('🔄 Starting Pancake orders sync...\n');

  try {
    // Find all Pancake orders without items
    const pancakeOrders = await prisma.order.findMany({
      where: {
        source: 'PANCAKE',
      },
      include: {
        items: true,
      },
    });

    console.log(`📦 Found ${pancakeOrders.length} Pancake orders\n`);

    let processedCount = 0;
    let itemsCreatedCount = 0;
    let skippedCount = 0;

    for (const order of pancakeOrders) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 Processing order: ${order.orderCode}`);

      // Check if order already has items
      if (order.items && order.items.length > 0) {
        console.log(`   ✅ Order already has ${order.items.length} items, skipping`);
        skippedCount++;
        continue;
      }

      // Get items from metadata
      const metadata = order.metadata;
      if (!metadata || !metadata.items || !Array.isArray(metadata.items)) {
        console.log(`   ⚠️  No items in metadata, skipping`);
        skippedCount++;
        continue;
      }

      const metadataItems = metadata.items;
      console.log(`   📦 Found ${metadataItems.length} items in metadata`);

      const orderItemsToCreate = [];

      for (const item of metadataItems) {
        const itemName = item.name || '';
        const price = item.price || 0;
        const quantity = item.quantity || 1;

        console.log(`   🔍 Searching for product: "${itemName}"`);

        // Extract base name by removing size/color info
        const baseName = itemName
          .replace(/\s+size\s+[smlxSMLX]+/gi, '')
          .replace(/\s+màu\s+\w+/gi, '')
          .replace(/\s+[smlxSMLX]$/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        console.log(`   📝 Base name: "${baseName}"`);

        // Try to find matching product
        let matchingProduct = null;

        // Try exact match first
        matchingProduct = await prisma.product.findFirst({
          where: {
            name: itemName,
          },
        });

        // Try base name match
        if (!matchingProduct) {
          matchingProduct = await prisma.product.findFirst({
            where: {
              name: {
                contains: baseName,
              },
            },
          });
        }

        // Try partial match (first 3 words)
        if (!matchingProduct) {
          const firstWords = baseName.split(' ').slice(0, 3).join(' ');
          if (firstWords.length > 3) {
            matchingProduct = await prisma.product.findFirst({
              where: {
                name: {
                  contains: firstWords,
                },
              },
            });
          }
        }

        if (matchingProduct) {
          console.log(`   ✅ Found matching product: "${matchingProduct.name}" (ID: ${matchingProduct.id})`);
          
          orderItemsToCreate.push({
            orderId: order.id,
            productId: matchingProduct.id,
            quantity: quantity,
            price: price,
            isGift: false,
            size: null,
            color: null,
          });
        } else {
          console.log(`   ❌ No matching product found for: "${itemName}"`);
        }
      }

      // Create order items
      if (orderItemsToCreate.length > 0) {
        await prisma.orderItem.createMany({
          data: orderItemsToCreate,
        });

        console.log(`   ✨ Created ${orderItemsToCreate.length} order items`);
        itemsCreatedCount += orderItemsToCreate.length;
        processedCount++;
      } else {
        console.log(`   ⚠️  No items could be matched, skipping`);
        skippedCount++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n✅ Sync completed!`);
    console.log(`   📊 Total orders: ${pancakeOrders.length}`);
    console.log(`   ✅ Processed: ${processedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📦 Items created: ${itemsCreatedCount}`);
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('❌ Error syncing Pancake orders:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncPancakeOrders()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

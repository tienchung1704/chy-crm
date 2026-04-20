// Test script to check Pancake variation structure
// Usage: node test-pancake-structure.js YOUR_API_KEY YOUR_SHOP_ID

const apiKey = process.argv[2];
const shopId = process.argv[3];

if (!apiKey || !shopId) {
  console.error('❌ Please provide API key and Shop ID as arguments');
  console.log('Usage: node test-pancake-structure.js YOUR_API_KEY YOUR_SHOP_ID');
  process.exit(1);
}

async function fetchFirstPage() {
  const url = `https://pos.pages.fm/api/v1/shops/${shopId}/products/variations?api_key=${apiKey}&page=1&page_size=5`;
  
  console.log('🔍 Fetching first 5 variations to check structure...\n');
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      console.log('✅ Response received\n');
      console.log('📋 Full structure of first variation:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(JSON.stringify(data.data[0], null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      console.log('\n📊 Key fields analysis:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const variation = data.data[0];
      
      console.log(`Variation ID:        ${variation.id}`);
      console.log(`Variation Name:      ${variation.name || 'N/A'}`);
      console.log(`Product ID:          ${variation.product_id || 'N/A'}`);
      console.log(`Display ID:          ${variation.display_id || 'N/A'}`);
      console.log(`Remain Quantity:     ${variation.remain_quantity}`);
      console.log(`Retail Price:        ${variation.retail_price}`);
      console.log(`Price at Counter:    ${variation.price_at_counter}`);
      
      console.log('\n🔍 Checking "product" field:');
      if (variation.product) {
        console.log('  ✅ variation.product exists');
        console.log(`  Product structure: ${JSON.stringify(variation.product, null, 2)}`);
      } else {
        console.log('  ❌ variation.product is null/undefined');
      }
      
      console.log('\n🔍 Checking "product_id" field:');
      if (variation.product_id) {
        console.log(`  ✅ variation.product_id = ${variation.product_id}`);
      } else {
        console.log('  ❌ variation.product_id is null/undefined');
      }
      
      console.log('\n💡 Recommendation:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (variation.product_id) {
        console.log('✅ Use variation.product_id to group products');
        console.log('   Change: const productId = variation.product?.id;');
        console.log('   To:     const productId = variation.product_id;');
      } else if (variation.product && variation.product.id) {
        console.log('✅ Use variation.product.id to group products');
      } else {
        console.log('⚠️  No product ID found! Check the API response structure.');
        console.log('   You may need to use variation.name or another field for grouping.');
      }
      
    } else {
      console.log('⚠️  No variations found in response');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchFirstPage();

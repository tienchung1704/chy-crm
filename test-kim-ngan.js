// Check if "Kim Ngân" variations have same product_id
// Usage: node test-kim-ngan.js YOUR_API_KEY YOUR_SHOP_ID

const apiKey = process.argv[2];
const shopId = process.argv[3];

if (!apiKey || !shopId) {
  console.error('❌ Please provide API key and Shop ID');
  console.log('Usage: node test-kim-ngan.js YOUR_API_KEY YOUR_SHOP_ID');
  process.exit(1);
}

async function checkKimNgan() {
  let page = 1;
  let allVariations = [];
  let hasMore = true;

  console.log('🔍 Fetching all variations...\n');

  while (hasMore && page <= 5) {
    const url = `https://pos.pages.fm/api/v1/shops/${shopId}/products/variations?api_key=${apiKey}&page=${page}&page_size=100`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      allVariations = allVariations.concat(data.data);
      hasMore = data.page_number < data.total_pages;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Filter "Kim Ngân" variations
  const kimNganVariations = allVariations.filter(v => 
    v.product?.name?.includes('Kim Ngân') || v.product?.name?.includes('Kim_Ngân')
  );

  console.log(`Found ${kimNganVariations.length} "Kim Ngân" variations:\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const productIdMap = new Map();

  kimNganVariations.forEach((v, index) => {
    console.log(`${index + 1}. ${v.product.name}`);
    console.log(`   Variation ID:  ${v.id}`);
    console.log(`   Product ID:    ${v.product_id}`);
    console.log(`   Display ID:    ${v.product.display_id}`);
    console.log(`   Stock:         ${v.remain_quantity}`);
    console.log('');

    if (!productIdMap.has(v.product_id)) {
      productIdMap.set(v.product_id, []);
    }
    productIdMap.get(v.product_id).push(v.product.name);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Summary: Found ${productIdMap.size} unique product_id(s)\n`);

  for (const [productId, names] of productIdMap.entries()) {
    console.log(`Product ID: ${productId}`);
    console.log(`  Variations: ${names.length}`);
    names.forEach(name => console.log(`    - ${name}`));
    console.log('');
  }

  if (productIdMap.size === 1) {
    console.log('✅ All "Kim Ngân" variations have the SAME product_id');
    console.log('   They should be grouped into 1 product with multiple variants.');
  } else {
    console.log('⚠️  "Kim Ngân" variations have DIFFERENT product_id');
    console.log('   This is why they are being created as separate products!');
    console.log('\n💡 Solution: Group by product.name instead of product_id');
  }
}

checkKimNgan();

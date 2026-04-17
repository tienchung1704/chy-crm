async function testFetchOrders() {
  const shopId = '4893018';
  const apiKey = '7e1ae4f6939d481a8a09ec176b740358';
  const phone = '0394883260';

  // 1. Fetch orders list
  const url = `https://pos.pages.fm/api/v1/shops/${shopId}/orders?api_key=${apiKey}&search=${encodeURIComponent(phone)}&page_size=100`;
  const response = await fetch(url);
  const data = await response.json();
  
  console.log("=== RAW ORDER DATA ===");
  console.log(JSON.stringify(data, null, 2));

  // 2. If orders exist, try fetching individual order detail
  if (data.success && data.data?.length > 0) {
    const orderId = data.data[0].id;
    console.log(`\n=== FETCHING ORDER DETAIL: ${orderId} ===`);
    const detailUrl = `https://pos.pages.fm/api/v1/shops/${shopId}/orders/${orderId}?api_key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    console.log(JSON.stringify(detailData, null, 2));
  }

  // 3. Try fetching customers endpoint
  console.log(`\n=== FETCHING CUSTOMERS ===`);
  const custUrl = `https://pos.pages.fm/api/v1/shops/${shopId}/customers?api_key=${apiKey}&search=${encodeURIComponent(phone)}&page_size=10`;
  const custRes = await fetch(custUrl);
  const custData = await custRes.json();
  console.log(JSON.stringify(custData, null, 2));
}

testFetchOrders();

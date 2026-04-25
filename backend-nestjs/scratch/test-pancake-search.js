const SHOP_ID = '4893018';
const API_KEY = '7e1ae4f6939d481a8a09ec176b740358';
const TARGET_TRACKING = '139211587021';
const TARGET_PHONE = '0338253111';

async function testPancakeSync() {
  console.log(`🔍 Fetching orders from Pancake to find ${TARGET_TRACKING}...`);
  
  try {
    let allOrders = [];
    // Fetch up to 10 pages (1000 orders)
    for (let page = 1; page <= 10; page++) {
      const url = `https://pos.pages.fm/api/v1/shops/${SHOP_ID}/orders?api_key=${API_KEY}&page_size=100&page=${page}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        console.log(`✅ Page ${page}: Fetched ${data.data.length} orders.`);
        allOrders = allOrders.concat(data.data);
        if (data.data.length < 100) break;
      } else {
        console.log(`❌ Error on page ${page}:`, data);
        break;
      }
    }

    if (allOrders.length > 0) {
      console.log(`\nSearching through ${allOrders.length} orders...`);
      
      const match = allOrders.find(order => {
        const vtp_tracking = order.partner?.order_number_vtp || '';
        const tracking = order.partner?.extend_code || '';
        const phone = order.bill_phone_number || order.customer?.phone || '';
        const id = order.id || '';
        
        return String(vtp_tracking).includes(TARGET_TRACKING) || 
               String(tracking).includes(TARGET_TRACKING) || 
               String(phone).includes(TARGET_PHONE) ||
               String(id) === TARGET_TRACKING;
      });

      if (match) {
        console.log('🎯 FOUND MATCHING ORDER:');
        console.log(JSON.stringify(match, null, 2));
      } else {
        console.log('❌ Still no match in the fetched orders.');
        console.log('Sample of fetched orders for debug (ID | Bill Phone | VTP Tracking):');
        allOrders.slice(0, 10).forEach(o => {
          console.log(`- ${o.id} | ${o.bill_phone_number || 'N/A'} | VTP: ${o.partner?.order_number_vtp || 'N/A'} | Ext: ${o.partner?.extend_code || 'N/A'}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

testPancakeSync();

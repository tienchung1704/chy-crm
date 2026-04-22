/**
 * Pancake Webhook Configuration Script (SWAPPED CREDENTIALS TEST)
 * Run this script using: node scratch/configure_pancake_webhook.js
 */

// Trying with swapped values because .env.prod seems to have them reversed
const SHOP_ID = '4893018'; 
const API_KEY = '7e1ae4f6939d481a8a09ec176b740358';
const WEBHOOK_URL = 'https://lestgoai.com/api/integrations/pancake/webhook';
const CONTACT_EMAIL = 'tien.chungloveu@gmail.com';

async function configureWebhook() {
  console.log('🚀 Starting Pancake Webhook Configuration (Trial 2: Swapped IDs)...');
  console.log(`📍 Targeting Shop ID: ${SHOP_ID}`);
  console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);

  try {
    const response = await fetch(`https://pos.pages.fm/api/v1/shops/${SHOP_ID}?api_key=${API_KEY}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shop: {
          webhook_enable: true,
          webhook_url: WEBHOOK_URL,
          webhook_email: CONTACT_EMAIL,
          webhook_types: ['orders', 'customers', 'products', 'variations_warehouses'],
          webhook_partner: '',
          webhook_headers: {
            'X-SOURCE': 'CHY-CRM'
          }
        }
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ Webhook configured successfully!');
      console.log('Result:', JSON.stringify(data.data, null, 2));
    } else {
      console.error('❌ Failed to configure webhook.');
      console.error('Status:', response.status);
      console.error('Error Details:', data);
    }
  } catch (error) {
    console.error('❌ Network error while connecting to Pancake API:');
    console.error(error.message);
  }
}

configureWebhook();

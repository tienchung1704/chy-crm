const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'src/integrations/pancake/pancake.service.ts');
let content = fs.readFileSync(filepath, 'utf8');

// 1. Replace extractProductInfo signature
content = content.replace(
  'private extractProductInfo(productName: string) {',
  'private extractProductInfo(productName: string, itemFields?: any[]) {'
);

// 2. Insert itemFields check at the top of extractProductInfo
content = content.replace(
  '    let color = null;\n    let size = null;\n    \n    baseName = baseName.replace(/_+/g, \' \');',
  `    let color = null;
    let size = null;
    
    // First, try to extract from Pancake fields if available (metadata)
    if (itemFields && Array.isArray(itemFields)) {
       const colorField = itemFields.find(f => f.name?.toLowerCase() === 'màu sắc' || f.name?.toLowerCase() === 'màu' || f.name?.toLowerCase() === 'color');
       const sizeField = itemFields.find(f => f.name?.toLowerCase() === 'kích thước' || f.name?.toLowerCase() === 'size');
       if (colorField && colorField.value) color = colorField.value;
       if (sizeField && sizeField.value) size = sizeField.value;
    }
    
    baseName = baseName.replace(/_+/g, ' ');`
);

// 3. Update size regex
content = content.replace(
  'const sizeValuePattern = /\\s+(?:Size|size|ize)\\s+([X]{1,3}L|2XL|3XL|[LMS])\\b|\\s+([X]{1,3}L|[LMS])\\b(?=\\s*$)/gi;',
  'const sizeValuePattern = /\\s+(?:Size|size|ize)\\s+([X]{1,3}L|2XL|3XL|[LMS]|Freesize|Free\\s*size)\\b|\\s+([X]{1,3}L|[LMS]|Freesize|Free\\s*size)\\b(?=\\s*$)/gi;'
);

content = content.replace(
  'if (sizeMatches.length > 0) {',
  'if (sizeMatches.length > 0 && !size) {'
);

content = content.replace(
  'baseName = baseName.replace(/\\s+[LMS]\\s*$/gi, \'\');\n    baseName = baseName.replace(/\\s+Size\\b/gi, \' \');',
  'baseName = baseName.replace(/\\s+[LMS]\\s*$/gi, \'\');\n    baseName = baseName.replace(/\\s+(?:Size|size|ize)\\s+(?:Freesize|Free\\s*size)\\b/gi, \' \');\n    baseName = baseName.replace(/\\s+(?:Freesize|Free\\s*size)\\b/gi, \' \');\n    baseName = baseName.replace(/\\s+Size\\b/gi, \' \');'
);

// 4. Update color regex
// We must find the EXACT corrupted string to replace it.
const corruptedRegexStr = 'const colorPattern = /(en|?|Xanh|Tr?ng|H?ng|Be|Tm|Vng|Nu|Xm|Cam)\\b/gi;';
const correctRegexStr = 'const colorPattern = /(Đen|Đỏ|Xanh|Trắng|Hồng|Be|Tím|Vàng|Nâu|Xám|Cam)\\b/gi;';

content = content.replace(corruptedRegexStr, correctRegexStr);
// Fallback if the file didn't actually have the exact corrupted string due to console rendering vs file bytes
content = content.replace(/const colorPattern = \/\(.*?\)\\b\/gi;/, correctRegexStr);

content = content.replace(
  'if (colorMatches.length > 0) {',
  'if (colorMatches.length > 0 && !color) {'
);

content = content.replace(
  'baseName = baseName.replace(/\\bmu\\s*/gi, \' \').trim();',
  'baseName = baseName.replace(/\\bmàu\\s*/gi, \' \').trim();'
);
content = content.replace(/baseName = baseName\.replace\(\/\\b.*mu\\s\*\/gi, ' '\)\.trim\(\);/, 'baseName = baseName.replace(/\\bmàu\\s*/gi, \' \').trim();'); // fallback

content = content.replace(
  '.replace(/\\bu\\b/gi, \'\')',
  '.replace(/\\bâu\\b/gi, \'\')'
);

// 5. Update syncProductVariations
content = content.replace(
  'const { color, size } = this.extractProductInfo(productName);',
  'const { color, size } = this.extractProductInfo(productName, variation.fields);'
);

// 6. Update syncSingleOrder items loop
const oldItemsLoop = `    for (const item of items) {
      const itemName = item.variation_info?.name || item.name || '';
      const price = item.variation_info?.retail_price || item.price || 0;
      const quantity = item.quantity || 1;

      const baseName = itemName
        .replace(/\\s+size\\s+[smlxSMLX]+/gi, '')
        .replace(/\\s+màu\\s+\\w+/gi, '')
        .replace(/\\s+[smlxSMLX]$/gi, '')
        .trim();

      const matchingProduct = await this.prisma.product.findFirst({
        where: {
          OR: [
            { name: { contains: baseName } },
            { name: { contains: itemName } },
            { externalId: { contains: String(item.product_id || '') } },
          ]
        }
      });

      if (matchingProduct) {
        orderItemsData.push({
          productId: matchingProduct.id,
          quantity,
          price,
          isGift: item.is_bonus_product || false,
          size: null,
          color: null,
        });
      }
    }`;

const newItemsLoop = `    for (const item of items) {
      const itemName = item.variation_info?.name || item.name || '';
      const price = item.variation_info?.retail_price || item.price || 0;
      const quantity = item.quantity || 1;
      const fields = item.variation_info?.fields || [];

      const { baseName, color, size } = this.extractProductInfo(itemName, fields);

      const matchingProduct = await this.prisma.product.findFirst({
        where: {
          OR: [
            { externalId: String(item.product_id || '') },
            { name: { contains: baseName } },
            { name: { contains: itemName } },
          ]
        }
      });

      if (matchingProduct) {
        orderItemsData.push({
          productId: matchingProduct.id,
          quantity,
          price,
          isGift: item.is_bonus_product || false,
          size: size || null,
          color: color || null,
        });
      }
    }`;

content = content.replace(oldItemsLoop, newItemsLoop);

fs.writeFileSync(filepath, content, 'utf8');
console.log('Successfully patched pancake.service.ts');

# Manual Order Creation Feature

## Overview
Admin users can now manually create orders through a 3-step wizard interface on the admin orders page.

## Features

### 1. Customer Selection (Step 1)
- Search customers by name, phone, or email
- Real-time search with 300ms debounce
- Display customer details (name, phone, email)
- Selected customer info auto-fills shipping details

### 2. Product Selection (Step 2)
- Search products by name
- Real-time search with 300ms debounce
- Display product image, name, price, and stock
- Add multiple products to order
- Adjust quantity and price per item
- Remove items from order
- Shows running subtotal

### 3. Shipping & Payment (Step 3)
- Auto-filled shipping name and phone from customer
- Optional address fields (street, ward, province)
- Customer note field
- Admin internal note field
- Shipping fee input
- Discount amount input
- Order summary with:
  - Subtotal
  - Shipping fee
  - Discount
  - Total amount

## Technical Implementation

### Components
- **CreateOrderButton** (`src/components/admin/CreateOrderButton.tsx`)
  - Trigger button with modal state management
  - Refreshes page on successful order creation

- **CreateOrderModal** (`src/components/admin/CreateOrderModal.tsx`)
  - 3-step wizard interface
  - Form validation
  - API integration

### API Endpoints

#### Customer Search
- **Endpoint**: `GET /api/admin/customers/search?q={query}`
- **Auth**: Admin/Staff only
- **Returns**: Array of customers matching search query

#### Product Search
- **Endpoint**: `GET /api/admin/products/search?q={query}`
- **Auth**: Admin/Staff only
- **Returns**: Array of products with variants and stock info

#### Order Creation
- **Endpoint**: `POST /api/admin/orders/create`
- **Auth**: Admin/Staff only
- **Body**:
  ```json
  {
    "userId": "string",
    "items": [
      {
        "productId": "string",
        "productName": "string",
        "quantity": number,
        "price": number,
        "size": "string | null",
        "color": "string | null"
      }
    ],
    "shippingName": "string",
    "shippingPhone": "string",
    "shippingStreet": "string?",
    "shippingWard": "string?",
    "shippingProvince": "string?",
    "customerNote": "string?",
    "adminNote": "string?",
    "shippingFee": number,
    "discountAmount": number
  }
  ```
- **Returns**: Created order with items and user details

### Order Details
- **Source**: `ADMIN_MANUAL`
- **Status**: `PENDING`
- **Payment Method**: `COD`
- **Payment Status**: `UNPAID`
- **Order Code**: Auto-generated with format `ORD-{timestamp}{random}`
- **Store Assignment**: Automatically assigned if all products from same store

## Validation
- Customer must be selected
- At least 1 product required
- Shipping name and phone required
- All products must exist in database
- Prices and quantities must be positive numbers

## User Experience
- Step-by-step wizard prevents errors
- Auto-fill reduces data entry
- Real-time search for quick selection
- Visual feedback for selected items
- Clear order summary before submission
- Page refresh shows new order immediately

## Files Modified/Created
1. `src/app/admin/orders/page.tsx` - Added CreateOrderButton
2. `src/components/admin/CreateOrderButton.tsx` - Button component
3. `src/components/admin/CreateOrderModal.tsx` - Modal wizard
4. `src/app/api/admin/customers/search/route.ts` - Customer search API
5. `src/app/api/admin/products/search/route.ts` - Product search API
6. `src/app/api/admin/orders/create/route.ts` - Order creation API

## Future Enhancements
- Add variant (size/color) selection per product
- Support for multiple stores in single order
- Payment method selection
- Initial status selection
- Shipping address validation
- Product stock validation
- Commission calculation preview

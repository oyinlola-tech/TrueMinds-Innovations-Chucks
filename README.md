# Chuks Kitchen Backend (TrueMinds Assignment)

## 1) System Overview
This project is a simple Node.js + Express backend simulation for Chuks Kitchen's food ordering platform.

It supports:
- User signup via email or phone with optional referral code
- OTP verification (simulated)
- Food/menu listing and admin-managed updates
- Cart management (add/view/clear)
- Order creation and order status tracking

No full authentication layer is used, as requested. Data is stored with SQLite (`chuks-kitchen.db`).

## 2) How The System Works End-to-End
1. Customer signs up using email or phone.
2. Backend validates duplicate contacts and optional referral code.
3. Backend creates user as unverified and creates OTP verification session.
4. Customer verifies account using OTP (simulation uses `123456`).
5. Customer fetches food list and adds available meals to cart.
6. Customer places order from cart.
7. Backend re-validates availability, recalculates prices, then creates order.
8. Order status progresses through lifecycle:
   `Pending -> Confirmed -> Preparing -> Out for Delivery -> Completed`
9. Customer/Admin can cancel order (except completed orders).

## 3) Flow Explanations
Design flow images already provided in `diagrams/` were followed:
- `User Registration & OTP Verification Flow (Sequence).png`
- `Order Placement Flow (Sequence).png`
- `Order Status Lifecycle (State Diagram).png`
- `ER Diagram (Mermaid).png`

### A. Signup + Verification Flow
1. Accept `fullName` and one of `email` or `phone`.
2. Validate formats.
3. Check duplicates by email/phone.
4. Validate referral code if provided.
5. Create user with `isVerified=false`.
6. Create verification session with:
   - OTP code
   - expiry time
   - attempt limit
7. Verify endpoint checks:
   - active session exists
   - OTP not expired
   - attempts remaining
   - OTP value matches
8. On success, mark user verified.

### B. Menu + Cart Flow
1. Customer fetches foods from `/api/foods`.
2. Admin can add/update foods and toggle availability.
3. Customer adds food to cart.
4. Backend blocks unavailable food at add-to-cart stage.
5. Cart can be fetched and cleared.

### C. Order Placement + Status Flow
1. Customer places order using `userId`.
2. Backend loads cart and rejects empty cart.
3. Backend re-checks each cart item against latest food availability and price.
4. Backend rejects if payment is incomplete (simulation flag).
5. Backend creates order in `Pending`.
6. Cart is cleared.
7. Admin/customer updates or cancels order based on lifecycle rules.

## 4) Edge Case Handling
- User abandons signup midway:
  - Verification fails if no active verification session exists.
- Invalid or expired referral code:
  - Signup still works; referral is marked rejected in response payload.
- Invalid/expired OTP:
  - Invalid OTP reduces attempt count.
  - Expired OTP returns `410`.
  - Too many attempts returns `429`.
- Duplicate email or phone:
  - `409 Conflict`.
- Food becomes unavailable after adding to cart:
  - Order creation re-checks availability and blocks with `409`.
- Customer/Admin cancels order:
  - Allowed except for completed orders.
- Payment not completed:
  - Order creation returns `402`.

## 5) Assumptions
- OTP sending is simulated (no SMS/email provider integration).
- Admin authorization is simulated using `adminKey=admin-123`.
- Payment is simulated with a boolean field `paymentCompleted`.
- Currency defaults to NGN.
- Single-cart-per-user model is used.
- SQL persistence is implemented using SQLite.

## 6) Scalability Thoughts (100 -> 10,000+ users)
- Move from SQLite single-node setup to PostgreSQL.
- Add Redis for OTP sessions and caching food lists.
- Add proper auth and role-based access control (JWT + refresh tokens).
- Add background jobs for notifications/status updates (BullMQ/RabbitMQ).
- Add payment gateway integration with webhook reconciliation.
- Add inventory locking/reservation to avoid overselling at high concurrency.
- Add API rate limiting, observability, and structured logging.

## 7) Data Required Per Screen
### Signup Screen
- Input: `fullName`, `email` or `phone`, optional `referralCode`
- Output: `userId`, `verificationSessionId`, referral validation result

### Verify OTP Screen
- Input: `userId`, `otp`
- Output: `isVerified`, remaining attempts or expiry errors

### Food Listing Screen
- Input: none
- Output: list of foods (`id`, `name`, `description`, `price`, `isAvailable`)

### Cart Screen
- Input: `userId`, `foodId`, `quantity` (for add)
- Output: cart items, line totals, subtotal

### Checkout/Order Screen
- Input: `userId`, simulated `paymentCompleted`
- Output: order id, items, total price, initial status

### Order Tracking Screen
- Input: `orderId`
- Output: current status + status history timeline

### Admin Food Management Screen
- Input: `name`, `description`, `price`, `isAvailable`, `adminKey`
- Output: created/updated food object

### Admin Order Management Screen
- Input: `orderId`, `status` or cancel action, `actor`
- Output: updated order status and history

## 8) Frontend -> Backend Communication (Conceptual)
- Frontend calls REST endpoints with JSON payloads.
- Backend validates payload and business rules.
- Backend returns structured JSON response:
  - `success` boolean
  - `message` string
  - `data` object/array when successful
- Frontend uses returned IDs (`userId`, `orderId`) to chain flows.
- Polling or periodic fetch can be used for order status tracking.

## 9) High-Level API Endpoints
### User APIs
- `POST /api/signup`
- `POST /api/verify`

### Food APIs
- `GET /api/foods`
- `POST /api/foods` (admin simulation)
- `PATCH /api/foods/:id` (admin simulation)

### Cart APIs
- `POST /api/cart/items` (add meal to cart)
- `GET /api/cart/:userId` (view cart)
- `POST /api/cart/:userId/clear` (clear cart)

### Order APIs
- `POST /api/orders` (create order from cart)
- `GET /api/orders` (new endpoint: list orders, optional `?userId=...`)
- `GET /api/orders/:id` (fetch order details/status)
- `PATCH /api/orders/:id/status` (status progression)
- `POST /api/orders/:id/cancel` (cancel order)

### API Docs
- `GET /api-docs` (Swagger UI)

## 10) API Examples
### Signup
```http
POST /api/signup
Content-Type: application/json
```
```json
{
  "fullName": "Ada Nnaji",
  "email": "ada@example.com",
  "referralCode": "CHUKS10"
}
```

### Verify OTP
```http
POST /api/verify
Content-Type: application/json
```
```json
{
  "userId": "user_...",
  "otp": "123456"
}
```

### Add Food (Admin Simulation)
```http
POST /api/foods
Content-Type: application/json
```
```json
{
  "name": "Fried Rice & Turkey",
  "description": "Special fried rice with grilled turkey.",
  "price": 5000,
  "adminKey": "admin-123"
}
```

### Add to Cart
```http
POST /api/cart/items
Content-Type: application/json
```
```json
{
  "userId": "user_...",
  "foodId": "food_1",
  "quantity": 2
}
```

### Create Order
```http
POST /api/orders
Content-Type: application/json
```
```json
{
  "userId": "user_...",
  "paymentCompleted": true
}
```

## 11) Project Structure
```text
src/
  app.js
  server.js
  data/db.js
  routes/
    users.js
    foods.js
    carts.js
    orders.js
  utils/
    helpers.js
    validators.js
docs/
  openapi.json
postman/
  Chuks-Kitchen-API.postman_collection.json
diagrams/
README.md
package.json
```

## 12) Run Instructions
```bash
npm install
npm start
```

Server starts at:
- `http://localhost:4000`

Health check:
- `GET /`

Swagger:
- `GET /api-docs`

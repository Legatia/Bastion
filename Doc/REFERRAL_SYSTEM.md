# Referral System Documentation

## Overview

Bastion's referral system rewards users for bringing in new customers through a sustainable coupon-based model integrated with Polar.sh billing.

## How It Works

### For Referees (New Users)
- Sign up with a referral link: `https://bastion.sh/signup?ref=abc123`
- Get **10% off first payment** (one-time)
- Can immediately start referring others

### For Referrers (Existing Users)
- Share unique referral link
- Earn **1 coupon (5% discount)** per successful referral
- Use up to **10 coupons per month** = **50% max discount**
- Coupons never expire and accumulate forever
- Each coupon is one-time use

### Important Rules
- ✅ Coupons work on STARTER, GROWTH, and PRO tiers
- ❌ Coupons NOT applicable to ENTERPRISE tier (custom pricing)
- ✅ If referred user cancels, one unused coupon is revoked from referrer
- ✅ Only active (paying) referrals count

---

## API Endpoints

### 1. Register with Referral Code

```bash
POST /v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "referral_code": "abc123"  # Optional
}

Response:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "user",
    "tier": "STARTER"
  },
  "apiKey": "bst_live_xxx",
  "referred_by": true
}
```

### 2. Get Referral Code

```bash
GET /v1/referrals/code
X-API-Key: bst_live_xxx

Response:
{
  "referral_code": "abc123",
  "referral_url": "https://bastion.sh/signup?ref=abc123",
  "total_referrals": 10,
  "active_referrals": 8
}
```

### 3. Get Referral Stats

```bash
GET /v1/referrals/stats
X-API-Key: bst_live_xxx

Response:
{
  "summary": {
    "total_referrals": 10,
    "active_referrals": 8,
    "pending_referrals": 2,
    "churned_referrals": 0
  },
  "referrals": [
    {
      "id": "uuid",
      "email": "friend@example.com",
      "tier": "STARTER",
      "status": "ACTIVE",
      "signup_at": "2026-01-01T00:00:00Z",
      "first_payment_at": "2026-01-01T01:00:00Z",
      "cancelled_at": null
    }
  ]
}
```

### 4. Get Coupon Balance

```bash
GET /v1/referrals/coupons
X-API-Key: bst_live_xxx

Response:
{
  "total_coupons": 15,
  "used_coupons": 10,
  "available_coupons": 5,
  "this_month": {
    "coupons_used": 3,
    "coupons_available": 7,
    "discount_applied": "15%"
  },
  "available_discount": "25%",  // 5 coupons × 5% (capped at 50%)
  "max_monthly_discount": "50%",
  "coupon_value": "5%"
}
```

### 5. Preview Invoice with Discounts

```bash
GET /v1/referrals/invoice-preview
X-API-Key: bst_live_xxx

Response:
{
  "user": {
    "email": "user@example.com",
    "tier": "STARTER"
  },
  "baseAmount": "$15.00",
  "discounts": {
    "firstPayment": {
      "label": "First payment discount",
      "amount": "$1.50",
      "percentage": "10%"
    },
    "coupons": {
      "label": "Referral coupons (3 used)",
      "amount": "$2.03",
      "count": 3,
      "percentage": "15%"
    }
  },
  "totalDiscount": "$3.53",
  "finalAmount": "$11.47",
  "finalAmountCents": 1147
}
```

---

## Polar.sh Webhook Integration

Bastion automatically handles Polar webhook events:

### Subscription Created
```json
{
  "type": "subscription.created",
  "data": {
    "user_email": "user@example.com",
    "tier_name": "starter"
  }
}
```
**Actions:**
- Updates user tier
- Marks referral as ACTIVE
- Awards coupon to referrer

### Subscription Cancelled
```json
{
  "type": "subscription.canceled",
  "data": {
    "user_email": "user@example.com"
  }
}
```
**Actions:**
- Marks referral as CHURNED
- Revokes one unused coupon from referrer

### Subscription Updated
```json
{
  "type": "subscription.updated",
  "data": {
    "user_email": "user@example.com",
    "tier_name": "growth"
  }
}
```
**Actions:**
- Updates user tier
- Coupons still applicable (unless ENTERPRISE)

---

## Database Schema

### Coupon Model
```typescript
{
  id: uuid
  userId: uuid
  value: 0.05              // 5% discount
  used: boolean
  usedAt: timestamp?
  earnedFrom: uuid?        // Referral ID
  createdAt: timestamp
}
```

### Referral Model
```typescript
{
  id: uuid
  referrerId: uuid
  referredId: uuid
  status: PENDING | ACTIVE | CHURNED
  signupAt: timestamp
  firstPaymentAt: timestamp?
  cancelledAt: timestamp?
}
```

### MonthlyDiscount Model
```typescript
{
  id: uuid
  userId: uuid
  monthStart: date         // First day of month
  monthEnd: date           // Last day of month
  couponsUsed: int         // Max 10 per month
  discountApplied: float   // Max 0.50 (50%)
}
```

---

## Billing Flow

### 1. User Signs Up
- Optionally provides referral code
- Gets 10% off first payment flag

### 2. First Payment (via Polar)
- Polar webhook triggers `subscription.created`
- Backend:
  1. Applies 10% first payment discount
  2. Applies available coupons (up to 10)
  3. Calculates final amount
  4. Marks referral as ACTIVE
  5. Awards coupon to referrer

### 3. Monthly Billing
- Polar charges automatically
- Backend calculates discounts:
  1. Check monthly usage (max 10 coupons)
  2. Apply oldest coupons first
  3. Update monthly discount record
  4. Return final amount to Polar

### 4. User Cancels
- Polar webhook triggers `subscription.canceled`
- Backend revokes one unused coupon from referrer
- Marks referral as CHURNED

---

## Cost Analysis

### Example: 100 Customers

```
Direct signups: 40 customers
Referred signups: 60 customers

Referrer costs (per month):
├─ 60 referred × 10% first payment = $90 one-time
├─ Assume 20% of referrers use max discount:
│   └─ 12 users × $7.50 (50% off $15) = $90/month
└─ Total monthly discount: ~$150-200

Revenue (before discounts):
├─ 100 customers × $15 avg = $1,500/month

Net revenue: $1,300-1,350/month
Margin lost: 10-13% (sustainable)
```

### vs Traditional CAC
- Paid ads: $200-500 per customer = $20k-50k for 100 customers
- Referrals: $150-200/month ongoing = $1.8-2.4k/year
- **Savings: 10-25x cheaper**

---

## Example User Journeys

### Journey 1: Active Referrer
```
Month 1:
├─ Refer 12 people
├─ 10 convert to paying = 10 coupons earned
├─ Use 10 coupons this month → Pay $7.50 (50% off)
└─ 0 coupons saved

Month 2:
├─ Refer 5 more people
├─ 5 convert = 5 coupons earned
├─ Use 5 coupons this month → Pay $11.25 (25% off)
└─ 0 coupons saved

Month 3:
├─ Refer 0 people
├─ 2 previous referrals cancel → Lose 2 coupons (if had any saved)
└─ Pay full price $15
```

### Journey 2: Passive Accumulator
```
Month 1-6:
├─ Refer 3 people each month = 18 total coupons
├─ Never use them (just accumulating)
└─ Balance: 18 coupons

Month 7:
├─ Decide to use coupons
├─ Use 10 coupons → Pay $7.50 (50% off)
└─ Balance: 8 coupons

Month 8:
├─ Use 8 coupons → Pay $9.00 (40% off)
└─ Balance: 0 coupons
```

---

## Implementation Checklist

- [x] Database schema with Coupon, Referral, MonthlyDiscount models
- [x] CouponManager service (award, revoke, apply coupons)
- [x] BillingService (calculate invoices with discounts)
- [x] Polar webhook handler (subscription lifecycle)
- [x] Referral API endpoints (code, stats, coupons, invoice preview)
- [x] Auth register endpoint (accept referral_code)
- [ ] Frontend integration (signup form, referral dashboard)
- [ ] CLI display (show coupon balance in bastion status)
- [ ] Email notifications (coupon earned, monthly summary)
- [ ] Admin dashboard (referral analytics, fraud detection)

---

## Security Considerations

### Fraud Prevention
- ✅ Only paying customers count (not just signups)
- ✅ Revoke coupon if referred user churns
- ✅ One coupon per referral (can't duplicate)
- ✅ Monthly usage limit (50% max)
- ⚠️ TODO: Same IP detection
- ⚠️ TODO: Email domain analysis (block disposable emails)
- ⚠️ TODO: Referral cap (max 50/month per user)

### Webhook Security
- ⚠️ TODO: Verify Polar webhook signatures
- ⚠️ TODO: Rate limit webhook endpoint
- ✅ Idempotent webhook handling (duplicate events safe)

---

## Next Steps

1. **Push schema to database:**
   ```bash
   npm run db:push
   ```

2. **Test referral flow:**
   ```bash
   # Register with referral
   curl -X POST http://localhost:3000/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"friend@test.com","password":"pass","referral_code":"abc123"}'

   # Get referral code
   curl http://localhost:3000/v1/referrals/code \
     -H "X-API-Key: bst_live_xxx"
   ```

3. **Integrate with frontend:**
   - Add referral_code param to signup form
   - Build referral dashboard page
   - Show coupon balance in account settings

4. **Connect to Polar:**
   - Configure webhook URL in Polar dashboard
   - Test subscription events
   - Verify discount calculation

---

**System is ready to go! 🚀**

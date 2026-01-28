# Configuring Polar.sh for Payments

Bastion uses [Polar.sh](https://polar.sh) to handle subscriptions and billing. Follow these steps to connect your checkout flows.

## 1. Create a Polar.sh Account
1. Go to [https://polar.sh/start](https://polar.sh/start) and sign up (or login).
2. Create an Organization (e.g., "Bastion Protocol").

## 2. Create Products (Tiers)
**Important:** In Polar.sh, you do **not** create one "Subscription" with multiple tiers inside it. Instead, you create a **separate Product** for each tier.

1. Go to **Dashboard > Products**.
2. Click **+ New Product**.
3. Select **Subscription** as the pricing type (not One-Time).

### Starter Tier ($15/mo)
1. Name: `Starter`
3. Price: `$15` (Monthly)
4. Description: `Perfect for solopreneurs...`
5. Click **Create Product**.
6. **Copy the Checkout Link** (e.g., `https://buy.polar.sh/product/123...`).

### Growth Tier ($99/mo)
1. Create another product.
2. Name: `Growth`
3. Price: `$99` (Monthly)
4. **Copy the Checkout Link**.

### Pro Tier ($299/mo)
1. Create another product.
2. Name: `Pro`
3. Price: `$299` (Monthly)
4. **Copy the Checkout Link**.

## 3. Update Environment Variables
Open `dashboard/.env.local` in your editor and paste the links you copied:

```bash
# Polar.sh Payment Links
NEXT_PUBLIC_POLAR_LINK_STARTER=https://buy.polar.sh/product/YOUR_STARTER_LINK
NEXT_PUBLIC_POLAR_LINK_GROWTH=https://buy.polar.sh/product/YOUR_GROWTH_LINK
NEXT_PUBLIC_POLAR_LINK_PRO=https://buy.polar.sh/product/YOUR_PRO_LINK
```

## 4. Verify
1. Restart your dashboard server:
   ```bash
   cd dashboard
   rm -rf .next && npm run dev
   ```
2. Go to `http://localhost:3002/billing`.
3. Click "Start Free Trial" or "Upgrade".
4. It should open the correct Polar.sh checkout page.

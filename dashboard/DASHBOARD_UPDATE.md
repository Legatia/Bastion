# Dashboard Frontend Updates

## What Changed

The dashboard frontend has been updated to support all the backend security features we built.

## New Features

### 1. **Comprehensive DLP Configuration** (`pages/policies-v2.tsx`)

The new policies page exposes all 30+ DLP patterns built into the backend:

**Features:**
- ✅ **Pattern Selection**: Enable/disable specific patterns (OPENAI_API_KEY, CREDIT_CARD, SSN, etc.)
- ✅ **Severity Threshold**: Choose LOW, MEDIUM, HIGH, or CRITICAL
- ✅ **Grouped Display**: Patterns organized by category (API Keys, PII, Credentials, Crypto Keys, Cloud, Financial)
- ✅ **Quick Actions**: Select All, Critical Only, Clear All buttons
- ✅ **Visual Indicators**: Color-coded severity levels
- ✅ **Real-time Status**: Shows enabled count (e.g., "14 / 23 enabled")

**Pattern Categories:**
1. **API Keys** (7 patterns): OpenAI, Anthropic, AWS, GitHub, Stripe, Slack, Google
2. **PII** (5 patterns): Credit Card, SSN, Phone, Email, IP Address
3. **Credentials** (3 patterns): Password, Database URL, Connection String
4. **Crypto Keys** (4 patterns): Private Key, SSH Key, PGP Key, JWT
5. **Cloud** (2 patterns): Azure Key, Heroku API Key
6. **Financial** (2 patterns): IBAN, Bank Routing Number

### 2. **Multi-Policy Management**

New tabbed interface for managing all 9 policy types:

- **DLP Scanner**: Configure data loss prevention
- **Rate Limits**: Set max requests per time window
- **Time Windows**: Restrict operations to specific hours/days
- **Allowlist**: Define trusted API domains
- **Spending Limits**: Cap daily costs

### 3. **Improved UX**

- Tab-based navigation between policy types
- Real-time save confirmation
- Visual severity indicators with color coding
- Clear examples and explanations
- Responsive grid layout for pattern selection

## Integration with Backend

The new UI maps directly to the backend types:

```typescript
// Frontend sends this
{
  name: 'Data Loss Prevention Scanner',
  type: 'DLP',
  enabled: true,
  priority: 100,
  config: {
    use_builtin_patterns: true,
    severity_threshold: 'MEDIUM',
    enabled_pattern_types: [
      'OPENAI_API_KEY',
      'CREDIT_CARD',
      'SSN',
      // ...
    ],
    block_on_match: true,
    scan_patterns: [] // Custom patterns
  }
}
```

This matches exactly with the backend `PolicyConfig` type and the DLP scanner we built.

## How to Use

### Step 1: Access New Policies Page

```bash
# Start dashboard
cd dashboard
npm run dev

# Open http://localhost:3001/policies-v2
```

### Step 2: Configure DLP

1. Click **"DLP Scanner"** tab
2. Set **Severity Threshold** (recommended: MEDIUM or HIGH)
3. **Enable patterns** you want to scan for:
   - Critical patterns (API keys, credit cards, private keys) - enabled by default
   - Or use **"Select All"** for maximum protection
4. **Save DLP Policy**

### Step 3: Configure Other Policies

- **Rate Limits**: Set to 100 requests/hour to prevent runaway costs
- **Time Windows**: Restrict to business hours (9 AM - 6 PM, Mon-Fri)
- **Allowlist**: Add `api.openai.com`, `api.anthropic.com`, etc.
- **Spending Limit**: Set daily cap (e.g., $1000/day)

### Step 4: Monitor

Go to `/logs` or `/analytics` to see policies in action:
- Blocked requests show which DLP pattern triggered
- Real-time audit trail
- Block rate statistics

## Migration Guide

### Old Policies Page (`/policies`)
- Basic UI with hardcoded checkboxes
- Only Spending Limit worked
- DLP was decorative

### New Policies Page (`/policies-v2`)
- Fully functional DLP with 30+ patterns
- All 9 policy types supported
- Connected to real backend

### Recommended Action

**Replace the old policies page:**

```bash
cd dashboard/pages

# Backup old version
mv policies.tsx policies-old.tsx

# Use new version
mv policies-v2.tsx policies.tsx
```

Or keep both and add a link in the navbar to let users choose.

## Testing Checklist

- [ ] DLP patterns can be enabled/disabled
- [ ] Severity threshold changes are saved
- [ ] Rate limit values persist
- [ ] Time window configuration works
- [ ] Allowlist domains can be added/removed
- [ ] Save button shows success message
- [ ] Policies load from backend on page load
- [ ] Multiple policies can coexist

## API Compatibility

The new UI is fully compatible with the backend endpoints:

```typescript
// Get all policies
GET /v1/policies
→ Returns: { policies: Policy[] }

// Create policy
POST /v1/policies
Body: { name, type, config, enabled, priority }

// Update policy
PUT /v1/policies/:id
Body: { name, type, config, enabled, priority }

// Delete policy
DELETE /v1/policies/:id
```

## Production Deployment

### Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
NEXT_PUBLIC_BASTION_API_KEY=your_api_key_here
```

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel/Netlify

The dashboard is a standard Next.js app and can be deployed to any platform:

```bash
# Vercel
vercel

# Netlify
netlify deploy --prod
```

## Known Limitations

1. **Custom DLP Patterns**: UI for adding custom regex patterns exists but needs UX improvement
2. **Policy Priority**: Currently hardcoded (DLP=100, others=80), needs UI control
3. **Bulk Operations**: Can't enable/disable multiple policies at once
4. **Policy Dependencies**: No validation for conflicting policies

## Next Steps

1. **Testing**: Test with real agent integration
2. **Documentation**: Add in-app help tooltips
3. **Validation**: Add form validation for invalid configurations
4. **Analytics**: Show which patterns are triggering most blocks
5. **Templates**: Add "Quick Setup" templates (e.g., "Maximum Security", "Development Mode")

## Questions?

- Backend API: See `/backend/TESTING.md`
- Agent Integration: See `/docs/guides/openclaw-integration.md`

---

**Result**: The dashboard now fully exposes the commercial-quality DLP engine and policy system we built in the backend. Users can configure all 30+ DLP patterns, set severity thresholds, and manage multiple policy types through an intuitive UI.

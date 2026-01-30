# Google OAuth Login Fix

## Problem

Users could authenticate with Google successfully, but after being redirected back to the app, they appeared logged out and were sent back to the login page.

## Root Cause

The Google OAuth `redirect_uri` was set to the root domain (`https://yourapp.vercel.app/`) instead of the login page (`https://yourapp.vercel.app/login`).

When Google redirected back with the access token, users landed on the home page where the token-processing code doesn't run, so they appeared not logged in.

## Solution

### 1. Code Fix (Already Applied)

Changed line 207 in `pages/login.tsx`:

```typescript
// BEFORE (Wrong)
const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
// Result: https://yourapp.vercel.app/

// AFTER (Correct)
const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/login` : '';
// Result: https://yourapp.vercel.app/login
```

### 2. Google Cloud Console Configuration (Required)

You **must** update the authorized redirect URIs in your Google OAuth app:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Select your project

3. Navigate to **APIs & Services** → **Credentials**

4. Click on your OAuth 2.0 Client ID:
   - Client ID: `649641486032-kiqlrnv1k8qtm8hu8uaqk7cb3csgmeu5.apps.googleusercontent.com`

5. Under **Authorized redirect URIs**, add these URLs:

   **For Production (Vercel):**
   ```
   https://yourapp.vercel.app/login
   ```

   **For Development:**
   ```
   http://localhost:3001/login
   ```

   **Important:** Remove the old redirect URIs if they don't end with `/login`

6. Click **Save**

### 3. Deploy to Vercel

```bash
cd dashboard
git add pages/login.tsx
git commit -m "Fix: Google OAuth redirect to /login page"
git push

# Vercel will auto-deploy
```

### 4. Test the Fix

1. Go to your deployed app: `https://yourapp.vercel.app/login`

2. Click **"Continue with Google"**

3. Authenticate with Google

4. You should be redirected to: `https://yourapp.vercel.app/login#access_token=...`

5. The page should process the token and redirect to `/analytics`

6. Check browser console for logs:
   ```
   [Google OAuth] Checking for callback, hash: present
   [Google OAuth] Access token found: ya29...
   [Google OAuth] Calling backend: http://localhost:3000/v1/auth/google
   [Google OAuth] Backend response status: 200
   [Google OAuth] Success! Redirecting to /analytics
   ```

## Debugging

If login still fails, check:

### 1. Console Logs

Open browser DevTools → Console and look for `[Google OAuth]` logs:

```javascript
[Google OAuth] Redirecting to: https://accounts.google.com/o/oauth2/v2/auth?client_id=...
[Google OAuth] Redirect URI: https://yourapp.vercel.app/login
```

### 2. Network Tab

Check the request to `/v1/auth/google`:
- Status should be `200`
- Response should contain `{ apiKey: "bst_live_..." }`

### 3. LocalStorage

After successful login, check localStorage:
```javascript
localStorage.getItem('bastion_api_key')
// Should return: "bst_live_abc123..."
```

### 4. Google Cloud Console

Verify redirect URIs include `/login`:
- ✅ `https://yourapp.vercel.app/login`
- ✅ `http://localhost:3001/login`
- ❌ `https://yourapp.vercel.app/` (wrong - remove this)

### 5. Backend API

Make sure backend is accessible:
```bash
curl https://your-backend.com/v1/health
# Should return: {"status":"healthy"}
```

## Common Issues

### Issue 1: "redirect_uri_mismatch" Error

**Error:** Google shows "Error 400: redirect_uri_mismatch"

**Cause:** The redirect URI in your code doesn't match what's configured in Google Cloud Console

**Fix:**
1. Copy the exact redirect URI from the error message
2. Add it to Google Cloud Console → Authorized redirect URIs
3. Wait 5 minutes for changes to propagate

### Issue 2: Backend Returns 401

**Error:** `[Google OAuth] Backend response status: 401`

**Cause:** Google access token is invalid or expired

**Fix:**
1. Check if backend can reach Google's API
2. Verify token is being sent correctly:
   ```typescript
   body: JSON.stringify({ access_token: accessToken })
   ```

### Issue 3: Token Not Found in Hash

**Error:** `[Google OAuth] Checking for callback, hash: empty`

**Cause:** Google didn't redirect back with a token, or token was lost

**Fix:**
1. Check Google Cloud Console → OAuth consent screen is published
2. Verify OAuth 2.0 Client ID is active
3. Check browser doesn't block third-party cookies

### Issue 4: CORS Error

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Cause:** Backend doesn't allow requests from your frontend domain

**Fix:** Update backend CORS configuration:
```typescript
// backend/src/index.ts
app.use(cors({
  origin: [
    'http://localhost:3001',
    'https://yourapp.vercel.app'
  ],
  credentials: true,
}));
```

## Environment Variables

Make sure these are set in Vercel:

```bash
# .env.local (or Vercel Environment Variables)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=649641486032-kiqlrnv1k8qtm8hu8uaqk7cb3csgmeu5.apps.googleusercontent.com
NEXT_PUBLIC_API_URL=https://your-backend.com/v1
```

## Security Notes

**Implicit Flow Warning:**
The current implementation uses OAuth Implicit Flow (`response_type=token`), which exposes the access token in the URL. For production, consider:

1. **Switch to Authorization Code Flow** (more secure):
   - Requires backend to handle token exchange
   - Tokens never exposed in URL
   - Supports refresh tokens

2. **Use a third-party auth provider**:
   - NextAuth.js
   - Auth0
   - Clerk
   - Supabase Auth

## Alternative: Authorization Code Flow (Recommended for Production)

If you want maximum security, implement Authorization Code Flow:

```typescript
// login.tsx - Use response_type=code instead of token
const responseType = 'code'; // More secure

// After Google redirects back with ?code=...
const code = new URLSearchParams(window.location.search).get('code');

// Exchange code for token on backend (not frontend)
fetch(`${API_BASE_URL}/auth/google/callback`, {
  method: 'POST',
  body: JSON.stringify({ code }),
});
```

Then update backend to exchange the code for an access token server-side.

## Support

If the issue persists:

1. Check all console logs
2. Verify Google Cloud Console settings
3. Test with a different browser (incognito mode)
4. Clear browser cache and cookies
5. Try with a different Google account

---

**After applying this fix, Google OAuth should work correctly on Vercel!** 🎉

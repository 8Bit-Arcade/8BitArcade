# Admin Panel Setup Guide

This guide explains how to fix the admin panel errors and properly configure the deployment.

## Issues Encountered

### 1. CORS Error: "undefined" in Firebase Functions URL
```
Access to fetch at 'https://us-central1-undefined.cloudfunctions.net/getUserBanInfo' from origin 'https://play.8bitarcade.games' has been blocked by CORS policy
```

**Cause**: Missing Firebase environment variables in production deployment

**Solution**: Configure environment variables in your deployment platform (Vercel/Netlify/etc.)

### 2. Reown/WalletConnect Allowlist Error
```
Origin https://play.8bitarcade.games not found on Allowlist - update configuration on cloud.reown.com
```

**Cause**: Admin panel origin not allowlisted in Reown Cloud

**Solution**: Add origin to Reown allowlist (see below)

## Required Environment Variables

Add these environment variables to your production deployment:

### Firebase Configuration
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### WalletConnect/Reown Configuration
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## How to Find Your Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon (⚙️) → Project settings
4. Scroll to "Your apps" section
5. Select your web app or create one
6. Copy the configuration values from `firebaseConfig`

## Deployment Platform Configuration

### Vercel
1. Go to your project → Settings → Environment Variables
2. Add each variable:
   - **Name**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - **Value**: Your Firebase project ID
   - **Environment**: Production (and Preview if needed)
3. Click "Save"
4. Redeploy your application

### Netlify
1. Go to Site settings → Build & deploy → Environment
2. Click "Edit variables"
3. Add each environment variable
4. Click "Save"
5. Trigger a new deploy

### Other Platforms
Refer to your platform's documentation on setting environment variables.

## Reown (WalletConnect) Allowlist Configuration

1. Go to [Reown Cloud](https://cloud.reown.com)
2. Log in to your account
3. Select your project (or create one if needed)
4. Go to Settings → Allowlist
5. Add the following origins:
   - `https://play.8bitarcade.games`
   - `https://8bitarcade.games` (if main domain)
   - `https://www.8bitarcade.games` (if using www)
   - `http://localhost:3000` (for local development)
6. Save changes

## Firebase Functions CORS Configuration

The admin functions have been updated to allow CORS from the following origins:
- `http://localhost:3000` (development)
- `https://play.8bitarcade.games` (production)
- `https://www.8bitarcade.games`
- `https://8bitarcade.games`

**To deploy the updated functions:**

```bash
cd functions
npm run build
firebase deploy --only functions
```

## Testing the Admin Panel

After configuration:

1. Clear your browser cache
2. Navigate to `/admin` on your production site
3. Connect your wallet (must be an admin address)
4. Try looking up a player ID
5. Verify no CORS errors in browser console

## Admin Wallet Addresses

Admin addresses are configured in `/home/user/8BitArcade/functions/src/admin/adminFunctions.ts`:

```typescript
const ADMIN_ADDRESSES = [
  '0x92f5523c2329ee281e7feb8808fce4b49ab1ebf8', // 8BitToken owner wallet
];
```

To add more admin addresses, edit this file and redeploy functions.

## Troubleshooting

### Still seeing "undefined" in URL?
- Verify environment variables are set in deployment platform
- Check variable names are exactly as shown (case-sensitive)
- Trigger a fresh deployment after adding variables
- Check build logs for any environment variable errors

### Still seeing CORS errors?
- Verify functions were redeployed after CORS configuration
- Check browser console for specific CORS error message
- Verify the origin in error matches one in corsOptions
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Reown allowlist still blocking?
- Verify you're using the correct Reown project
- Check the origin matches exactly (https vs http, www vs non-www)
- Wait a few minutes for changes to propagate
- Clear browser cache and cookies

### Admin access denied?
- Verify your wallet address is in ADMIN_ADDRESSES array
- Addresses must be lowercase in the array
- Check you're connected with the correct wallet
- Verify Firebase Functions were redeployed

## Security Notes

1. **Never commit .env files** - They contain sensitive credentials
2. **Use environment variables** - Set them in deployment platform only
3. **Restrict admin access** - Only add trusted wallet addresses
4. **Monitor admin actions** - Check Firebase Functions logs regularly
5. **CORS origins** - Only add domains you control

## Support

If you continue to experience issues:
1. Check Firebase Functions logs: `firebase functions:log`
2. Check browser console for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure functions are deployed: `firebase deploy --only functions`

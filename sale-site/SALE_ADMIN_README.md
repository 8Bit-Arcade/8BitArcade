# Sale Admin Panel - Setup Guide

This document describes the sale admin panel for managing the 8BIT token sale.

## Features

### 📊 Real-Time Statistics
- Total raised (ETH + USDC combined)
- Tokens sold
- Total unique buyers
- Average purchase size

### ⚙️ Sale Configuration
- Set sale start and end times
- Configure hard cap
- Set tokens for sale amount
- Sync configuration to smart contract

### 📋 Purchase Tracking
- View all purchases in real-time
- Track payment method (ETH/USDC)
- View transaction hashes
- Export data

### 👥 Buyer Management
- View all buyers
- See total tokens purchased per address
- Track ETH and USDC spent
- Monitor purchase frequency

### 🔧 Contract Controls
- Update token prices (tokens per ETH/USDC)
- Pause/unpause sale
- Finalize sale (burn unsold tokens)
- Withdraw funds to designated address

## Security

The admin panel uses the same security model as the main admin panel:

- **Wallet-based authentication**: Only authorized wallet addresses can access
- **Admin whitelist**: Hardcoded admin addresses in both frontend and backend
- **Smart contract owner verification**: Admin functions require contract owner
- **Firebase Cloud Functions**: Server-side validation of all admin actions

### Admin Wallet Addresses

Update these in both files:
- `sale-admin.js` - Line 31
- `functions/src/sale/saleAdminFunctions.ts` - Line 9

```javascript
const ADMIN_ADDRESSES = [
    '0x92f5523c2329ee281e7feb8808fce4b49ab1ebf8', // 8BitToken owner wallet
    // Add more admin addresses here
];
```

## Setup Instructions

### 1. Firebase Configuration

**Update Firebase config in `sale-admin.js` (lines 6-13):**

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 2. Deploy Firebase Cloud Functions

**Export the new sale admin functions in `functions/src/index.ts`:**

```typescript
// Sale Admin Functions
export {
    trackPurchase,
    getAllPurchases,
    getAllBuyers,
    getSaleStats,
    updateSaleConfig,
    getSaleConfig
} from './sale/saleAdminFunctions';
```

**Deploy functions:**

```bash
cd functions
npm install
firebase deploy --only functions
```

### 3. Firestore Database Setup

**Create these collections (they will be auto-created on first purchase):**

1. **sale_purchases** - Tracks individual purchases
   ```
   {
     txHash: string (document ID)
     buyer: string (lowercase address)
     tokenAmount: string
     ethSpent: string
     usdcSpent: string
     paymentMethod: 'ETH' | 'USDC'
     timestamp: number
     createdAt: timestamp
   }
   ```

2. **sale_buyers** - Aggregates buyer data
   ```
   {
     address: string (lowercase, document ID)
     totalTokens: number
     totalEthSpent: number
     totalUsdcSpent: number
     purchaseCount: number
     firstPurchase: timestamp
     lastPurchase: timestamp
   }
   ```

3. **sale_config** - Stores sale configuration
   ```
   Document ID: "current"
   {
     startTime: number (unix timestamp)
     endTime: number (unix timestamp)
     hardCap: number (USD)
     tokensForSale: number
     updatedAt: timestamp
     updatedBy: string (admin address)
   }
   ```

**Firestore Security Rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sale purchases - public read, admin write
    match /sale_purchases/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Sale buyers - public read, admin write
    match /sale_buyers/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Sale config - public read, admin write
    match /sale_config/{document=**} {
      allow read: if true;
      allow write: if request.auth != null; // Admin check done in Cloud Function
    }
  }
}
```

### 4. Update Contract Addresses

**Update in `sale-admin.js` (lines 17-22):**

```javascript
const CONTRACTS = {
    TOKEN_SALE: '0xYOUR_TOKEN_SALE_ADDRESS',
    EIGHT_BIT_TOKEN: '0xYOUR_8BIT_TOKEN_ADDRESS',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum One
    CHAIN_ID: 42161,
    CHAIN_NAME: 'Arbitrum One'
};
```

**Also update in `sale.js` for public sale page.**

### 5. Enable Purchase Tracking

**Add Firebase to `sale.html` (before closing `</body>` tag):**

```html
<!-- Firebase (optional - for purchase tracking) -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-functions-compat.js"></script>

<!-- Firebase config -->
<script>
const firebaseConfig = {
    // Your config here
};
firebase.initializeApp(firebaseConfig);
</script>
```

## Usage

### Accessing the Admin Panel

1. Navigate to `https://yourdomain.com/sale-admin.html`
2. Click "Connect Wallet"
3. Connect with an authorized admin wallet
4. You'll be redirected to the admin panel

### Setting Sale Times

1. Go to "Sale Configuration" tab
2. Set start and end times using the date/time pickers
3. Click "Update Configuration" to save to Firestore
4. Click "Sync to Smart Contract" to update the on-chain values

**Important:** The smart contract uses Unix timestamps. The admin panel automatically converts your selected date/time to Unix timestamps.

### Updating Token Prices

1. Go to "Contract Controls" tab
2. Enter new values for:
   - Tokens per ETH (e.g., 10000 for 1 ETH = 10,000 8BIT)
   - Tokens per USDC (e.g., 2000 for 1 USDC = 2,000 8BIT)
3. Click "Update Prices"
4. Confirm the transaction in MetaMask

### Monitoring Purchases

1. Go to "Recent Purchases" tab to see all transactions
2. Go to "Top Buyers" tab to see aggregated buyer data
3. Click "Refresh" to update all data

### Pausing the Sale

If you need to pause the sale (emergency or maintenance):

1. Go to "Contract Controls" tab
2. Click "Pause Sale"
3. Confirm the transaction
4. Sale will be paused immediately
5. Click "Unpause Sale" when ready to resume

### Finalizing the Sale

**⚠️ THIS ACTION IS PERMANENT AND CANNOT BE UNDONE**

When the sale is complete:

1. Ensure you've withdrawn all funds first (recommended)
2. Go to "Contract Controls" tab
3. Click "Finalize Sale"
4. Confirm multiple times (this is permanent!)
5. All unsold tokens will be burned
6. Sale will be permanently ended

### Withdrawing Funds

You can withdraw funds at any time (during or after the sale):

1. Go to "Contract Controls" tab
2. Enter recipient address
3. Click "Withdraw All Funds"
4. Confirm transaction
5. All ETH and USDC will be transferred

## Troubleshooting

### "Access Denied" Error

- Verify your wallet address is in the `ADMIN_ADDRESSES` array
- Ensure addresses are lowercase
- Check that you're connected to the correct network (Arbitrum One)

### Purchases Not Showing

- Verify Firebase functions are deployed
- Check browser console for errors
- Ensure Firestore security rules allow reads
- Verify contract is emitting `TokensPurchased` events

### "Contract Not Loaded" Error

- Update contract addresses in `sale-admin.js`
- Ensure you're connected to Arbitrum One
- Verify contract is deployed and verified

### Transaction Fails

- Check you're using the contract owner wallet
- Ensure you have enough ETH for gas
- Verify sale is not already finalized
- Check contract is not paused (if trying to buy)

## Database Queries

### Get Total Revenue

```javascript
// In Firestore console or using Firebase Admin SDK
db.collection('sale_buyers')
  .get()
  .then(snapshot => {
    let totalEth = 0;
    let totalUsdc = 0;
    snapshot.docs.forEach(doc => {
      totalEth += doc.data().totalEthSpent || 0;
      totalUsdc += doc.data().totalUsdcSpent || 0;
    });
    console.log('Total ETH:', totalEth);
    console.log('Total USDC:', totalUsdc);
  });
```

### Export All Buyers to CSV

```javascript
// You can add this function to sale-admin.js
async function exportBuyersCSV() {
    const getAllBuyers = functions.httpsCallable('getAllBuyers');
    const result = await getAllBuyers({ limit: 1000 });
    const buyers = result.data;

    const csv = 'Address,Tokens,ETH Spent,USDC Spent,Purchases\n' +
        buyers.map(b =>
            `${b.address},${b.totalTokens},${b.totalEthSpent},${b.totalUsdcSpent},${b.purchaseCount}`
        ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'buyers.csv';
    a.click();
}
```

## Security Best Practices

1. **Never share your admin private key**
2. **Use a hardware wallet** for admin operations
3. **Test on testnet first** before mainnet deployment
4. **Verify all transactions** in MetaMask before confirming
5. **Backup your Firebase config** securely
6. **Monitor Firestore usage** to prevent unexpected costs
7. **Set up Firebase alerts** for unusual activity
8. **Keep admin addresses list minimal** - only add trusted wallets

## Support

For issues or questions:
- Check browser console for errors
- Verify all setup steps completed
- Review smart contract on Arbiscan
- Contact the dev team

## Updates

- v1.0.0 - Initial release with purchase tracking and admin controls
- Updated hard cap from $100k to $200k (January 2025)

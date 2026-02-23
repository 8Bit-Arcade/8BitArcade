import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections } from '../config/firebase';
import * as admin from 'firebase-admin';

/**
 * Admin wallet addresses (lowercase)
 * Same as main admin addresses - must be contract owner
 */
const ADMIN_ADDRESSES = [
  '0x92f5523c2329ee281e7feb8808fce4b49ab1ebf8', // 8BitToken owner wallet
  // Add more admin addresses here as needed
];

/**
 * Check if the authenticated user is an admin
 */
async function isAdmin(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;

  const address = uid.toLowerCase();

  // Check hardcoded admin list
  if (ADMIN_ADDRESSES.includes(address)) {
    return true;
  }

  // Check Firestore for admin role
  const userDoc = await collections.users.doc(address).get();
  return userDoc.data()?.isAdmin === true;
}

/**
 * Track a purchase in Firestore
 * Called when TokensPurchased event is detected
 */
export const trackPurchase = onCall<{
  txHash: string;
  buyer: string;
  amount: string;
  ethSpent: string;
  usdcSpent: string;
  timestamp: number;
}, Promise<{ success: boolean; message: string }>>(async (request) => {
  // This can be called by anyone, but we'll verify the transaction on-chain
  const { txHash, buyer, amount, ethSpent, usdcSpent, timestamp } = request.data;

  if (!txHash || !buyer || !amount) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    const purchaseData = {
      txHash,
      buyer: buyer.toLowerCase(),
      tokenAmount: amount,
      ethSpent: ethSpent || '0',
      usdcSpent: usdcSpent || '0',
      paymentMethod: ethSpent !== '0' ? 'ETH' : 'USDC',
      timestamp: timestamp || Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store in purchases collection
    await admin.firestore()
      .collection('sale_purchases')
      .doc(txHash)
      .set(purchaseData);

    // Update buyer's total purchases
    const buyerRef = admin.firestore().collection('sale_buyers').doc(buyer.toLowerCase());
    const buyerDoc = await buyerRef.get();

    if (buyerDoc.exists) {
      await buyerRef.update({
        totalTokens: admin.firestore.FieldValue.increment(parseFloat(amount)),
        totalEthSpent: admin.firestore.FieldValue.increment(parseFloat(ethSpent || '0')),
        totalUsdcSpent: admin.firestore.FieldValue.increment(parseFloat(usdcSpent || '0')),
        purchaseCount: admin.firestore.FieldValue.increment(1),
        lastPurchase: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await buyerRef.set({
        address: buyer.toLowerCase(),
        totalTokens: parseFloat(amount),
        totalEthSpent: parseFloat(ethSpent || '0'),
        totalUsdcSpent: parseFloat(usdcSpent || '0'),
        purchaseCount: 1,
        firstPurchase: admin.firestore.FieldValue.serverTimestamp(),
        lastPurchase: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log(`Purchase tracked: ${txHash} - ${buyer} bought ${amount} tokens`);

    return {
      success: true,
      message: 'Purchase tracked successfully',
    };
  } catch (error: any) {
    console.error('Error tracking purchase:', error);
    throw new HttpsError('internal', `Failed to track purchase: ${error.message}`);
  }
});

/**
 * Get all purchases (admin only)
 */
export const getAllPurchases = onCall<{
  limit?: number;
  startAfter?: string;
}, Promise<any[]>>(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Verify admin privileges
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const { limit = 100, startAfter } = request.data;

  try {
    let query = admin.firestore()
      .collection('sale_purchases')
      .orderBy('timestamp', 'desc')
      .limit(Math.min(limit, 500));

    if (startAfter) {
      const startDoc = await admin.firestore().collection('sale_purchases').doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    const purchases = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`Admin ${request.auth.uid} requested purchases list`);

    return purchases;
  } catch (error: any) {
    console.error('Error getting purchases:', error);
    throw new HttpsError('internal', `Failed to get purchases: ${error.message}`);
  }
});

/**
 * Get all buyers (admin only)
 */
export const getAllBuyers = onCall<{
  limit?: number;
}, Promise<any[]>>(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Verify admin privileges
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const { limit = 100 } = request.data;

  try {
    const snapshot = await admin.firestore()
      .collection('sale_buyers')
      .orderBy('totalTokens', 'desc')
      .limit(Math.min(limit, 500))
      .get();

    const buyers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`Admin ${request.auth.uid} requested buyers list`);

    return buyers;
  } catch (error: any) {
    console.error('Error getting buyers:', error);
    throw new HttpsError('internal', `Failed to get buyers: ${error.message}`);
  }
});

/**
 * Get sale statistics (admin only)
 */
export const getSaleStats = onCall<{}, Promise<{
  totalPurchases: number;
  totalBuyers: number;
  totalTokensSold: number;
  totalEthRaised: number;
  totalUsdcRaised: number;
  averagePurchase: number;
}>>(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Verify admin privileges
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  try {
    // Get total buyers
    const buyersSnapshot = await admin.firestore().collection('sale_buyers').get();
    const totalBuyers = buyersSnapshot.size;

    // Get total purchases
    const purchasesSnapshot = await admin.firestore().collection('sale_purchases').get();
    const totalPurchases = purchasesSnapshot.size;

    // Calculate totals
    let totalTokensSold = 0;
    let totalEthRaised = 0;
    let totalUsdcRaised = 0;

    buyersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalTokensSold += data.totalTokens || 0;
      totalEthRaised += data.totalEthSpent || 0;
      totalUsdcRaised += data.totalUsdcSpent || 0;
    });

    const averagePurchase = totalBuyers > 0 ? totalTokensSold / totalBuyers : 0;

    console.log(`Admin ${request.auth.uid} requested sale statistics`);

    return {
      totalPurchases,
      totalBuyers,
      totalTokensSold,
      totalEthRaised,
      totalUsdcRaised,
      averagePurchase,
    };
  } catch (error: any) {
    console.error('Error getting sale stats:', error);
    throw new HttpsError('internal', `Failed to get sale stats: ${error.message}`);
  }
});

/**
 * Update sale configuration (admin only)
 */
export const updateSaleConfig = onCall<{
  startTime?: number;
  endTime?: number;
  hardCap?: number;
  tokensForSale?: number;
}, Promise<{ success: boolean; message: string }>>(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Verify admin privileges
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const { startTime, endTime, hardCap, tokensForSale } = request.data;

  try {
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };

    if (startTime !== undefined) {
      updateData.startTime = startTime;
    }
    if (endTime !== undefined) {
      updateData.endTime = endTime;
    }
    if (hardCap !== undefined) {
      updateData.hardCap = hardCap;
    }
    if (tokensForSale !== undefined) {
      updateData.tokensForSale = tokensForSale;
    }

    await admin.firestore()
      .collection('sale_config')
      .doc('current')
      .set(updateData, { merge: true });

    console.log(`Admin ${request.auth.uid} updated sale config:`, updateData);

    return {
      success: true,
      message: 'Sale configuration updated successfully',
    };
  } catch (error: any) {
    console.error('Error updating sale config:', error);
    throw new HttpsError('internal', `Failed to update sale config: ${error.message}`);
  }
});

/**
 * Get sale configuration
 */
export const getSaleConfig = onCall<{}, Promise<any>>(async (request) => {
  try {
    const configDoc = await admin.firestore()
      .collection('sale_config')
      .doc('current')
      .get();

    if (!configDoc.exists) {
      return {
        startTime: null,
        endTime: null,
        hardCap: 200000, // Default $200k
        tokensForSale: 200000000, // Default 200M tokens
      };
    }

    return configDoc.data();
  } catch (error: any) {
    console.error('Error getting sale config:', error);
    throw new HttpsError('internal', `Failed to get sale config: ${error.message}`);
  }
});

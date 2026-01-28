import * as admin from "firebase-admin";

const db = admin.firestore();

export async function canClaim(userId: string) {
  const ref = db.collection("faucetClaims").doc(userId);
  const doc = await ref.get();

  if (!doc.exists) return true;

  const last = doc.data()!.lastClaim.toDate();
  const diff = (Date.now() - last.getTime()) / 3600000;

  return diff >= 24;
}

export async function recordClaim(userId: string) {
  await db.collection("faucetClaims").doc(userId).set({
    lastClaim: new Date(),
  });
}

/**
 * Professional wallet signature messages for 8-Bit Arcade
 * Styled similar to CoinMarketCap for a clean, trustworthy appearance
 */

export type SignatureAction =
  | 'sign_in'
  | 'set_username'
  | 'enter_tournament'
  | 'claim_rewards'
  | 'admin_action';

interface SignatureMessageParams {
  action: SignatureAction;
  address: string;
  nonce?: string;
  timestamp?: number;
  extra?: Record<string, string>;
}

const ACTION_DESCRIPTIONS: Record<SignatureAction, { title: string; description: string }> = {
  sign_in: {
    title: 'Sign In',
    description: 'Sign in to 8-Bit Arcade to access ranked games, leaderboards, and earn rewards.',
  },
  set_username: {
    title: 'Set Username',
    description: 'Set your display name for leaderboards. This will be visible to other players.',
  },
  enter_tournament: {
    title: 'Enter Tournament',
    description: 'Confirm your tournament entry. Entry fees will be processed separately.',
  },
  claim_rewards: {
    title: 'Claim Rewards',
    description: 'Claim your earned 8BIT token rewards to your wallet.',
  },
  admin_action: {
    title: 'Admin Action',
    description: 'Authorize an administrative action on the platform.',
  },
};

/**
 * Generate a UUID v4 nonce
 */
export function generateNonce(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format address for display (0x1234...5678)
 */
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Generate a professional signature message
 */
export function createSignatureMessage(params: SignatureMessageParams): string {
  const {
    action,
    address,
    nonce = generateNonce(),
    timestamp = Date.now(),
    extra = {},
  } = params;

  const actionInfo = ACTION_DESCRIPTIONS[action];
  const isoTimestamp = new Date(timestamp).toISOString();

  let message = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       🎮 8-BIT ARCADE 🎮
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${actionInfo.description}

Please sign this message to verify your wallet ownership.
This action will NOT cost any gas fees.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Action: ${actionInfo.title}

Address: ${address}

Nonce: ${nonce}

Timestamp: ${isoTimestamp}`;

  // Add any extra fields
  Object.entries(extra).forEach(([key, value]) => {
    message += `\n\n${key}: ${value}`;
  });

  message += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return message.trim();
}

/**
 * Create a simple signature message (for compatibility)
 */
export function createSimpleSignatureMessage(
  action: SignatureAction,
  address: string
): { message: string; nonce: string; timestamp: number } {
  const nonce = generateNonce();
  const timestamp = Date.now();

  const message = createSignatureMessage({
    action,
    address,
    nonce,
    timestamp,
  });

  return { message, nonce, timestamp };
}

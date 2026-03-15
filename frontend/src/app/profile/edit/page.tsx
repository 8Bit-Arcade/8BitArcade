'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { callFunction } from '@/lib/firebase-functions';

const FRAME_LABELS = [
  { label: 'Green', color: 'border-arcade-green shadow-[0_0_8px_rgba(0,255,65,0.4)]' },
  { label: 'Cyan', color: 'border-arcade-cyan shadow-[0_0_8px_rgba(0,191,255,0.4)]' },
  { label: 'Gold', color: 'border-yellow-400 shadow-[0_0_8px_rgba(255,200,0,0.4)]' },
  { label: 'Red', color: 'border-red-500 shadow-[0_0_8px_rgba(255,50,50,0.4)]' },
  { label: 'Purple', color: 'border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]' },
  { label: 'Pink', color: 'border-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]' },
  { label: 'Orange', color: 'border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' },
  { label: 'White', color: 'border-white shadow-[0_0_8px_rgba(255,255,255,0.3)]' },
];

export default function EditProfilePage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFrame, setAvatarFrame] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [socialTwitter, setSocialTwitter] = useState('');
  const [socialDiscord, setSocialDiscord] = useState('');
  const [privacyShowWinRate, setPrivacyShowWinRate] = useState(true);
  const [privacyShowEarnings, setPrivacyShowEarnings] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing profile
  useEffect(() => {
    if (!address) return;
    const load = async () => {
      try {
        const result = await callFunction<any, any>('getUserProfile', { address: address.toLowerCase() });
        setDisplayName(result.displayName || '');
        setBio(result.bio || '');
        setAvatarFrame(result.avatarFrame || 0);
        setAvatarUrl(result.avatarUrl || null);
        setSocialTwitter(result.socialTwitter || '');
        setSocialDiscord(result.socialDiscord || '');
        setPrivacyShowWinRate(result.privacyShowWinRate ?? true);
        setPrivacyShowEarnings(result.privacyShowEarnings ?? false);
      } catch (err) {
        // Profile may not exist yet
      }
    };
    load();
  }, [address]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !address) return;

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      setError('Image must be under 2MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const { getFirebaseApp } = await import('@/lib/firebase-client');
      const app = await getFirebaseApp();
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const storage = getStorage(app);
      const storageRef = ref(storage, `avatars/${address.toLowerCase()}/avatar`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      setAvatarUrl(url);
    } catch (err: any) {
      setError('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!address || saving) return;
    setSaving(true);
    setError('');

    try {
      await callFunction('updateUserProfile', {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarFrame,
        avatarUrl,
        socialTwitter: socialTwitter.trim(),
        socialDiscord: socialDiscord.trim(),
        privacyShowWinRate,
        privacyShowEarnings,
      });
      setSaved(true);
      setTimeout(() => {
        router.push(`/profile/${address.toLowerCase()}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-arcade-dark flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">🔌</div>
          <div className="font-pixel text-arcade-green">Connect your wallet to edit your profile</div>
        </div>
      </div>
    );
  }

  const frameStyle = FRAME_LABELS[avatarFrame].color;

  return (
    <div className="min-h-screen bg-arcade-dark px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-pixel text-arcade-green text-lg">✏️ EDIT PROFILE</h1>
          <Link
            href={`/profile/${address?.toLowerCase()}`}
            className="font-pixel text-xs text-gray-500 hover:text-arcade-green"
          >← VIEW PROFILE</Link>
        </div>

        {/* Avatar section */}
        <div className="bg-black/30 border border-arcade-green/20 rounded-xl p-5 space-y-4">
          <div className="font-pixel text-xs text-gray-400">AVATAR</div>

          <div className="flex items-center gap-5">
            {/* Preview */}
            <div className={`w-20 h-20 rounded-lg border-2 overflow-hidden shrink-0 ${frameStyle}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-arcade-dark flex items-center justify-center font-pixel text-4xl">
                  👾
                </div>
              )}
            </div>

            {/* Upload controls */}
            <div className="space-y-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="font-pixel text-xs px-4 py-2 border border-arcade-green/50 text-arcade-green
                           rounded hover:bg-arcade-green/10 transition-colors disabled:opacity-40"
              >
                {uploading ? 'UPLOADING...' : '📁 UPLOAD IMAGE'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              {avatarUrl && (
                <button
                  onClick={() => setAvatarUrl(null)}
                  className="font-pixel text-xs text-red-400 hover:text-red-300 block"
                >Remove avatar</button>
              )}
              <p className="font-pixel text-xs text-gray-600">PNG, JPG, GIF · max 2MB</p>
            </div>
          </div>

          {/* Frame selection */}
          <div>
            <div className="font-pixel text-xs text-gray-500 mb-2">AVATAR FRAME STYLE</div>
            <div className="grid grid-cols-8 gap-1.5">
              {FRAME_LABELS.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setAvatarFrame(i)}
                  className={`w-8 h-8 rounded border-2 transition-all ${f.color}
                    ${avatarFrame === i ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-70'}`}
                  title={f.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="bg-black/30 border border-arcade-green/20 rounded-xl p-5 space-y-4">
          <div className="font-pixel text-xs text-gray-400">PLAYER INFO</div>

          <div className="space-y-3">
            <FormField label="DISPLAY NAME" hint="Max 30 characters">
              <input
                type="text"
                maxLength={30}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Enter display name..."
                className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2
                           font-pixel text-sm text-gray-200 placeholder-gray-600
                           focus:outline-none focus:border-arcade-green/60"
              />
            </FormField>

            <FormField label="BIO" hint={`${bio.length}/280`}>
              <textarea
                maxLength={280}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell the arena about yourself..."
                rows={3}
                className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2
                           font-pixel text-sm text-gray-200 placeholder-gray-600
                           focus:outline-none focus:border-arcade-green/60 resize-none"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="TWITTER / X" hint="Username only">
                <div className="flex items-center border border-gray-600 rounded bg-black/40
                                focus-within:border-arcade-cyan/60">
                  <span className="font-pixel text-xs text-gray-600 pl-3">@</span>
                  <input
                    type="text"
                    value={socialTwitter}
                    onChange={e => setSocialTwitter(e.target.value.replace('@', ''))}
                    placeholder="username"
                    maxLength={50}
                    className="flex-1 bg-transparent px-2 py-2 font-pixel text-sm text-gray-200
                               placeholder-gray-600 focus:outline-none"
                  />
                </div>
              </FormField>

              <FormField label="DISCORD" hint="Username">
                <input
                  type="text"
                  value={socialDiscord}
                  onChange={e => setSocialDiscord(e.target.value)}
                  placeholder="username#0000"
                  maxLength={50}
                  className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2
                             font-pixel text-sm text-gray-200 placeholder-gray-600
                             focus:outline-none focus:border-arcade-cyan/60"
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Privacy section */}
        <div className="bg-black/30 border border-arcade-green/20 rounded-xl p-5 space-y-3">
          <div className="font-pixel text-xs text-gray-400">PRIVACY SETTINGS</div>

          <ToggleRow
            label="Show win/loss record publicly"
            description="Others can see your PvP win rate"
            checked={privacyShowWinRate}
            onChange={setPrivacyShowWinRate}
          />
          <ToggleRow
            label="Show earnings publicly"
            description="Others can see your token earnings"
            checked={privacyShowEarnings}
            onChange={setPrivacyShowEarnings}
          />
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-900/20 border border-red-500/40 rounded">
            <p className="font-pixel text-xs text-red-400">⚠ {error}</p>
          </div>
        )}

        {saved && (
          <div className="px-3 py-2 bg-arcade-green/10 border border-arcade-green/40 rounded text-center">
            <p className="font-pixel text-xs text-arcade-green">✓ Profile saved! Redirecting...</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/profile/${address?.toLowerCase()}`}
            className="flex-1 text-center font-pixel text-xs py-2.5 border border-gray-600 text-gray-400
                       rounded hover:border-gray-400 transition-colors"
          >CANCEL</Link>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="flex-1 font-pixel text-sm py-2.5 bg-arcade-green/20 border border-arcade-green
                       text-arcade-green rounded hover:bg-arcade-green/30 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed glow-green"
          >
            {saving ? 'SAVING...' : saved ? '✓ SAVED!' : '💾 SAVE PROFILE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-pixel text-xs text-gray-500">{label}</span>
        {hint && <span className="font-pixel text-xs text-gray-700">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-pixel text-xs text-gray-300">{label}</div>
        <div className="font-pixel text-xs text-gray-600">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0
          ${checked ? 'bg-arcade-green' : 'bg-gray-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

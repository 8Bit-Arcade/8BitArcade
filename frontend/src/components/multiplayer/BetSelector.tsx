'use client';

import { useState } from 'react';
import { BET_PRESETS } from '@/types/pvp';

interface BetSelectorProps {
  value: number;
  onChange: (amount: number) => void;
  userBalance: number;
  disabled?: boolean;
}

export default function BetSelector({ value, onChange, userBalance, disabled }: BetSelectorProps) {
  const [customInput, setCustomInput] = useState('');
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const handlePreset = (amount: number) => {
    setActivePreset(amount);
    setCustomInput('');
    onChange(amount);
  };

  const handleCustom = (raw: string) => {
    setCustomInput(raw);
    setActivePreset(null);
    const parsed = parseInt(raw.replace(/,/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 0) onChange(parsed);
    else if (raw === '' || raw === '0') onChange(0);
  };

  const freeSelected = value === 0 && activePreset === null && !customInput;

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 font-pixel mb-1">
        BET AMOUNT <span className="text-arcade-cyan">(8BIT)</span>
        <span className="float-right text-gray-500">Balance: {userBalance.toLocaleString()}</span>
      </div>

      {/* Preset buttons */}
      <div className="grid grid-cols-4 gap-2">
        {/* Free option */}
        <button
          disabled={disabled}
          onClick={() => { setActivePreset(null); setCustomInput(''); onChange(0); }}
          className={`font-pixel text-xs py-2 px-1 rounded border transition-all
            ${freeSelected
              ? 'border-arcade-green bg-arcade-green/20 text-arcade-green glow-green'
              : 'border-gray-600 bg-black/30 text-gray-400 hover:border-arcade-green/50'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          FREE
        </button>

        {BET_PRESETS.map(preset => {
          const canAfford = userBalance >= preset;
          const isActive = activePreset === preset;
          return (
            <button
              key={preset}
              disabled={disabled || !canAfford}
              onClick={() => handlePreset(preset)}
              className={`font-pixel text-xs py-2 px-1 rounded border transition-all relative
                ${isActive
                  ? 'border-arcade-green bg-arcade-green/20 text-arcade-green glow-green'
                  : canAfford
                    ? 'border-gray-600 bg-black/30 text-gray-300 hover:border-arcade-green/50'
                    : 'border-gray-700 bg-black/20 text-gray-600 cursor-not-allowed'
                } disabled:cursor-not-allowed`}
            >
              {preset >= 1000 ? `${preset / 1000}K` : preset}
              {!canAfford && (
                <span className="absolute -top-1 -right-1 text-xs">🔒</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 font-pixel text-xs shrink-0">CUSTOM:</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Enter amount..."
          value={customInput}
          onChange={e => handleCustom(e.target.value)}
          disabled={disabled}
          className={`flex-1 bg-black/40 border rounded px-2 py-1.5 font-pixel text-xs
            text-gray-200 placeholder-gray-600 focus:outline-none transition-colors
            ${customInput && value > 0 && activePreset === null
              ? 'border-arcade-green/70 text-arcade-green'
              : 'border-gray-600 focus:border-arcade-green/50'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        />
        <span className="text-gray-500 font-pixel text-xs shrink-0">8BIT</span>
      </div>

      {/* Validation message */}
      {value > 0 && userBalance < value && (
        <p className="text-red-400 font-pixel text-xs">
          ⚠ Insufficient balance. You need {(value - userBalance).toLocaleString()} more 8BIT.
        </p>
      )}
      {value > 0 && userBalance >= value && (
        <p className="text-arcade-green font-pixel text-xs">
          ✓ Balance confirmed. {(userBalance - value).toLocaleString()} 8BIT remaining after bet.
        </p>
      )}
      {value === 0 && (
        <p className="text-gray-500 font-pixel text-xs">
          Free match — no tokens required. Just bragging rights.
        </p>
      )}

      {/* Prize breakdown */}
      {value > 0 && (
        <div className="bg-black/30 border border-arcade-green/20 rounded p-2 text-xs font-pixel space-y-0.5">
          <div className="text-gray-400 mb-1">PRIZE BREAKDOWN (if you win):</div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total pot</span>
            <span className="text-gray-300">{(value * 2).toLocaleString()} 8BIT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Burned (2.5%)</span>
            <span className="text-red-400">-{Math.floor(value * 2 * 0.025).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tournament pool (2.5%)</span>
            <span className="text-blue-400">-{Math.floor(value * 2 * 0.025).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-arcade-green/20 pt-0.5 mt-0.5">
            <span className="text-arcade-green">You receive</span>
            <span className="text-arcade-green font-bold">
              {Math.floor(value * 2 * 0.95).toLocaleString()} 8BIT
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

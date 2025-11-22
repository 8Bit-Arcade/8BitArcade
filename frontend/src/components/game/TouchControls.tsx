'use client';

import { useCallback, useRef, useEffect } from 'react';

export interface TouchControlsProps {
  onDirectionChange: (direction: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  }) => void;
  onAction: () => void;
  onActionRelease?: () => void;
  actionLabel?: string;
  showDPad?: boolean;
  showAction?: boolean;
  disabled?: boolean;
}

export default function TouchControls({
  onDirectionChange,
  onAction,
  onActionRelease,
  actionLabel = 'FIRE',
  showDPad = true,
  showAction = true,
  disabled = false,
}: TouchControlsProps) {
  const dpadRef = useRef<HTMLDivElement>(null);
  const activeDirection = useRef({ up: false, down: false, left: false, right: false });

  const updateDirection = useCallback(
    (dir: Partial<typeof activeDirection.current>) => {
      activeDirection.current = { ...activeDirection.current, ...dir };
      onDirectionChange(activeDirection.current);
    },
    [onDirectionChange]
  );

  const resetDirection = useCallback(() => {
    activeDirection.current = { up: false, down: false, left: false, right: false };
    onDirectionChange(activeDirection.current);
  }, [onDirectionChange]);

  // Haptic feedback
  const vibrate = useCallback((duration: number = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }, []);

  const handleDPadTouch = useCallback(
    (e: React.TouchEvent | React.MouseEvent, isStart: boolean) => {
      if (disabled) return;
      e.preventDefault();

      if (!isStart) {
        resetDirection();
        return;
      }

      const rect = dpadRef.current?.getBoundingClientRect();
      if (!rect) return;

      let clientX: number, clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      const deadzone = 20;

      const newDir = { up: false, down: false, left: false, right: false };

      if (Math.abs(x) > deadzone || Math.abs(y) > deadzone) {
        if (Math.abs(x) > Math.abs(y)) {
          newDir.left = x < -deadzone;
          newDir.right = x > deadzone;
        } else {
          newDir.up = y < -deadzone;
          newDir.down = y > deadzone;
        }
        vibrate();
      }

      updateDirection(newDir);
    },
    [disabled, resetDirection, updateDirection, vibrate]
  );

  const handleActionTouch = useCallback(
    (isPressed: boolean) => {
      if (disabled) return;
      vibrate(15);
      if (isPressed) {
        onAction();
      } else {
        onActionRelease?.();
      }
    },
    [disabled, onAction, onActionRelease, vibrate]
  );

  // Prevent context menu on long press
  useEffect(() => {
    const preventContextMenu = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventContextMenu);
    return () => document.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  if (disabled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-between items-end pointer-events-none z-30 md:hidden">
      {/* D-Pad */}
      {showDPad && (
        <div
          ref={dpadRef}
          className="relative w-32 h-32 pointer-events-auto touch-none select-none"
          onTouchStart={(e) => handleDPadTouch(e, true)}
          onTouchMove={(e) => handleDPadTouch(e, true)}
          onTouchEnd={(e) => handleDPadTouch(e, false)}
          onMouseDown={(e) => handleDPadTouch(e, true)}
          onMouseUp={(e) => handleDPadTouch(e, false)}
          onMouseLeave={(e) => handleDPadTouch(e, false)}
        >
          {/* D-Pad Visual */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Vertical bar */}
            <div className="absolute w-10 h-full bg-arcade-dark/80 border-2 border-arcade-green/50 rounded-lg" />
            {/* Horizontal bar */}
            <div className="absolute w-full h-10 bg-arcade-dark/80 border-2 border-arcade-green/50 rounded-lg" />
            {/* Center */}
            <div className="absolute w-8 h-8 bg-arcade-dark border-2 border-arcade-green/70 rounded-full z-10" />
          </div>

          {/* Direction indicators */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-arcade-green/70 font-pixel text-xs">
            ▲
          </div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-arcade-green/70 font-pixel text-xs">
            ▼
          </div>
          <div className="absolute left-1 top-1/2 -translate-y-1/2 text-arcade-green/70 font-pixel text-xs">
            ◄
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-arcade-green/70 font-pixel text-xs">
            ►
          </div>
        </div>
      )}

      {/* Spacer */}
      {!showDPad && <div />}

      {/* Action Button */}
      {showAction && (
        <button
          className="w-20 h-20 rounded-full bg-arcade-red/80 border-4 border-arcade-red
                     flex items-center justify-center pointer-events-auto touch-none select-none
                     active:bg-arcade-red active:scale-95 transition-transform"
          onTouchStart={() => handleActionTouch(true)}
          onTouchEnd={() => handleActionTouch(false)}
          onMouseDown={() => handleActionTouch(true)}
          onMouseUp={() => handleActionTouch(false)}
          onMouseLeave={() => handleActionTouch(false)}
        >
          <span className="font-pixel text-white text-xs">{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

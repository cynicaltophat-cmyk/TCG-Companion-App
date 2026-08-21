import React, { useRef, useCallback } from 'react';

interface HoldActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onSingleClick: () => void;
  onHoldTrigger?: () => void;
  /** Legacy alias for onHoldTrigger */
  onMaxOut?: () => void;
  holdDuration?: number;
  disabled?: boolean;
  children: React.ReactNode;
}

export const HoldActionButton: React.FC<HoldActionButtonProps> = ({
  onSingleClick,
  onHoldTrigger,
  onMaxOut,
  holdDuration = 400,
  disabled = false,
  children,
  className,
  ...props
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const triggerHold = onHoldTrigger || onMaxOut || (() => {});

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    // Primary button or touch
    if (e.button !== undefined && e.button !== 0) return;

    isLongPressRef.current = false;
    clearTimer();

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch (_) {}
      }
      triggerHold();
    }, holdDuration);
  }, [disabled, clearTimer, triggerHold, holdDuration]);

  const handlePointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handlePointerCancel = useCallback(() => {
    clearTimer();
    setTimeout(() => {
      isLongPressRef.current = false;
    }, 50);
  }, [clearTimer]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled) return;
    if (isLongPressRef.current) {
      e.preventDefault();
      setTimeout(() => {
        isLongPressRef.current = false;
      }, 50);
      return;
    }
    onSingleClick();
  }, [disabled, onSingleClick]);

  return (
    <button
      {...props}
      type="button"
      disabled={disabled}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onContextMenu={(e) => {
        if (isLongPressRef.current) e.preventDefault();
      }}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

export const HoldPlusButton = HoldActionButton;
export const HoldMinusButton = HoldActionButton;


import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface HoldActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onSingleClick: () => void;
  onHoldTrigger?: () => void;
  /** Legacy alias for onHoldTrigger */
  onMaxOut?: () => void;
  holdDuration?: number;
  popupLabel?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

interface AnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const HoldActionButton: React.FC<HoldActionButtonProps> = ({
  onSingleClick,
  onHoldTrigger,
  onMaxOut,
  holdDuration = 200,
  popupLabel = 'Add max',
  disabled = false,
  children,
  className,
  style,
  onClick,
  onPointerDown,
  onContextMenu,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePointerIdRef = useRef<number | null>(null);
  const usedPointerRef = useRef(false);
  const isMenuOpenRef = useRef(false);
  const isHighlightedRef = useRef(false);
  const placedBelowRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);

  const triggerHold = onHoldTrigger || onMaxOut || (() => {});

  const clearHoldTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const checkHit = useCallback((clientX: number, clientY: number): boolean => {
    const popupEl = popupRef.current;
    if (!popupEl) return false;
    const rect = popupEl.getBoundingClientRect();
    const horizontalPadding = 14;
    if (placedBelowRef.current) {
      return (
        clientX >= rect.left - horizontalPadding &&
        clientX <= rect.right + horizontalPadding &&
        clientY >= rect.top - 4 &&
        clientY <= rect.bottom + 24
      );
    }
    return (
      clientX >= rect.left - horizontalPadding &&
      clientX <= rect.right + horizontalPadding &&
      clientY >= rect.top - 24 &&
      clientY <= rect.bottom + 4
    );
  }, []);

  const suppressNextClickGlobally = useCallback(() => {
    if (clickSuppressTimerRef.current) {
      clearTimeout(clickSuppressTimerRef.current);
    }
    const handleCaptureClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (clickSuppressTimerRef.current) {
        clearTimeout(clickSuppressTimerRef.current);
        clickSuppressTimerRef.current = null;
      }
    };
    window.addEventListener('click', handleCaptureClick, { capture: true, once: true });
    clickSuppressTimerRef.current = setTimeout(() => {
      window.removeEventListener('click', handleCaptureClick, { capture: true });
      clickSuppressTimerRef.current = null;
    }, 180);
  }, []);

  const cleanupListenersRef = useRef<() => void>(() => {});

  const resetGestureState = useCallback(() => {
    clearHoldTimer();
    cleanupListenersRef.current();
    activePointerIdRef.current = null;
    isMenuOpenRef.current = false;
    isHighlightedRef.current = false;
    placedBelowRef.current = false;
    lastPointerPosRef.current = null;
    setIsMenuOpen(false);
    setIsHighlighted(false);
    setAnchorRect(null);
  }, [clearHoldTimer]);

  useEffect(() => {
    if (disabled && activePointerIdRef.current !== null) {
      resetGestureState();
    }
  }, [disabled, resetGestureState]);

  useEffect(() => {
    return () => {
      resetGestureState();
      if (pointerResetTimerRef.current) clearTimeout(pointerResetTimerRef.current);
      if (clickSuppressTimerRef.current) clearTimeout(clickSuppressTimerRef.current);
    };
  }, [resetGestureState]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(e);
    if (disabled) return;
    if (e.button !== undefined && e.button !== 0) return;

    e.stopPropagation();

    if (pointerResetTimerRef.current) {
      clearTimeout(pointerResetTimerRef.current);
      pointerResetTimerRef.current = null;
    }

    resetGestureState();

    const pointerId = e.pointerId;
    activePointerIdRef.current = pointerId;
    usedPointerRef.current = true;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== activePointerIdRef.current) return;
      lastPointerPosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };

      if (!isMenuOpenRef.current) return;

      const hit = checkHit(moveEvent.clientX, moveEvent.clientY);
      if (hit !== isHighlightedRef.current) {
        isHighlightedRef.current = hit;
        setIsHighlighted(hit);
        if (hit && typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(15); } catch (_) {}
        }
      }
    };

    const handleWindowPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== activePointerIdRef.current) return;

      const wasMenuOpen = isMenuOpenRef.current;
      const finalHit = wasMenuOpen
        ? (popupRef.current ? checkHit(upEvent.clientX, upEvent.clientY) : isHighlightedRef.current)
        : false;

      resetGestureState();

      if (wasMenuOpen) {
        suppressNextClickGlobally();
      }

      pointerResetTimerRef.current = setTimeout(() => {
        usedPointerRef.current = false;
        pointerResetTimerRef.current = null;
      }, 150);

      if (disabled) return;

      if (wasMenuOpen) {
        if (finalHit) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(25); } catch (_) {}
          }
          triggerHold();
        }
      } else {
        onSingleClick();
      }
    };

    const handleWindowPointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== activePointerIdRef.current) return;
      resetGestureState();
      pointerResetTimerRef.current = setTimeout(() => {
        usedPointerRef.current = false;
        pointerResetTimerRef.current = null;
      }, 150);
    };

    cleanupListenersRef.current = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      cleanupListenersRef.current = () => {};
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    timerRef.current = setTimeout(() => {
      if (activePointerIdRef.current !== pointerId || !buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const shouldPlaceBelow = rect.top < 54;
      placedBelowRef.current = shouldPlaceBelow;

      setAnchorRect({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });

      isMenuOpenRef.current = true;
      setIsMenuOpen(true);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(30); } catch (_) {}
      }

      // Check once after popup mounts in case pointer already moved
      requestAnimationFrame(() => {
        if (isMenuOpenRef.current && lastPointerPosRef.current) {
          const hit = checkHit(lastPointerPosRef.current.x, lastPointerPosRef.current.y);
          if (hit !== isHighlightedRef.current) {
            isHighlightedRef.current = hit;
            setIsHighlighted(hit);
          }
        }
      });
    }, holdDuration);
  }, [
    onPointerDown,
    disabled,
    resetGestureState,
    checkHit,
    suppressNextClickGlobally,
    triggerHold,
    onSingleClick,
    holdDuration,
  ]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onClick?.(e);
    if (disabled) return;
    if (usedPointerRef.current) {
      e.preventDefault();
      usedPointerRef.current = false;
      if (pointerResetTimerRef.current) {
        clearTimeout(pointerResetTimerRef.current);
        pointerResetTimerRef.current = null;
      }
      return;
    }
    onSingleClick();
  }, [onClick, disabled, onSingleClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onContextMenu?.(e);
  }, [onContextMenu]);

  // Compute popup viewport coordinates
  let popupPortal: React.ReactNode = null;
  if (typeof document !== 'undefined') {
    const btnCenterX = anchorRect ? anchorRect.left + anchorRect.width / 2 : 0;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const clampedCenterX = anchorRect
      ? Math.max(58, Math.min(viewportWidth - 58, btnCenterX))
      : 0;
    const arrowOffset = anchorRect
      ? Math.max(-28, Math.min(28, btnCenterX - clampedCenterX))
      : 0;
    const placeBelow = anchorRect ? anchorRect.top < 54 : false;

    popupPortal = createPortal(
      <AnimatePresence>
        {isMenuOpen && anchorRect && (
          <motion.div
            key="hold-action-popup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed',
              left: clampedCenterX,
              ...(placeBelow
                ? { top: anchorRect.bottom + 12 }
                : { bottom: viewportHeight - anchorRect.top + 12 }),
              transform: 'translateX(-50%)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            <motion.div
              ref={popupRef}
              initial={{ scaleY: 0.45, scaleX: 0.85, y: placeBelow ? -10 : 10 }}
              animate={{
                scaleY: isHighlighted ? 1.06 : 1,
                scaleX: isHighlighted ? 1.06 : 1,
                y: 0,
              }}
              exit={{ scaleY: 0.5, scaleX: 0.85, y: placeBelow ? -6 : 6 }}
              transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
              style={{ transformOrigin: placeBelow ? 'top center' : 'bottom center' }}
              className={
                isHighlighted
                  ? 'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl border bg-orange-500 text-white border-orange-300 shadow-[0_10px_28px_rgba(249,115,22,0.5)] transition-colors duration-100 select-none whitespace-nowrap'
                  : 'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl border bg-[#141414] text-white border-stone-700/90 shadow-[0_10px_28px_rgba(0,0,0,0.32)] transition-colors duration-100 select-none whitespace-nowrap'
              }
            >
              {placeBelow ? (
                <ArrowDown size={13} strokeWidth={2.75} className="shrink-0" />
              ) : (
                <ArrowUp size={13} strokeWidth={2.75} className="shrink-0" />
              )}
              <span className="text-[11px] font-black tracking-tight leading-none">
                {popupLabel}
              </span>

              {/* Pointer caret toward button */}
              <div
                style={{
                  left: `calc(50% + ${arrowOffset}px)`,
                  transform: 'translateX(-50%) rotate(45deg)',
                }}
                className={
                  placeBelow
                    ? `absolute -top-1.5 w-2.5 h-2.5 border-l border-t transition-colors duration-100 ${
                        isHighlighted
                          ? 'bg-orange-500 border-orange-300'
                          : 'bg-[#141414] border-stone-700/90'
                      }`
                    : `absolute -bottom-1.5 w-2.5 h-2.5 border-r border-b transition-colors duration-100 ${
                        isHighlighted
                          ? 'bg-orange-500 border-orange-300'
                          : 'bg-[#141414] border-stone-700/90'
                      }`
                }
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  }

  return (
    <>
      <button
        {...props}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={className ? `touch-none select-none ${className}` : 'touch-none select-none'}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          ...style,
        }}
        onPointerDown={handlePointerDown}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
      >
        {children}
      </button>
      {popupPortal}
    </>
  );
};

export const HoldPlusButton: React.FC<HoldActionButtonProps> = ({
  popupLabel = 'Add max',
  ...props
}) => <HoldActionButton popupLabel={popupLabel} {...props} />;

export const HoldMinusButton: React.FC<HoldActionButtonProps> = ({
  popupLabel = 'Remove max',
  ...props
}) => <HoldActionButton popupLabel={popupLabel} {...props} />;

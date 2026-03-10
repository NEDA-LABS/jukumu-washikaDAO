'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export interface FocusRailItem {
  id: string | number;
  title: string;
  description: string;
  imageSrc: string;
  meta?: string;
  href?: string;
}

interface FocusRailProps {
  items: FocusRailItem[];
  heading?: string;
  subheading?: string;
  eyebrow?: string;
  initialIndex?: number;
  loop?: boolean;
  autoPlay?: boolean;
  interval?: number;
  className?: string;
}

const CARD_WIDTH = 400;
const CARD_GAP = 32;
const CARD_STEP = CARD_WIDTH + CARD_GAP;

export default function FocusRail({
  items,
  heading,
  subheading,
  eyebrow,
  initialIndex = 0,
  loop = true,
  autoPlay = false,
  interval = 4000,
  className = '',
}: FocusRailProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef<number | null>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clamp = useCallback(
    (idx: number) => {
      if (loop) return (idx + items.length) % items.length;
      return Math.max(0, Math.min(items.length - 1, idx));
    },
    [items.length, loop]
  );

  const go = useCallback(
    (delta: number) => {
      setDirection(delta > 0 ? 1 : -1);
      setActiveIndex((prev) => clamp(prev + delta));
    },
    [clamp]
  );

  useEffect(() => {
    if (!autoPlay) return;
    autoPlayRef.current = setInterval(() => go(1), interval);
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [autoPlay, interval, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (wheelTimeout.current) return;
      go(e.deltaY > 0 ? 1 : -1);
      wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null; }, 400);
    },
    [go]
  );

  const onPointerDown = (e: React.PointerEvent) => { dragStart.current = e.clientX; };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const delta = dragStart.current - e.clientX;
    if (Math.abs(delta) > 40) go(delta > 0 ? 1 : -1);
    dragStart.current = null;
  };

  const active = items[activeIndex];

  return (
    <div
      className={`relative w-full min-h-screen flex flex-col select-none overflow-hidden ${className}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ cursor: 'grab' }}
    >
      {/* Ambient blurred background — full bleed */}
      <AnimatePresence mode="sync">
        <motion.div
          key={active.id}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        >
          <Image
            src={active.imageSrc}
            alt=""
            fill
            className="object-cover scale-110"
            style={{ filter: 'blur(60px) saturate(1.6) brightness(0.25)' }}
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/50 to-neutral-950/80" />

      {/* Content — fills full height */}
      <div className="relative z-10 flex flex-col items-center justify-between flex-1 w-full py-16 px-4">

        {/* Heading */}
        {(eyebrow || heading || subheading) && (
          <div className="text-center mb-10 max-w-3xl mx-auto">
            {eyebrow && (
              <p className="text-xs font-semibold text-primary/80 tracking-widest uppercase mb-4">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
                {heading}
              </h2>
            )}
            {subheading && (
              <p className="text-base text-white/60 leading-relaxed">
                {subheading}
              </p>
            )}
          </div>
        )}

        {/* Cards track */}
        <div
          className="relative flex items-center justify-center w-full flex-1"
          style={{ minHeight: `${CARD_WIDTH * (4 / 3)}px` }}
        >
          {items.map((item, idx) => {
            const offset = idx - activeIndex;
            let wrappedOffset = offset;
            if (loop) {
              if (offset > items.length / 2) wrappedOffset = offset - items.length;
              if (offset < -items.length / 2) wrappedOffset = offset + items.length;
            }

            const isActive = wrappedOffset === 0;
            const isVisible = Math.abs(wrappedOffset) <= 2;
            if (!isVisible) return null;

            const scale = isActive ? 1 : 0.82 - Math.abs(wrappedOffset) * 0.04;
            const x = wrappedOffset * CARD_STEP;
            const zIndex = 10 - Math.abs(wrappedOffset);
            const opacity = isActive ? 1 : Math.max(0, 1 - Math.abs(wrappedOffset) * 0.4);
            const blur = isActive ? 0 : Math.abs(wrappedOffset) * 2;

            return (
              <motion.div
                key={item.id}
                className="absolute rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl"
                style={{
                  width: CARD_WIDTH,
                  height: CARD_WIDTH * (4 / 3),
                  zIndex,
                  filter: `blur(${blur}px)`,
                }}
                animate={{ x, scale, opacity }}
                transition={{
                  type: 'spring',
                  stiffness: isActive ? 220 : 180,
                  damping: isActive ? 32 : 38,
                  mass: 1.1,
                }}
                onClick={() => {
                  if (!isActive) {
                    setDirection(wrappedOffset > 0 ? 1 : -1);
                    setActiveIndex(clamp(idx));
                  }
                }}
              >
                {/* Photo */}
                <div className="relative w-full h-3/5">
                  <Image
                    src={item.imageSrc}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                  {item.meta && (
                    <div className="absolute top-4 left-4 w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg">
                      {item.meta}
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="p-6 h-2/5 flex flex-col justify-center">
                  <AnimatePresence mode="wait">
                    {isActive ? (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: 'easeInOut' }}
                      >
                        <h4 className="text-lg font-semibold text-white mb-2 leading-snug">
                          {item.title}
                        </h4>
                        <p className="text-sm text-white/60 leading-relaxed line-clamp-3">
                          {item.description}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`${item.id}-muted`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <h4 className="text-base font-medium text-white/40 leading-snug">
                          {item.title}
                        </h4>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={() => go(-1)}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white transition-colors"
            aria-label="Previous"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex gap-2 items-center">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setDirection(idx > activeIndex ? 1 : -1);
                  setActiveIndex(idx);
                }}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: idx === activeIndex ? 28 : 6,
                  height: 6,
                  background: idx === activeIndex
                    ? 'var(--color-primary, #f97316)'
                    : 'rgba(255,255,255,0.25)',
                }}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => go(1)}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white transition-colors"
            aria-label="Next"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}

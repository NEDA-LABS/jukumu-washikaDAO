'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ScrollExpandSectionProps {
  children: React.ReactNode;
  /** Starting scale (0–1). Default 0.88 */
  startScale?: number;
  /** Starting border-radius in px. Default 20 */
  startRadius?: number;
  /** Starting opacity (0–1). Default 0.6 */
  startOpacity?: number;
}

/**
 * Wraps any section in a scroll-driven "card expand" animation.
 * The section starts as a slightly scaled-down rounded card and expands
 * to full-width as it scrolls into the viewport. The section's own
 * markup and styles are completely unchanged.
 */
export default function ScrollExpandSection({
  children,
  startScale = 0.88,
  startRadius = 20,
  startOpacity = 0.6,
}: ScrollExpandSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    // Animation runs while the section's top edge travels from
    // 90 % → 20 % down the viewport — a natural "reveal as you approach" feel.
    offset: ['start 0.9', 'start 0.2'],
  });

  const scale        = useTransform(scrollYProgress, [0, 1], [startScale, 1]);
  const borderRadius = useTransform(scrollYProgress, [0, 1], [startRadius, 0]);
  const opacity      = useTransform(scrollYProgress, [0, 1], [startOpacity, 1]);

  return (
    <div ref={ref}>
      <motion.div
        style={{
          scale,
          borderRadius,
          opacity,
          overflow: 'hidden',
          // Promote to compositor layer for smooth 60 fps
          willChange: 'transform',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

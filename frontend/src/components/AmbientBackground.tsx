import { motion, useReducedMotion } from 'motion/react';

/** Decorative atmosphere; never takes part in layout or pointer interaction. */
export default function AmbientBackground() {
  const reduceMotion = useReducedMotion();

  return <div
    className="ambient-background"
    aria-hidden="true"
    style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
  >
    <motion.div
      className="ambient-orb ambient-orb--blue"
      style={{
        position: 'absolute', width: 'min(44vw, 600px)', height: 'min(60vw, 800px)',
        left: '-25vw', top: '12vh', borderRadius: '42% 58% 64% 36% / 51% 39% 61% 49%',
        background: '#dce8fa', opacity: 0.42,
      }}
      animate={reduceMotion ? { x: 0, y: 0, rotate: 0 } : { x: [0, 32, 0], y: [0, -36, 0], rotate: [-14, -6, -14] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 26, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="ambient-orb ambient-orb--lavender"
      style={{
        position: 'absolute', width: 'min(40vw, 560px)', height: 'min(48vw, 640px)',
        right: '-25vw', top: '37vh', borderRadius: '61% 39% 38% 62% / 39% 49% 51% 61%',
        background: '#e5e0f7', opacity: 0.5,
      }}
      animate={reduceMotion ? { x: 0, y: 0, rotate: 0 } : { x: [0, -28, 0], y: [0, 42, 0], rotate: [12, -4, 12] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 22, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="ambient-orb ambient-orb--navy"
      style={{
        position: 'absolute', width: 'min(19vw, 260px)', height: 'min(19vw, 260px)',
        right: '-9vw', top: '-9vw', borderRadius: '50%', background: '#becfe7', opacity: 0.2,
      }}
      animate={reduceMotion ? { x: 0, y: 0, scale: 1 } : { x: [0, -20, 0], y: [0, 26, 0], scale: [1, 1.08, 1] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 28, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>;
}

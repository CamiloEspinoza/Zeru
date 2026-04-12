import confetti from "canvas-confetti";

/**
 * Fire a celebration confetti burst.
 * Lightweight, no canvas element needed — uses a temporary canvas that auto-cleans.
 */
export function celebrateConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];

  function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }

  frame();
}

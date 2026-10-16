"use strict";

// Distances are CSS pixels, independent of the iPad's display resolution.
window.bindSwipe = function bindSwipe(surface, {
  onDirection,
  onTap,
  onInteract,
  enabled = () => true,
  repeat = () => false,
  threshold = 24,
}) {
  let gesture = null;
  surface.classList.add("swipe-surface");

  function cancel() {
    const previous = gesture;
    gesture = null;
    if (previous && surface.hasPointerCapture(previous.id)) {
      surface.releasePointerCapture(previous.id);
    }
  }

  function advance(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!enabled()) return cancel();
    event.preventDefault();
    if (gesture.done) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
    gesture.moved = true;
    gesture.done = !repeat(direction);
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    onDirection(direction);
  }

  surface.addEventListener("pointerdown", (event) => {
    if (gesture || event.isPrimary === false || event.button !== 0 || !enabled()) return;
    if (event.target.closest("button, a, input, select, textarea")) return;
    event.preventDefault();
    onInteract?.();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, done: false };
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener("pointermove", advance);
  surface.addEventListener("pointerup", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    // Touch release is a user activation on browsers that reject audio on move.
    onInteract?.();
    advance(event);
    const tapped = gesture && !gesture.moved;
    cancel();
    if (tapped && enabled()) onTap?.();
  });
  for (const type of ["pointercancel", "lostpointercapture"]) {
    surface.addEventListener(type, (event) => {
      if (gesture?.id === event.pointerId) cancel();
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!surface.contains(event.target) || event.target.closest("button, a")) cancel();
  }, true);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", cancel);
  return cancel;
};

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import "./ScrollbarOverlay.css";

const MIN_THUMB = 28;
const AUTO_HIDE_MS = 1000;

type Props = {
  targetRef: RefObject<HTMLElement | null>;
  alwaysVisible?: boolean;
  watch?: unknown;
};

function ScrollbarOverlay({ targetRef, alwaysVisible = false, watch }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);

  const [metrics, setMetrics] = useState({
    height: 0,
    top: 0,
    scrollable: false,
  });
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(false);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const { clientHeight: viewH, scrollHeight: contentH, scrollTop } = el;
    if (contentH <= viewH + 1) {
      setMetrics((m) => (m.scrollable ? { ...m, scrollable: false } : m));
      return;
    }
    const height = Math.max(MIN_THUMB, (viewH / contentH) * viewH);
    const top = (scrollTop / (contentH - viewH)) * (viewH - height);
    setMetrics({ height, top, scrollable: true });
  }, [targetRef]);

  const flash = useCallback(() => {
    if (alwaysVisible) return;
    setActive(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), AUTO_HIDE_MS);
  }, [alwaysVisible]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    function handleScroll() {
      measure();
      flash();
    }

    measure();
    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("pointerenter", flash);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("pointerenter", flash);
      observer.disconnect();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [targetRef, measure, flash]);

  useEffect(measure, [measure, watch]);

  function handleThumbPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = targetRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startScroll: el.scrollTop };
    setDragging(true);
  }

  function handleThumbPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const el = targetRef.current;
    if (!start || !el) return;
    const travel = el.clientHeight - metrics.height;
    if (travel <= 0) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTop =
      start.startScroll + ((e.clientY - start.startY) / travel) * maxScroll;
  }

  function handleThumbPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
    flash();
  }

  /** Clicking the track pages the scroller toward the click. */
  function handleTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = targetRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const y = e.clientY - track.getBoundingClientRect().top;
    const direction = y < metrics.top ? -1 : 1;
    el.scrollBy({ top: direction * el.clientHeight * 0.9, behavior: "smooth" });
  }

  const visible = metrics.scrollable;
  const shown = visible && (alwaysVisible || active || dragging);

  return (
    <div
      ref={trackRef}
      className={`scrollbar-overlay ${shown ? "scrollbar-overlay--active" : ""}`}
      onPointerDown={handleTrackPointerDown}
      aria-hidden="true"
    >
      <div
        className={`scrollbar-overlay__thumb ${dragging ? "scrollbar-overlay__thumb--dragging" : ""}`}
        style={{ height: `${metrics.height}px`, top: `${metrics.top}px` }}
        onPointerDown={handleThumbPointerDown}
        onPointerMove={handleThumbPointerMove}
        onPointerUp={handleThumbPointerUp}
        onPointerCancel={handleThumbPointerUp}
      />
    </div>
  );
}

export default ScrollbarOverlay;

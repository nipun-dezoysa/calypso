import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import "./ScrollArea.css";

const MIN_THUMB = 28;
const AUTO_HIDE_MS = 1000;

export type ScrollAreaHandle = {
  viewport: HTMLDivElement | null;
};

type Props = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  alwaysVisible?: boolean;
  ref?: Ref<ScrollAreaHandle>;
};

function ScrollArea({
  children,
  className = "",
  viewportClassName = "",
  contentClassName = "",
  alwaysVisible = false,
  ref,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);

  const [metrics, setMetrics] = useState({ height: 0, top: 0, scrollable: false });
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(false);

  const measure = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const { clientHeight: viewH, scrollHeight: contentH, scrollTop } = vp;
    if (contentH <= viewH + 1) {
      setMetrics((m) => (m.scrollable ? { ...m, scrollable: false } : m));
      return;
    }
    const height = Math.max(MIN_THUMB, (viewH / contentH) * viewH);
    const top = (scrollTop / (contentH - viewH)) * (viewH - height);
    setMetrics({ height, top, scrollable: true });
  }, []);

  const flash = useCallback(() => {
    if (alwaysVisible) return;
    setActive(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), AUTO_HIDE_MS);
  }, [alwaysVisible]);

  useEffect(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(vp);
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [measure]);

  useImperativeHandle(ref, () => ({ viewport: viewportRef.current }), []);

  function handleScroll() {
    measure();
    flash();
  }

  function handleThumbPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const vp = viewportRef.current;
    if (!vp) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startScroll: vp.scrollTop };
    setDragging(true);
  }

  function handleThumbPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const vp = viewportRef.current;
    if (!start || !vp) return;
    const travel = vp.clientHeight - metrics.height;
    if (travel <= 0) return;
    const maxScroll = vp.scrollHeight - vp.clientHeight;
    vp.scrollTop =
      start.startScroll + ((e.clientY - start.startY) / travel) * maxScroll;
  }

  function handleThumbPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
  }

  function handleTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const y = e.clientY - track.getBoundingClientRect().top;
    const direction = y < metrics.top ? -1 : 1;
    vp.scrollBy({ top: direction * vp.clientHeight * 0.9, behavior: "smooth" });
  }

  const visible = metrics.scrollable;
  const shown = visible && (alwaysVisible || active || dragging);

  return (
    <div
      className={`scroll-area ${className}`}
      onPointerEnter={flash}
      onPointerMove={flash}
    >
      <div
        ref={viewportRef}
        className={`scroll-area__viewport ${viewportClassName}`}
        onScroll={handleScroll}
      >
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      <div
        ref={trackRef}
        className={`scroll-area__track ${visible ? "scroll-area__track--visible" : ""} ${shown ? "scroll-area__track--active" : ""}`}
        onPointerDown={handleTrackPointerDown}
        aria-hidden="true"
      >
        <div
          className={`scroll-area__thumb ${dragging ? "scroll-area__thumb--dragging" : ""}`}
          style={{ height: `${metrics.height}px`, top: `${metrics.top}px` }}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
        />
      </div>
    </div>
  );
}

export default ScrollArea;

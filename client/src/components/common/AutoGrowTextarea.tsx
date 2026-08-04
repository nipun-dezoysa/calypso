import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import ScrollbarOverlay from "./ScrollbarOverlay";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  value: string;
  /** Height the textarea starts at, in text rows. */
  minRows?: number;
  /** Height in px at which it stops growing and starts scrolling. */
  maxHeight?: number;
  /** Classes for the positioned wrapper the scrollbar is drawn against. */
  containerClassName?: string;
};

/**
 * Textarea that grows with its content up to `maxHeight`, then scrolls with
 * the app's custom scrollbar instead of the native one.
 */
function AutoGrowTextarea({
  value,
  minRows = 1,
  maxHeight = 200,
  containerClassName = "",
  className = "",
  ...rest
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastWidth = useRef(0);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const lineHeight =
      parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
    const frame =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const borders =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);

    // scrollHeight is only meaningful once the element is free to shrink.
    el.style.height = "auto";
    const content = el.scrollHeight + borders;
    const min = minRows * lineHeight + frame;
    el.style.height = `${Math.min(Math.max(content, min), maxHeight)}px`;
  }, [minRows, maxHeight]);

  useLayoutEffect(resize, [resize, value]);

  // Re-flow when the panel gets narrower/wider; ignore our own height changes.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width === lastWidth.current) return;
      lastWidth.current = width;
      resize();
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <div ref={wrapperRef} className={`relative ${containerClassName}`}>
      <textarea
        {...rest}
        ref={textareaRef}
        value={value}
        rows={minRows}
        className={`block w-full resize-none overflow-y-auto scrollbar-hidden ${className}`}
      />
      <ScrollbarOverlay targetRef={textareaRef} watch={value} />
    </div>
  );
}

export default AutoGrowTextarea;

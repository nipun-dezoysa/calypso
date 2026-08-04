import {
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import ScrollbarOverlay from "./ScrollbarOverlay";
import "./ScrollArea.css";

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

  useImperativeHandle(ref, () => ({ viewport: viewportRef.current }), []);

  return (
    <div className={`scroll-area ${className}`}>
      <div
        ref={viewportRef}
        className={`scroll-area__viewport scrollbar-hidden ${viewportClassName}`}
      >
        <div className={contentClassName}>{children}</div>
      </div>
      <ScrollbarOverlay targetRef={viewportRef} alwaysVisible={alwaysVisible} />
    </div>
  );
}

export default ScrollArea;

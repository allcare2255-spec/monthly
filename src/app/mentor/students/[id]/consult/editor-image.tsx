"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

export type ImageAlign = "left" | "center" | "right";

/**
 * 노션식 이미지 블록.
 * - width(px) 를 저장해 크기를 기억하고, 좌우 손잡이를 드래그해 조절한다 (비율 유지).
 * - align 으로 왼쪽/가운데/오른쪽 정렬. 기본은 가운데.
 * - 이미지를 누르면 위에 정렬·크기 버튼 바가 뜬다.
 */
export const ResizableImage = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null as number | null,
        parseHTML: (el) => {
          const w = el.getAttribute("width") || (el as HTMLElement).style.width;
          const n = parseInt(String(w || ""), 10);
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (attrs) =>
          attrs.width ? { width: String(attrs.width), style: `width:${attrs.width}px` } : {},
      },
      align: {
        default: "center" as ImageAlign,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align || "center" }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

const MIN_W = 80;

function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const src = node.attrs.src as string;
  const width = (node.attrs.width as number | null) ?? null;
  const align = (node.attrs.align as ImageAlign) || "center";
  const editable = editor.isEditable;

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);

  const startResize = useCallback(
    (e: React.PointerEvent, side: "left" | "right") => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      const img = imgRef.current;
      const wrap = wrapRef.current;
      if (!img || !wrap) return;

      const startX = e.clientX;
      const startW = img.getBoundingClientRect().width;
      // 에디터 본문 폭을 넘지 않도록 상한을 둔다
      const maxW = wrap.parentElement?.getBoundingClientRect().width ?? 9999;
      setDragging(true);

      const onMove = (ev: PointerEvent) => {
        const delta = side === "right" ? ev.clientX - startX : startX - ev.clientX;
        const next = Math.round(Math.min(Math.max(startW + delta, MIN_W), maxW));
        updateAttributes({ width: next });
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editable, updateAttributes],
  );

  // 붙여넣기 직후 등 width 가 없을 때는 자연 크기(최대 본문 폭)로 한 번 고정해준다
  useEffect(() => {
    if (width || !editable) return;
    const img = imgRef.current;
    if (!img) return;
    const setInitial = () => {
      const wrap = wrapRef.current?.parentElement;
      const maxW = wrap?.getBoundingClientRect().width ?? 640;
      const natural = img.naturalWidth || maxW;
      updateAttributes({ width: Math.round(Math.min(natural, maxW)) });
    };
    if (img.complete && img.naturalWidth) setInitial();
    else img.addEventListener("load", setInitial, { once: true });
  }, [width, editable, updateAttributes]);

  const justify =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const showChrome = editable && (selected || hover || dragging);

  return (
    <NodeViewWrapper
      className="editor-image-block"
      data-align={align}
      style={{ display: "flex", justifyContent: justify }}
    >
      <div
        ref={wrapRef}
        className="editor-image-inner"
        style={{ position: "relative", maxWidth: "100%", lineHeight: 0 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={(node.attrs.alt as string) || ""}
          draggable={false}
          style={{
            width: width ? `${width}px` : undefined,
            maxWidth: "100%",
            height: "auto",
            borderRadius: 10,
            display: "block",
            outline: selected ? "2px solid #0ea5e9" : "none",
            outlineOffset: 2,
          }}
        />

        {showChrome && (
          <>
            {/* 좌우 크기 손잡이 */}
            <span
              onPointerDown={(e) => startResize(e, "left")}
              className="editor-image-handle"
              style={{ left: 6 }}
            />
            <span
              onPointerDown={(e) => startResize(e, "right")}
              className="editor-image-handle"
              style={{ right: 6 }}
            />

            {/* 정렬 / 크기 버튼 바 */}
            <div className="editor-image-bar">
              <BarBtn active={align === "left"} onClick={() => updateAttributes({ align: "left" })} title="왼쪽 정렬">
                ⬅
              </BarBtn>
              <BarBtn active={align === "center"} onClick={() => updateAttributes({ align: "center" })} title="가운데 정렬">
                ⬌
              </BarBtn>
              <BarBtn active={align === "right"} onClick={() => updateAttributes({ align: "right" })} title="오른쪽 정렬">
                ➡
              </BarBtn>
              <span className="editor-image-bar-sep" />
              <BarBtn onClick={() => updateAttributes({ width: 320 })} title="작게">
                S
              </BarBtn>
              <BarBtn onClick={() => updateAttributes({ width: 520 })} title="보통">
                M
              </BarBtn>
              <BarBtn
                onClick={() => {
                  const maxW = wrapRef.current?.parentElement?.getBoundingClientRect().width;
                  updateAttributes({ width: maxW ? Math.round(maxW) : null });
                }}
                title="본문 폭에 맞춤"
              >
                W
              </BarBtn>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function BarBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`editor-image-bar-btn${active ? " is-active" : ""}`}
    >
      {children}
    </button>
  );
}

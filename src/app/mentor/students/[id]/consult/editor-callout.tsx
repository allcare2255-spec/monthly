"use client";

import { useEffect, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

/** 콜아웃에서 고를 수 있는 이모지 (노션 기본 목록과 비슷하게) */
const EMOJIS = ["💡", "📌", "✅", "⚠️", "❗", "🔥", "📝", "🎯", "📚", "⏰", "🙌", "❤️"];

/** 콜아웃 배경색 — 본문 색상 팔레트(노션 9색)의 배경색과 동일 */
const BGS: { name: string; value: string }[] = [
  { name: "기본", value: "#f1f1ef" },
  { name: "갈색", value: "#f4eeee" },
  { name: "주황", value: "#fbecdd" },
  { name: "노랑", value: "#fbf3db" },
  { name: "초록", value: "#edf3ec" },
  { name: "파랑", value: "#e7f3f8" },
  { name: "보라", value: "#f4f0f7" },
  { name: "분홍", value: "#fbf2f5" },
  { name: "빨강", value: "#fdebec" },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { emoji?: string; bg?: string }) => ReturnType;
      toggleCallout: (attrs?: { emoji?: string; bg?: string }) => ReturnType;
    };
  }
}

/**
 * 노션식 콜아웃 블록.
 * - 저장 HTML: <aside data-type="callout" data-emoji="💡" data-bg="#e7f3f8">…</aside>
 *   (PDF 미리보기처럼 에디터 밖에서 그릴 때도 이모지가 보이도록 span 을 함께 렌더한다)
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-emoji") || "💡",
        renderHTML: (attrs) => ({ "data-emoji": attrs.emoji || "💡" }),
      },
      bg: {
        default: "#f1f1ef",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-bg") || "#f1f1ef",
        renderHTML: (attrs) => ({
          "data-bg": attrs.bg || "#f1f1ef",
          style: `background:${attrs.bg || "#f1f1ef"}`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { "data-type": "callout" }),
      ["span", { class: "callout-emoji", contenteditable: "false" }, node.attrs.emoji || "💡"],
      ["div", { class: "callout-body" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
    };
  },

  addKeyboardShortcuts() {
    return {
      // 콜아웃 마지막 줄이 빈 문단일 때 Enter → 콜아웃 밖으로 빠져나온다 (노션과 동일)
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "paragraph" || $from.parent.content.size > 0) return false;

        let depth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === this.name) {
            depth = d;
            break;
          }
        }
        if (depth < 0) return false;

        const callout = $from.node(depth);
        // 마지막 자식이 아니거나, 콜아웃에 문단이 하나뿐이면 기본 동작에 맡긴다
        if ($from.index(depth) !== callout.childCount - 1) return false;
        if (callout.childCount === 1) return false;

        const paraStart = $from.before($from.depth);
        const paraEnd = $from.after($from.depth);
        const afterCallout = $from.after(depth);

        return this.editor
          .chain()
          .command(({ tr }) => {
            tr.delete(paraStart, paraEnd);
            const at = tr.mapping.map(afterCallout);
            tr.insert(at, state.schema.nodes.paragraph.create());
            tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)));
            return true;
          })
          .focus()
          .run();
      },
    };
  },
});

function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const emoji = (node.attrs.emoji as string) || "💡";
  const bg = (node.attrs.bg as string) || "#f1f1ef";
  const editable = editor.isEditable;

  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // Node 이름이 @tiptap/core 의 Node 와 겹치므로 DOM 쪽을 명시한다
      if (popRef.current && !popRef.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <NodeViewWrapper className="callout-block" data-type="callout" data-bg={bg} style={{ background: bg }}>
      <div className="callout-emoji-wrap" contentEditable={false} ref={popRef}>
        <button
          type="button"
          className="callout-emoji"
          title={editable ? "이모지 · 배경색 바꾸기" : undefined}
          disabled={!editable}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editable && setOpen((o) => !o)}
        >
          {emoji}
        </button>
        {open && (
          <div className="callout-pop">
            <div className="editor-color-title">아이콘</div>
            <div className="callout-emoji-grid">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className={`callout-emoji-cell${em === emoji ? " is-active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    updateAttributes({ emoji: em });
                    setOpen(false);
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="editor-color-title mt-2">배경색</div>
            <div className="callout-bg-grid">
              {BGS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  className={`callout-bg-cell${c.value === bg ? " is-active" : ""}`}
                  style={{ background: c.value }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    updateAttributes({ bg: c.value });
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <NodeViewContent className="callout-body" />
    </NodeViewWrapper>
  );
}

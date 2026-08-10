"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attrs: {
        href: string;
        name: string;
        size?: number | null;
      }) => ReturnType;
    };
  }
}

/** 확장자에 맞는 아이콘 */
export function fileIcon(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["hwp", "hwpx", "doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["zip"].includes(ext)) return "🗜";
  return "📄";
}

/** 12345 → "12.1 KB" */
export function humanSize(bytes: number | null | undefined): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 노션식 파일 첨부 블록.
 * 저장 HTML: <a data-type="fileAttachment" class="editor-file" href="…" download>…</a>
 * → 에디터 밖(PDF 미리보기, 예전 메모 열람)에서도 그대로 눌러서 받을 수 있다.
 */
export const FileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: { default: "" },
      name: { default: "첨부파일" },
      size: {
        default: null as number | null,
        parseHTML: (el) => {
          const n = parseInt((el as HTMLElement).getAttribute("data-size") || "", 10);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => (attrs.size ? { "data-size": String(attrs.size) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="fileAttachment"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = (node.attrs.name as string) || "첨부파일";
    const size = humanSize(node.attrs.size as number | null);
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "fileAttachment",
        class: "editor-file",
        href: node.attrs.href || "#",
        target: "_blank",
        rel: "noreferrer",
        download: name,
      }),
      ["span", { class: "editor-file-icon" }, fileIcon(name)],
      [
        "span",
        { class: "editor-file-meta" },
        ["span", { class: "editor-file-name" }, name],
        ["span", { class: "editor-file-size" }, size],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

function FileView({ node, editor, selected, deleteNode }: NodeViewProps) {
  const name = (node.attrs.name as string) || "첨부파일";
  const href = (node.attrs.href as string) || "#";
  const size = humanSize(node.attrs.size as number | null);
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className="editor-file-block" contentEditable={false}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        download={name}
        className={`editor-file${selected ? " is-selected" : ""}`}
      >
        <span className="editor-file-icon">{fileIcon(name)}</span>
        <span className="editor-file-meta">
          <span className="editor-file-name">{name}</span>
          <span className="editor-file-size">{size}</span>
        </span>
      </a>
      {editable && (
        <button
          type="button"
          title="첨부 삭제"
          className="editor-file-del no-print"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => deleteNode()}
        >
          🗑
        </button>
      )}
    </NodeViewWrapper>
  );
}

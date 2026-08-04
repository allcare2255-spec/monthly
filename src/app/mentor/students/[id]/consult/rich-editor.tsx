"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Extension, type Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extension-placeholder";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ResizableImage } from "./editor-image";

// ── 색상 팔레트 (노션과 동일한 10색 + 기본) ─────────────────────
type Swatch = { name: string; text: string; bg: string };
const PALETTE: Swatch[] = [
  { name: "회색", text: "#787774", bg: "#f1f1ef" },
  { name: "갈색", text: "#9f6b53", bg: "#f4eeee" },
  { name: "주황", text: "#d9730d", bg: "#fbecdd" },
  { name: "노랑", text: "#cb912f", bg: "#fbf3db" },
  { name: "초록", text: "#448361", bg: "#edf3ec" },
  { name: "파랑", text: "#337ea9", bg: "#e7f3f8" },
  { name: "보라", text: "#9065b0", bg: "#f4f0f7" },
  { name: "분홍", text: "#c14c8a", bg: "#fbf2f5" },
  { name: "빨강", text: "#d44c47", bg: "#fdebec" },
];

// ── 슬래시(/) 명령 ──────────────────────────────────────────────
type SlashItem = {
  title: string;
  hint: string;
  keywords: string;
  run: (editor: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { title: "텍스트", hint: "일반 문단", keywords: "텍스트 text paragraph 본문", run: (e) => e.chain().focus().setParagraph().run() },
  { title: "할 일 목록", hint: "체크박스", keywords: "할일 todo check 체크박스 task", run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: "글머리 기호 목록", hint: "• 목록", keywords: "글머리 불릿 bullet list 목록", run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "번호 목록", hint: "1. 목록", keywords: "번호 numbered ordered list 목록", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "제목1", hint: "큰 제목", keywords: "제목 heading h1 title", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: "제목2", hint: "중간 제목", keywords: "제목 heading h2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: "제목3", hint: "작은 제목", keywords: "제목 heading h3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: "인용", hint: "인용문", keywords: "인용 quote blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "구분선", hint: "가로줄", keywords: "구분선 divider hr line", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: "코드", hint: "코드 블록", keywords: "코드 code block", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: "이미지", hint: "사진 올리기", keywords: "이미지 사진 image photo picture 업로드", run: () => {} }, // 아래에서 특별 처리
];

const SlashCommand = Extension.create<{ suggestion: Omit<SuggestionOptions, "editor"> }>({
  name: "slashCommand",
  addOptions() {
    return { suggestion: { char: "/", startOfLine: false, command: () => {} } };
  },
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});

// ── 노션과 같은 단축키 ──────────────────────────────────────────
const NotionShortcuts = Extension.create({
  name: "notionShortcuts",
  priority: 1000,
  addKeyboardShortcuts() {
    const toggleTaskChecked = () => {
      const { state } = this.editor;
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === "taskItem") {
          return this.editor.commands.updateAttributes("taskItem", { checked: !node.attrs.checked });
        }
      }
      return false;
    };
    return {
      "Mod-Shift-5": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-6": () => this.editor.commands.toggleOrderedList(),
      "Mod-Shift-7": () => this.editor.commands.toggleTaskList(),
      "Mod-Shift-0": () => this.editor.commands.setParagraph(),
      "Mod-Shift-1": () => this.editor.commands.toggleHeading({ level: 1 }),
      "Mod-Shift-2": () => this.editor.commands.toggleHeading({ level: 2 }),
      "Mod-Shift-3": () => this.editor.commands.toggleHeading({ level: 3 }),
      "Mod-Enter": toggleTaskChecked,
    };
  },
});

export function RichEditor({
  studentId,
  initialHtml,
  onChange,
  editable = true,
}: {
  studentId: string;
  initialHtml: string;
  onChange: (html: string) => void;
  editable?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Ctrl/Cmd+Shift+H — 마지막에 쓴 색을 다시 적용
  const lastColorRef = useRef<{ kind: "text" | "bg"; value: string } | null>(null);

  // 슬래시 메뉴 상태
  const [slash, setSlash] = useState<{
    open: boolean;
    items: SlashItem[];
    index: number;
    rect: { top: number; left: number; bottom: number } | null;
    command: ((item: SlashItem) => void) | null;
  }>({ open: false, items: [], index: 0, rect: null, command: null });
  const slashRef = useRef(slash);
  slashRef.current = slash;

  /** 파일 업로드 후 커서 위치에 이미지 삽입 */
  const uploadAndInsert = useCallback(
    async (editor: Editor, files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return;
      setUploading(true);
      setUploadError("");
      try {
        for (const file of imgs) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("student_id", studentId);
          const res = await fetch("/api/consulting/note/image", { method: "POST", body: fd });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(d.error || "이미지 업로드 실패");
          editor.chain().focus().setImage({ src: d.url }).createParagraphNear().run();
        }
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "이미지 업로드 실패");
      } finally {
        setUploading(false);
      }
    },
    [studentId],
  );

  const suggestion = useMemo<Omit<SuggestionOptions, "editor">>(
    () => ({
      char: "/",
      startOfLine: false,
      items: ({ query }: { query: string }) => {
        const q = query.trim().toLowerCase();
        if (!q) return SLASH_ITEMS;
        return SLASH_ITEMS.filter(
          (i) => i.title.toLowerCase().includes(q) || i.keywords.toLowerCase().includes(q),
        );
      },
      render: () => ({
        onStart: (props) => {
          const r = props.clientRect?.();
          setSlash({
            open: true,
            items: props.items as SlashItem[],
            index: 0,
            rect: r ? { top: r.top, left: r.left, bottom: r.bottom } : null,
            command: (item: SlashItem) => props.command(item as never),
          });
        },
        onUpdate: (props) => {
          const r = props.clientRect?.();
          setSlash((s) => ({
            ...s,
            open: true,
            items: props.items as SlashItem[],
            index: 0,
            rect: r ? { top: r.top, left: r.left, bottom: r.bottom } : s.rect,
            command: (item: SlashItem) => props.command(item as never),
          }));
        },
        onKeyDown: (props) => {
          const s = slashRef.current;
          if (!s.open) return false;
          if (props.event.key === "Escape") {
            setSlash((x) => ({ ...x, open: false }));
            return true;
          }
          if (props.event.key === "ArrowDown") {
            setSlash((x) => ({ ...x, index: (x.index + 1) % Math.max(x.items.length, 1) }));
            return true;
          }
          if (props.event.key === "ArrowUp") {
            setSlash((x) => ({
              ...x,
              index: (x.index - 1 + Math.max(x.items.length, 1)) % Math.max(x.items.length, 1),
            }));
            return true;
          }
          if (props.event.key === "Enter" || props.event.key === "Tab") {
            const item = s.items[s.index];
            if (item && s.command) s.command(item);
            return true;
          }
          return false;
        },
        onExit: () => setSlash((x) => ({ ...x, open: false })),
      }),
      // 항목 선택 시: "/query" 를 지우고 해당 블록으로 전환
      command: ({ editor, range, props }) => {
        const item = props as unknown as SlashItem;
        editor.chain().focus().deleteRange(range).run();
        if (item.title === "이미지") fileInputRef.current?.click();
        else item.run(editor as Editor);
      },
    }),
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer", target: "_blank" } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      BackgroundColor,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "컨설팅 내용을 작성해주세요." }),
      NotionShortcuts,
      SlashCommand.configure({ suggestion }),
    ],
    content: initialHtml || "",
    editorProps: {
      attributes: { class: "rich-content consult-note-editor" },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (files.some((f) => f.type.startsWith("image/"))) {
          event.preventDefault();
          const ed = (view as unknown as { __editor?: Editor }).__editor;
          if (ed) uploadAndInsert(ed, files);
          return true;
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files || []);
        if (files.some((f) => f.type.startsWith("image/"))) {
          event.preventDefault();
          const ed = (view as unknown as { __editor?: Editor }).__editor;
          if (ed) uploadAndInsert(ed, files);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // editorProps 안에서 editor 인스턴스에 접근하기 위한 연결
  useEffect(() => {
    if (!editor) return;
    (editor.view as unknown as { __editor?: Editor }).__editor = editor;
  }, [editor]);

  // 서버에서 새 값이 내려오면(주차 이동 등) 에디터 내용 교체
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === (initialHtml || "<p></p>")) return;
    editor.commands.setContent(initialHtml || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml, editor]);

  // 마지막 색 다시 적용 (Ctrl/Cmd + Shift + H)
  useEffect(() => {
    if (!editor) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        const last = lastColorRef.current;
        if (!last || !editor.isFocused) return;
        e.preventDefault();
        applyColor(editor, last.kind, last.value, lastColorRef);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[520px] rounded-xl border border-ink/10 bg-ink/[0.02]" />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <Toolbar
        editor={editor}
        onPickImage={() => fileInputRef.current?.click()}
        uploading={uploading}
        lastColorRef={lastColorRef}
        disabled={!editable}
      />

      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        shouldShow={({ editor, from, to }) =>
          editable && from !== to && !editor.isActive("image")
        }
      >
        <div className="editor-bubble">
          <MarkBtn editor={editor} name="bold" label="B" title="굵게 (Ctrl+B)" cls="font-extrabold" />
          <MarkBtn editor={editor} name="italic" label="i" title="기울임 (Ctrl+I)" cls="italic font-serif" />
          <MarkBtn editor={editor} name="underline" label="U" title="밑줄 (Ctrl+U)" cls="underline" />
          <MarkBtn editor={editor} name="strike" label="S" title="취소선 (Ctrl+Shift+S)" cls="line-through" />
          <MarkBtn editor={editor} name="code" label="{}" title="인라인 코드 (Ctrl+E)" cls="font-mono text-[11px]" />
          <button
            type="button"
            title="링크 (Ctrl+K)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => promptLink(editor)}
            className="editor-btn"
          >
            🔗
          </button>
          <span className="editor-sep" />
          <ColorMenu editor={editor} lastColorRef={lastColorRef} compact />
        </div>
      </BubbleMenu>

      <div className="relative flex flex-1 flex-col">
        <EditorContent editor={editor} className="flex flex-1 flex-col" />
        {uploading && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-ink/80 px-3 py-1.5 text-[11px] font-semibold text-white">
            이미지 올리는 중…
          </div>
        )}
      </div>

      {uploadError && <p className="mt-2 text-[11px] font-semibold text-rose">{uploadError}</p>}

      {/* 슬래시 메뉴 */}
      {slash.open && slash.rect && slash.items.length > 0 && (
        <div
          className="editor-slash"
          style={{ top: slash.rect.bottom + 6, left: slash.rect.left }}
        >
          {slash.items.map((item, i) => (
            <button
              key={item.title}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSlash((s) => ({ ...s, index: i }))}
              onClick={() => slash.command?.(item)}
              className={`editor-slash-item${i === slash.index ? " is-active" : ""}`}
            >
              <span className="font-semibold">{item.title}</span>
              <span className="text-ink/40">{item.hint}</span>
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (files.length) uploadAndInsert(editor, files);
        }}
      />
    </div>
  );
}

// ── 색 적용 ─────────────────────────────────────────────────────
type LastColorRef = React.RefObject<{ kind: "text" | "bg"; value: string } | null>;

function applyColor(editor: Editor, kind: "text" | "bg", value: string, ref: LastColorRef) {
  const chain = editor.chain().focus();
  // 선택이 없으면 노션처럼 현재 블록 전체에 적용한다
  const { empty, $from } = editor.state.selection;
  if (empty) {
    const start = $from.start();
    const end = $from.end();
    chain.setTextSelection({ from: start, to: end });
  }
  if (kind === "text") value === "" ? chain.unsetColor().run() : chain.setColor(value).run();
  else value === "" ? chain.unsetBackgroundColor().run() : chain.setBackgroundColor(value).run();
  if (value) ref.current = { kind, value };
}

// ── 툴바 ────────────────────────────────────────────────────────
function Toolbar({
  editor,
  onPickImage,
  uploading,
  lastColorRef,
  disabled,
}: {
  editor: Editor;
  onPickImage: () => void;
  uploading: boolean;
  lastColorRef: LastColorRef;
  disabled: boolean;
}) {
  return (
    <div className="editor-toolbar no-print">
      <Btn editor={editor} title="제목1 (Ctrl+Shift+1)" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn editor={editor} title="제목2 (Ctrl+Shift+2)" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn editor={editor} title="제목3 (Ctrl+Shift+3)" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <span className="editor-sep" />
      <MarkBtn editor={editor} name="bold" label="B" title="굵게 (Ctrl+B)" cls="font-extrabold" />
      <MarkBtn editor={editor} name="italic" label="i" title="기울임 (Ctrl+I)" cls="italic font-serif" />
      <MarkBtn editor={editor} name="underline" label="U" title="밑줄 (Ctrl+U)" cls="underline" />
      <MarkBtn editor={editor} name="strike" label="S" title="취소선 (Ctrl+Shift+S)" cls="line-through" />
      <MarkBtn editor={editor} name="code" label="{}" title="인라인 코드 (Ctrl+E)" cls="font-mono text-[11px]" />
      <span className="editor-sep" />
      <Btn editor={editor} title="할 일 목록 (Ctrl+Shift+7)" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        ☑
      </Btn>
      <Btn editor={editor} title="글머리 기호 목록 (Ctrl+Shift+5)" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </Btn>
      <Btn editor={editor} title="번호 목록 (Ctrl+Shift+6)" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </Btn>
      <Btn editor={editor} title="들여쓰기 (Tab)" onClick={() => editor.chain().focus().sinkListItem("listItem").run()}>
        ⇥
      </Btn>
      <Btn editor={editor} title="내어쓰기 (Shift+Tab)" onClick={() => editor.chain().focus().liftListItem("listItem").run()}>
        ⇤
      </Btn>
      <span className="editor-sep" />
      <Btn editor={editor} title="인용" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </Btn>
      <Btn editor={editor} title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        ―
      </Btn>
      <Btn editor={editor} title="링크 (Ctrl+K)" active={editor.isActive("link")} onClick={() => promptLink(editor)}>
        🔗
      </Btn>
      <Btn editor={editor} title="사진 넣기" onClick={onPickImage} disabled={uploading}>
        🖼
      </Btn>
      <span className="editor-sep" />
      <ColorMenu editor={editor} lastColorRef={lastColorRef} />
      <span className="editor-sep" />
      <Btn editor={editor} title="되돌리기 (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={disabled}>
        ↶
      </Btn>
      <Btn editor={editor} title="다시 실행 (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()} disabled={disabled}>
        ↷
      </Btn>
      <Btn editor={editor} title="서식 지우기" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        ⌫
      </Btn>
    </div>
  );
}

function Btn({
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  editor: Editor;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`editor-btn${active ? " is-active" : ""}`}
    >
      {children}
    </button>
  );
}

function MarkBtn({
  editor,
  name,
  label,
  title,
  cls,
}: {
  editor: Editor;
  name: "bold" | "italic" | "underline" | "strike" | "code";
  label: string;
  title: string;
  cls?: string;
}) {
  const run = () => {
    const c = editor.chain().focus();
    if (name === "bold") c.toggleBold().run();
    else if (name === "italic") c.toggleItalic().run();
    else if (name === "underline") c.toggleUnderline().run();
    else if (name === "strike") c.toggleStrike().run();
    else c.toggleCode().run();
  };
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`editor-btn ${cls || ""}${editor.isActive(name) ? " is-active" : ""}`}
    >
      {label}
    </button>
  );
}

function ColorMenu({
  editor,
  lastColorRef,
  compact,
}: {
  editor: Editor;
  lastColorRef: LastColorRef;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="글자색 / 배경색"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="editor-btn"
      >
        <span className="editor-color-chip" />
        {!compact && <span className="ml-1 text-[10px]">▾</span>}
      </button>
      {open && (
        <div className="editor-color-pop">
          <div className="editor-color-title">글자색</div>
          <div className="editor-color-grid">
            <button
              type="button"
              title="기본"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { applyColor(editor, "text", "", lastColorRef); setOpen(false); }}
              className="editor-color-cell"
              style={{ color: "#1a1a1e" }}
            >
              A
            </button>
            {PALETTE.map((c) => (
              <button
                key={`t-${c.name}`}
                type="button"
                title={`${c.name} 글자색`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { applyColor(editor, "text", c.text, lastColorRef); setOpen(false); }}
                className="editor-color-cell"
                style={{ color: c.text }}
              >
                A
              </button>
            ))}
          </div>
          <div className="editor-color-title mt-2">배경색</div>
          <div className="editor-color-grid">
            <button
              type="button"
              title="기본"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { applyColor(editor, "bg", "", lastColorRef); setOpen(false); }}
              className="editor-color-cell"
              style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
            >
              A
            </button>
            {PALETTE.map((c) => (
              <button
                key={`b-${c.name}`}
                type="button"
                title={`${c.name} 배경색`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { applyColor(editor, "bg", c.bg, lastColorRef); setOpen(false); }}
                className="editor-color-cell"
                style={{ background: c.bg }}
              >
                A
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-ink/45">
            Ctrl/Cmd + Shift + H — 마지막 색 다시 적용
          </div>
        </div>
      )}
    </div>
  );
}

function promptLink(editor: Editor) {
  const prev = (editor.getAttributes("link").href as string) || "";
  const url = window.prompt("링크 주소를 입력하세요 (비우면 링크 해제)", prev);
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

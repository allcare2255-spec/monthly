"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Extension, type Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorProps } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Placeholder } from "@tiptap/extension-placeholder";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ResizableImage } from "./editor-image";
import { Callout, cleanCalloutEmojiLines } from "./editor-callout";
import { BlockBackground, applyBlockBackground } from "./editor-block-bg";

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
  /** 파일 선택창처럼 에디터 밖 동작이 필요한 항목 */
  special?: "image";
  run: (editor: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { title: "텍스트", hint: "일반 문단", keywords: "텍스트 text paragraph 본문", run: (e) => e.chain().focus().setParagraph().run() },
  { title: "할 일 목록", hint: "체크박스", keywords: "할일 todo check 체크박스 task", run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: "글머리 기호 목록", hint: "• 목록", keywords: "글머리 불릿 bullet list 목록", run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "번호 목록", hint: "1. 목록", keywords: "번호 numbered ordered list 목록", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "토글 목록", hint: "▸ 접었다 펴기", keywords: "토글 toggle details 접기 펼치기 아코디언", run: (e) => e.chain().focus().setDetails().run() },
  { title: "콜아웃", hint: "💡 강조 박스", keywords: "콜아웃 callout 강조 박스 note tip 안내", run: (e) => e.chain().focus().setCallout().run() },
  { title: "표", hint: "3×3 표", keywords: "표 table 테이블 격자", run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: "제목1", hint: "큰 제목", keywords: "제목 heading h1 title", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: "제목2", hint: "중간 제목", keywords: "제목 heading h2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: "제목3", hint: "작은 제목", keywords: "제목 heading h3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: "인용", hint: "인용문", keywords: "인용 quote blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "구분선", hint: "가로줄", keywords: "구분선 divider hr line", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: "코드", hint: "코드 블록", keywords: "코드 code block", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: "이미지", hint: "사진 올리기", keywords: "이미지 사진 image photo picture 업로드", special: "image", run: () => {} },
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
// 번호는 노션 실제 단축키에 맞춘다: 0 텍스트 / 1~3 제목 / 4 할 일 / 5 글머리 / 6 번호 / 7 토글
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
      "Mod-Shift-0": () => this.editor.commands.setParagraph(),
      "Mod-Shift-1": () => this.editor.commands.toggleHeading({ level: 1 }),
      "Mod-Shift-2": () => this.editor.commands.toggleHeading({ level: 2 }),
      "Mod-Shift-3": () => this.editor.commands.toggleHeading({ level: 3 }),
      "Mod-Shift-4": () => this.editor.commands.toggleTaskList(),
      "Mod-Shift-5": () => this.editor.commands.toggleBulletList(),
      "Mod-Shift-6": () => this.editor.commands.toggleOrderedList(),
      "Mod-Shift-7": () =>
        this.editor.isActive("details")
          ? this.editor.commands.unsetDetails()
          : this.editor.commands.setDetails(),
      "Mod-Shift-8": () => this.editor.commands.toggleCodeBlock(),
      // 노션과 동일하게 Ctrl/Cmd+K 로 링크 입력창을 연다
      "Mod-k": () => {
        promptLink(this.editor);
        return true;
      },
      "Mod-Enter": toggleTaskChecked,
    };
  },
});

export function RichEditor({
  studentId,
  initialHtml: rawInitialHtml,
  onChange,
  editable = true,
}: {
  studentId: string;
  initialHtml: string;
  onChange: (html: string) => void;
  editable?: boolean;
}) {
  // 예전 버그로 콜아웃 안에 쌓인 이모지 문단을 열면서 정리한다
  const initialHtml = useMemo(() => cleanCalloutEmojiLines(rawInitialHtml), [rawInitialHtml]);
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
          // 한글 조합 중의 Enter 는 글자를 확정하는 키다. 여기서 가로채면 "/각" 처럼
          // 조합 중인 글자가 사라지고 엉뚱한 항목이 실행된다.
          if (props.event.isComposing || props.event.keyCode === 229) return false;
          // 검색 결과가 없으면 메뉴가 보이지 않는데도 키를 삼켜서
          // Enter 로 줄바꿈이 안 되던 문제 — 결과가 없으면 에디터에 넘긴다.
          if (!s.items.length) return false;
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
            const item = s.items[Math.min(s.index, s.items.length - 1)];
            if (!item || !s.command) return false;
            s.command(item);
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
        if (item.special === "image") fileInputRef.current?.click();
        else item.run(editor as Editor);
      },
    }),
    [],
  );

  // ⚠️ 확장 목록은 반드시 한 번만 만든다.
  // useEditor 는 렌더할 때마다 옵션을 이전 값과 "같은 객체인지"로 비교하는데,
  // 여기서 매번 새로 만들면 항상 다르다고 판단해 editor.setOptions() 를 부른다.
  // 그러면 글자 하나 칠 때마다 view.updateState() 가 돌면서 본문 전체가 다시 그려지고,
  // 커서·한글 조합·React 노드뷰(콜아웃·이미지)가 통째로 리셋된다 → 에디터가 먹통이 된다.
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // openOnClick: 편집 중에도 링크를 누르면 새 탭으로 열린다 (노션과 동일).
        // ProseMirror 의 handleClick 은 드래그가 아닌 '제자리 클릭'에만 반응하므로,
        // 링크 글자를 드래그해서 선택하고 수정하는 것도 그대로 된다.
        link: { openOnClick: true, autolink: true, HTMLAttributes: { rel: "noreferrer", target: "_blank" } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      BackgroundColor,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      BlockBackground,
      TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true } }),
      // persist: 접힘/펼침 상태를 저장해 다시 열었을 때 그대로 보이게 한다
      Details.configure({ persist: true, HTMLAttributes: { class: "editor-details" } }),
      DetailsSummary,
      DetailsContent,
      Callout,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ editor, node, pos }) => {
          if (node.type.name === "detailsSummary") return "토글 제목";
          if (node.type.name !== "paragraph") return "";
          // 표 셀·콜아웃 안의 빈 문단까지 안내문이 새어 나오지 않도록 최상위 문단만 대상으로 한다
          return editor.state.doc.resolve(pos).depth === 0 ? "컨설팅 내용을 작성해주세요." : "";
        },
      }),
      NotionShortcuts,
      SlashCommand.configure({ suggestion }),
    ],
    [suggestion],
  );

  // editorProps 도 같은 이유로 한 번만 만든다
  const editorProps = useMemo<EditorProps>(
    () => ({
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
          if (!ed) return true;
          // 예전에는 커서 자리에 들어가서, 사진을 끌어다 놓아도 엉뚱한 곳에 붙었다.
          const at = view.posAtCoords({
            left: (event as DragEvent).clientX,
            top: (event as DragEvent).clientY,
          });
          if (at) ed.commands.setTextSelection(at.pos);
          uploadAndInsert(ed, files);
          return true;
        }
        return false;
      },
    }),
    [uploadAndInsert],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    // 이 값이 없으면 커서를 옮기거나 글을 써도 React 를 다시 그리지 않는다. 그러면 툴바의
    // 눌림 표시(B·H1·목록…)가 처음 상태로 굳고, 표 안에 커서를 놔도 표 편집 줄이 뜨지 않는다.
    shouldRerenderOnTransaction: true,
    extensions,
    content: initialHtml || "",
    editorProps,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // editorProps 안에서 editor 인스턴스에 접근하기 위한 연결
  useEffect(() => {
    if (!editor) return;
    (editor.view as unknown as { __editor?: Editor }).__editor = editor;
  }, [editor]);

  // useEditor 는 editable 옵션이 바뀌어도 현재 값을 유지하므로 직접 반영해준다
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // 서버에서 새 값이 내려오면(주차 이동 등) 에디터 내용 교체
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === (initialHtml || "<p></p>")) return;
    editor.commands.setContent(initialHtml || "", { emitUpdate: false });
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

      {editable && editor.isActive("table") && <TableToolbar editor={editor} />}

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

      {editable && <BlockDragHandle editor={editor} />}

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
          // 커서가 화면 아래쪽이면 메뉴가 잘려서 항목을 못 누른다 → 위로 띄운다
          style={slashMenuStyle(slash.rect)}
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

/** 슬래시 메뉴 위치 — 아래 공간이 부족하면 커서 위로, 오른쪽으로 넘치면 안쪽으로 당긴다 */
const SLASH_MENU_H = 300;
const SLASH_MENU_W = 250;
function slashMenuStyle(rect: { top: number; left: number; bottom: number }): React.CSSProperties {
  if (typeof window === "undefined") return { top: rect.bottom + 6, left: rect.left };
  const below = window.innerHeight - rect.bottom;
  const top =
    below < SLASH_MENU_H + 16 && rect.top > below
      ? Math.max(8, rect.top - Math.min(SLASH_MENU_H, rect.top - 16) - 6)
      : rect.bottom + 6;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - SLASH_MENU_W - 8));
  const maxHeight =
    top < rect.top ? Math.min(SLASH_MENU_H, rect.top - 14) : Math.min(SLASH_MENU_H, below - 14);
  return { top, left, maxHeight: Math.max(120, maxHeight) };
}

// ── 블록 드래그 핸들 (노션의 ⠿ + ＋) ────────────────────────────
function BlockDragHandle({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴가 열려 있는 동안에는 마우스가 다른 블록 위를 지나가도 대상 블록을 바꾸지 않는다.
  // (메뉴 항목으로 마우스를 옮기다가 대상이 바뀌면 엉뚱한 블록이 삭제·복제된다)
  // ref 는 렌더 중이 아니라 이 setter 안에서만 갱신한다.
  const menuOpenRef = useRef(false);
  const setMenu = useCallback((open: boolean) => {
    menuOpenRef.current = open;
    setMenuOpen(open);
  }, []);

  // ⚠️ DragHandle 은 onNodeChange 의 함수 정체성이 바뀌면 ProseMirror 플러그인을 통째로
  // 재등록한다. 인라인 화살표 함수를 넘기면 블록 위로 마우스를 옮길 때마다 재등록되면서
  // 핸들이 숨겨졌다 나타나기를 반복해 ＋ / ⠿ 클릭이 자주 씹힌다. 반드시 고정해야 한다.
  const handleNodeChange = useCallback(({ pos: next }: { node: PMNode | null; pos: number }) => {
    if (menuOpenRef.current) return;
    setPos(next);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenu]);

  const valid = pos >= 0;

  /** 이 블록 안으로 커서를 옮긴다 (블록 전환 명령의 기준점) */
  const focusBlock = useCallback(() => {
    if (!valid) return;
    // 목록·토글처럼 pos+1 이 글자 자리가 아닌 블록에서도 안전하도록 near 로 붙인다
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        if (pos + 1 > tr.doc.content.size) return false;
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
        return true;
      })
      .run();
  }, [editor, pos, valid]);

  const insertParagraph = useCallback(
    (where: "before" | "after") => {
      if (!valid) return;
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node) return false;
          const para = state.schema.nodes.paragraph.create();
          const $pos = tr.doc.resolve(pos);
          // 목록 안쪽처럼 문단을 바로 넣을 수 없는 자리면, 문단을 받을 수 있는 가장 가까운
          // 바깥 블록 옆으로 올라간다. 예전에는 여기서 ＋ 가 조용히 실패하거나 문서가 깨졌다.
          let depth = $pos.depth;
          while (depth > 0 && !$pos.node(depth).type.contentMatch.matchType(para.type)) depth--;
          const at =
            depth === $pos.depth
              ? where === "before"
                ? pos
                : pos + node.nodeSize
              : where === "before"
                ? $pos.before(depth + 1)
                : $pos.after(depth + 1);
          tr.insert(at, para);
          // 새로 넣은 빈 문단 안으로 커서 이동
          tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)));
          return true;
        })
        .run();
      setMenu(false);
    },
    [editor, pos, valid, setMenu],
  );

  const duplicate = useCallback(() => {
    if (!valid) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node) return false;
        tr.insert(pos + node.nodeSize, node.copy(node.content));
        return true;
      })
      .run();
    setMenu(false);
  }, [editor, pos, valid, setMenu]);

  const remove = useCallback(() => {
    if (!valid) return;
    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node) return false;
        // 문서에 이 블록 하나만 남았을 때 통째로 지우면 문서 구조가 깨진다 → 빈 문단으로 바꾼다
        if (tr.doc.childCount === 1 && pos === 0) {
          tr.replaceWith(0, tr.doc.content.size, state.schema.nodes.paragraph.create());
        } else {
          tr.delete(pos, pos + node.nodeSize);
        }
        return true;
      })
      .run();
    setMenu(false);
  }, [editor, pos, valid, setMenu]);

  const convert = useCallback(
    (fn: (e: Editor) => void) => {
      if (!valid) return;
      focusBlock();
      fn(editor);
      setMenu(false);
    },
    [editor, focusBlock, valid, setMenu],
  );

  return (
    <DragHandle editor={editor} nested className="editor-drag-handle" onNodeChange={handleNodeChange}>
      <div className="editor-drag-zone" ref={menuRef}>
        <button
          type="button"
          title="아래에 블록 추가"
          className="editor-drag-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertParagraph("after")}
        >
          ＋
        </button>
        {/* onMouseDown 에서 preventDefault 를 하면 HTML5 드래그가 시작되지 않아
            블록 순서 바꾸기가 아예 안 된다. 그립만은 기본 동작을 막지 않는다. */}
        <button
          type="button"
          title="드래그해서 옮기기 · 눌러서 메뉴"
          className="editor-drag-btn editor-drag-grip"
          onClick={() => setMenu(!menuOpenRef.current)}
        >
          ⠿
        </button>

        {menuOpen && (
          <div className="editor-block-menu">
            <MenuItem onClick={() => insertParagraph("before")}>위에 블록 추가</MenuItem>
            <MenuItem onClick={() => insertParagraph("after")}>아래에 블록 추가</MenuItem>
            <MenuItem onClick={duplicate}>복제</MenuItem>
            <MenuItem onClick={remove} danger>
              삭제
            </MenuItem>
            <div className="editor-block-menu-title">전환</div>
            {/* 목록·인용처럼 감싸는 블록 안에서는 clearNodes() 로 먼저 풀어야 제목/텍스트로 바뀐다 */}
            <MenuItem onClick={() => convert((e) => e.chain().focus().clearNodes().setParagraph().run())}>텍스트</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().clearNodes().setNode("heading", { level: 1 }).run())}>제목1</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().clearNodes().setNode("heading", { level: 2 }).run())}>제목2</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().clearNodes().setNode("heading", { level: 3 }).run())}>제목3</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().toggleTaskList().run())}>할 일 목록</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().toggleBulletList().run())}>글머리 기호 목록</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().toggleOrderedList().run())}>번호 목록</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().toggleBlockquote().run())}>인용</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().setCallout().run())}>콜아웃</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().setDetails().run())}>토글 목록</MenuItem>
            <MenuItem onClick={() => convert((e) => e.chain().focus().toggleCodeBlock().run())}>코드</MenuItem>
          </div>
        )}
      </div>
    </DragHandle>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`editor-block-menu-item${danger ? " is-danger" : ""}`}
    >
      {children}
    </button>
  );
}

// ── 색 적용 ─────────────────────────────────────────────────────
type ColorKind = "text" | "bg" | "block";
type LastColorRef = React.RefObject<{ kind: ColorKind; value: string } | null>;

function applyColor(editor: Editor, kind: ColorKind, value: string, ref: LastColorRef) {
  // 블록 배경색은 마크가 아니라 블록 속성이라 선택 범위를 넓힐 필요가 없다
  if (kind === "block") {
    applyBlockBackground(editor, value);
    if (value) ref.current = { kind, value };
    return;
  }
  const chain = editor.chain().focus();
  // 선택이 없으면 노션처럼 현재 블록 전체에 적용한다
  const { empty, $from } = editor.state.selection;
  if (empty) {
    const start = $from.start();
    const end = $from.end();
    chain.setTextSelection({ from: start, to: end });
  }
  if (kind === "text") {
    if (value === "") chain.unsetColor().run();
    else chain.setColor(value).run();
  } else {
    if (value === "") chain.unsetBackgroundColor().run();
    else chain.setBackgroundColor(value).run();
  }
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
    // 저장할 수 없는 주차에서는 눌러도 아무 일이 없으니, 아예 눌리지 않는다는 걸 보여준다
    <div className={`editor-toolbar no-print${disabled ? " is-disabled" : ""}`}>
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
      <Btn editor={editor} title="할 일 목록 (Ctrl+Shift+4)" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        ☑
      </Btn>
      <Btn editor={editor} title="글머리 기호 목록 (Ctrl+Shift+5)" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </Btn>
      <Btn editor={editor} title="번호 목록 (Ctrl+Shift+6)" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </Btn>
      <Btn editor={editor} title="들여쓰기 (Tab)" onClick={() => shiftListItem(editor, "in")}>
        ⇥
      </Btn>
      <Btn editor={editor} title="내어쓰기 (Shift+Tab)" onClick={() => shiftListItem(editor, "out")}>
        ⇤
      </Btn>
      <span className="editor-sep" />
      <Btn editor={editor} title="인용" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </Btn>
      <Btn editor={editor} title="토글 목록 (Ctrl+Shift+7)" active={editor.isActive("details")} onClick={() => toggleDetails(editor)}>
        ▸
      </Btn>
      <Btn editor={editor} title="콜아웃" active={editor.isActive("callout")} onClick={() => editor.chain().focus().toggleCallout().run()}>
        💡
      </Btn>
      <Btn editor={editor} title="표 넣기 (3×3)" active={editor.isActive("table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        ▦
      </Btn>
      <Btn editor={editor} title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        ―
      </Btn>
      <span className="editor-sep" />
      <Btn editor={editor} title="왼쪽 정렬 (Ctrl+Shift+L)" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        ⬅
      </Btn>
      <Btn editor={editor} title="가운데 정렬 (Ctrl+Shift+E)" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        ⬌
      </Btn>
      <Btn editor={editor} title="오른쪽 정렬 (Ctrl+Shift+R)" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        ➡
      </Btn>
      <span className="editor-sep" />
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
      <Btn
        editor={editor}
        title="서식 지우기"
        onClick={() => {
          // 블록 배경색은 마크가 아니라 블록 속성이라 unsetAllMarks 로는 지워지지 않는다
          applyBlockBackground(editor, "");
          editor.chain().focus().unsetAllMarks().clearNodes().run();
        }}
      >
        ⌫
      </Btn>
    </div>
  );
}

/** 표 안에 커서가 있을 때만 뜨는 표 편집 줄 */
function TableToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="editor-table-toolbar no-print">
      <span className="editor-table-label">표</span>
      <TBtn onClick={() => editor.chain().focus().addRowBefore().run()}>행↑</TBtn>
      <TBtn onClick={() => editor.chain().focus().addRowAfter().run()}>행↓</TBtn>
      <TBtn onClick={() => editor.chain().focus().addColumnBefore().run()}>열←</TBtn>
      <TBtn onClick={() => editor.chain().focus().addColumnAfter().run()}>열→</TBtn>
      <span className="editor-sep" />
      <TBtn onClick={() => editor.chain().focus().deleteRow().run()}>행 삭제</TBtn>
      <TBtn onClick={() => editor.chain().focus().deleteColumn().run()}>열 삭제</TBtn>
      <span className="editor-sep" />
      <TBtn onClick={() => editor.chain().focus().toggleHeaderRow().run()}>제목 행</TBtn>
      <TBtn onClick={() => editor.chain().focus().mergeOrSplit().run()}>병합/분할</TBtn>
      <span className="editor-sep" />
      <TBtn danger onClick={() => editor.chain().focus().deleteTable().run()}>
        표 삭제
      </TBtn>
    </div>
  );
}

function TBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`editor-table-btn${danger ? " is-danger" : ""}`}
    >
      {children}
    </button>
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
          <div className="editor-color-title mt-2">
            블록 배경색 <span className="editor-color-hint">줄 전체</span>
          </div>
          <div className="editor-color-grid">
            <button
              type="button"
              title="블록 배경 없애기"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { applyColor(editor, "block", "", lastColorRef); setOpen(false); }}
              className="editor-color-cell"
              style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
            >
              A
            </button>
            {PALETTE.map((c) => (
              <button
                key={`k-${c.name}`}
                type="button"
                title={`${c.name} 블록 배경색`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { applyColor(editor, "block", c.bg, lastColorRef); setOpen(false); }}
                className="editor-color-cell editor-color-cell-block"
                style={{ background: c.bg }}
              />
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
  const raw = url.trim();
  if (raw === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const href = /^(https?:\/\/|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;

  // 글자를 선택하지 않은 채 눌렀을 때 예전에는 아무 일도 일어나지 않았다.
  // 노션처럼 주소를 글자로 넣고 링크를 걸어준다.
  if (editor.state.selection.empty && !editor.isActive("link")) {
    editor
      .chain()
      .focus()
      .insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] })
      .unsetMark("link")
      .run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

/** 토글 목록 켜기/끄기 — 예전에는 누를 때마다 토글이 겹겹이 쌓였다 */
function toggleDetails(editor: Editor) {
  const chain = editor.chain().focus();
  if (editor.isActive("details")) chain.unsetDetails().run();
  else chain.setDetails().run();
}

/** 목록 들여쓰기/내어쓰기 — 할 일 목록은 항목 타입이 taskItem 이라 따로 넘겨야 한다 */
function shiftListItem(editor: Editor, dir: "in" | "out") {
  const type = editor.isActive("taskItem") ? "taskItem" : "listItem";
  const chain = editor.chain().focus();
  if (dir === "in") chain.sinkListItem(type).run();
  else chain.liftListItem(type).run();
}

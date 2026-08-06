import { Extension, type Editor } from "@tiptap/core";

/**
 * 노션식 "블록 배경색" — 글자 뒤가 아니라 블록 폭 전체에 색 띠를 깐다.
 *
 * 글자 배경색(BackgroundColor 마크)은 글자가 짧으면 색도 짧게 끊기지만,
 * 이건 블록 속성이라 제목처럼 짧은 줄도 한 줄 전체가 채워진다.
 * 저장 HTML: <h2 data-block-bg="#e7f3f8" style="background:#e7f3f8">
 */

/** 배경을 입힐 수 있는 블록 — 목록은 항목(listItem/taskItem) 단위로 칠한다 */
export const BLOCK_BG_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "taskItem",
  "codeBlock",
];

export const BlockBackground = Extension.create({
  name: "blockBackground",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_BG_TYPES,
        attributes: {
          blockBg: {
            default: null as string | null,
            parseHTML: (el) => (el as HTMLElement).getAttribute("data-block-bg"),
            renderHTML: (attrs) =>
              attrs.blockBg
                ? { "data-block-bg": attrs.blockBg, style: `background:${attrs.blockBg}` }
                : {},
          },
        },
      },
    ];
  },
});

/**
 * 선택 영역에 걸친 블록들의 배경색을 바꾼다 (value 가 빈 문자열이면 해제).
 * 바깥 블록이 먼저 걸리면 그 안쪽은 건너뛴다 — 인용문 안 문단까지 이중으로 칠하지 않기 위해.
 */
export function applyBlockBackground(editor: Editor, value: string) {
  const { from, to } = editor.state.selection;
  const targets: number[] = [];

  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (BLOCK_BG_TYPES.includes(node.type.name)) {
      targets.push(pos);
      return false; // 안쪽 블록은 건너뛴다
    }
    return true;
  });

  if (!targets.length) return;

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // setNodeMarkup 은 노드 크기를 바꾸지 않으므로 위치가 밀리지 않는다
      for (const pos of targets) {
        const node = tr.doc.nodeAt(pos);
        if (!node) continue;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockBg: value || null });
      }
      return true;
    })
    .run();
}

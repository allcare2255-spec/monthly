// 컨설팅 메모 본문 저장 포맷 헬퍼 (server/client 공용, 순수 함수)
//
// 메모는 원래 평문(textarea)이었고 지금은 리치 에디터의 HTML 을 같은 컬럼에 저장한다.
// 예전에 저장된 평문도 그대로 보여야 하므로, 읽을 때 HTML 인지 판별해 변환한다.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 저장값이 리치 에디터가 만든 HTML 인지 (평문 메모와 구분). */
export function isHtmlNote(value: string): boolean {
  return /^\s*<(p|ul|ol|h[1-3]|blockquote|pre|hr|img|div|table|details|aside)\b/i.test(value);
}

/** 저장값 → 에디터/렌더링용 HTML. 평문이면 줄 단위로 <p> 로 감싼다. */
export function noteToHtml(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (isHtmlNote(v)) return v;
  return v
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p></p>"))
    .join("");
}

/** 글자가 없어도 그 자체로 '내용'인 블록 — 이미지·표·구분선·토글·콜아웃 */
const CONTENT_BLOCK = /<(img|table|hr|details|aside)\b/i;

/** HTML 이 실질적으로 비어 있는지 (빈 문단만 있는 경우 포함). */
export function isEmptyNoteHtml(html: string): boolean {
  if (CONTENT_BLOCK.test(html)) return false;
  const stripped = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return stripped.length === 0;
}

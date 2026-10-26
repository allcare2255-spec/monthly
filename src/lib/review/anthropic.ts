import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { ReviewQuiz } from "@/types";

const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

if (!apiKey) {
  console.warn(
    "[복습] ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요."
  );
}

const client = new Anthropic({ apiKey });

/** 업로드된 자료 한 건 (이미지 또는 PDF). */
export interface UploadAsset {
  kind: "image" | "pdf";
  /** base64 인코딩된 데이터 (data URL 접두사 제외). */
  data: string;
  /** image/png, image/jpeg, application/pdf 등 */
  mediaType: string;
}

// ── 문제 생성 스키마 ────────────────────────────────────────────
const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "이 복습 테스트의 제목" },
    questions: {
      type: "array",
      description: "생성된 복습 문제 목록",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["multiple_choice", "ox", "short_answer", "essay"],
            description:
              "문제 유형. 자료 내용에 가장 적합한 유형을 자동으로 선택할 것.",
          },
          question: { type: "string", description: "문제 본문" },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "객관식 보기(4개 권장). OX는 ['O','X']. 단답/서술형은 빈 배열.",
          },
          answer: {
            type: "string",
            description:
              "정답. 객관식=정답 보기 텍스트 그대로, OX='O'/'X', 단답=대표 정답, 서술형=모범답안.",
          },
          acceptedAnswers: {
            type: "array",
            items: { type: "string" },
            description:
              "단답형에서 정답으로 인정할 다른 표현(동의어/표기 차이 등). 없으면 빈 배열.",
          },
          explanation: {
            type: "string",
            description: "정답 해설. 학생이 오답일 때 보여줄 설명.",
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
          },
        },
        required: [
          "type",
          "question",
          "options",
          "answer",
          "acceptedAnswers",
          "explanation",
          "difficulty",
        ],
      },
    },
  },
  required: ["title", "questions"],
} as const;

const SYSTEM_PROMPT = `너는 학생의 학습 자료(손글씨 노트, 풀이한 문제, 개념 정리 등의 사진/PDF)를 보고 복습용 테스트를 만드는 한국어 출제 전문가다.

[분량 — 매우 중요]
- 학생의 복습 시간이 약 10분이 되도록 출제한다.
- 객관식/OX ≈ 40초, 단답 ≈ 1분, 서술형 ≈ 2~3분으로 계산해 총 풀이 시간이 10분 내외가 되게 한다.
- 보통 6~8문제. 자료가 적으면 줄이고, 서술형은 0~1문제만.

[배치 — 쉬운 것부터 실력까지]
1) 확인층(쉬움): 용어·개념·공식 단답/OX/객관식 — 앞쪽에 배치해 워밍업.
2) 적용층(핵심): 변형·사례적용·추론 객관식 — 가장 비중 크게.
3) 설명층: "왜 그런지" 근거를 묻는 짧은 서술형 — 끝에 0~1문제.
난이도(difficulty)도 easy → medium → hard 순으로 자연스럽게 배치한다.

[과목 자동 판단 — 자료를 보고 과목을 스스로 파악해 그 과목에 맞게 출제]
- 국어: 문법·어휘는 단답/객관식. 비문학·문학은 근거 문장 찾기·화자/정서·표현법 객관식 + "왜 그렇게 보는가" 한 줄.
- 수학: 푼 문제는 숫자·조건만 바꾼 유사 객관식(가장 중요). 공식은 빈칸. 가능하면 "풀이 중 틀린 단계 찾기". 답이 명확하고 검산 가능한 객관식 위주로. 계산 정확성에 특히 주의.
- 영어: 어휘·어법은 단답/객관식. 지문은 요지·빈칸추론·지칭 객관식. 구문은 해석 빈칸.
- 과탐: 용어는 단답/OX. 핵심은 "A이면 B인 이유"·인과·실험 변인 객관식. 정량 단원은 수치 바꾼 계산.
- 사탐: 용어는 단답/객관식. 핵심은 "이 사례가 어떤 개념인가"(사례→개념 적용) 객관식. 헷갈리는 개념 비교.

[공통 원칙]
- 자료에 실제로 담긴 내용만 근거로 출제한다. 자료에 없는 내용을 지어내지 않는다.
- 객관식 보기는 그럴듯한 오답(매력적인 함정)을 포함해 4개로 만든다.
- 한국어로 출제하되, 자료의 표기(영어 용어, 수식 등)는 그대로 살린다.
- 해설은 학생이 스스로 이해할 수 있도록 핵심을 짚어 1~3문장으로 쓴다.`;

/** 업로드 자료를 Claude content 블록으로 변환. */
function toContentBlocks(assets: UploadAsset[]): any[] {
  return assets.map((a) => {
    if (a.kind === "pdf") {
      return {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.data },
      };
    }
    return {
      type: "image",
      source: { type: "base64", media_type: a.mediaType, data: a.data },
    };
  });
}

/** 자료(이미지/PDF)로부터 복습 테스트를 생성한다. */
export async function generateQuiz(
  assets: UploadAsset[],
  hint?: string
): Promise<ReviewQuiz> {
  if (assets.length === 0) {
    throw new Error("자료가 최소 1개 필요합니다.");
  }

  const instruction =
    "첨부한 자료를 분석해 복습 테스트를 만들어줘." +
    (hint ? `\n추가 요청: ${hint}` : "");

  // 자료가 많으면 2분을 넘기므로 스트리밍으로 받아 연결이 끊기지 않게 한다.
  const message = await client.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: { format: jsonSchemaOutputFormat(QUIZ_SCHEMA as any) },
      messages: [
        {
          role: "user",
          content: [...toContentBlocks(assets), { type: "text", text: instruction }],
        },
      ],
    })
    .finalMessage();

  const quiz = message.parsed_output as ReviewQuiz | null;
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error("문제 생성에 실패했습니다. 자료를 다시 확인해 주세요.");
  }
  return quiz;
}

// ── 서술형/단답형 AI 채점 스키마 ───────────────────────────────
const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer", description: "문제 번호(0부터)" },
          score: { type: "number", description: "0.0~1.0 사이 부분점수" },
          isCorrect: { type: "boolean", description: "0.7 이상이면 정답으로 간주" },
          feedback: { type: "string", description: "학생에게 줄 1~2문장 피드백" },
        },
        required: ["index", "score", "isCorrect", "feedback"],
      },
    },
  },
  required: ["results"],
} as const;

export interface AiGradeInput {
  index: number;
  question: string;
  modelAnswer: string;
  studentAnswer: string;
}

export interface AiGradeOutput {
  index: number;
  score: number;
  isCorrect: boolean;
  feedback: string;
}

/** 서술형/주관식 답안을 AI로 채점한다. */
export async function gradeOpenEnded(
  items: AiGradeInput[]
): Promise<AiGradeOutput[]> {
  if (items.length === 0) return [];

  // 번호는 목록 안의 순번으로 매긴다. 실제 문제 번호를 그대로 쓰면
  // 모델이 순번으로 돌려줄 때 엉뚱한 문제에 점수가 붙는다.
  const payload = items
    .map(
      (it, pos) =>
        `문제 ${pos}: ${it.question}\n모범답안: ${it.modelAnswer}\n학생답안: ${
          it.studentAnswer || "(무응답)"
        }`
    )
    .join("\n\n");

  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system:
      "너는 공정한 채점자다. 모범답안과 비교해 학생답안의 핵심 포함 여부로 0~1 부분점수를 매기고, 한국어로 짧고 건설적인 피드백을 준다. 표현이 달라도 의미가 맞으면 인정한다.",
    output_config: { format: jsonSchemaOutputFormat(GRADE_SCHEMA as any) },
    messages: [{ role: "user", content: `다음 답안들을 채점해줘.\n\n${payload}` }],
  });

  const parsed = message.parsed_output as { results: AiGradeOutput[] } | null;
  const results = parsed?.results ?? [];

  // 받은 순번을 실제 문제 번호로 되돌린다. 번호가 어긋나면 응답 순서대로 맞춘다.
  return results.flatMap((r, order) => {
    const source = items[r.index] ?? items[order];
    if (!source) return [];
    return [{ ...r, index: source.index }];
  });
}

export { MODEL };

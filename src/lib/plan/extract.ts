import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { PlanTask, WeekdayKey, WeeklyPlanData } from "@/types";
import type { UploadAsset } from "@/lib/review/anthropic";

const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const client = new Anthropic({ apiKey });

const WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// 요일 1칸 스키마 (7개 요일에 동일 적용)
const DAY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    notes: {
      type: "string",
      description: "요일 상단 Notes/메모 텍스트. 없으면 빈 문자열.",
    },
    tasks: {
      type: "array",
      description: "그 요일의 할 일 목록(위→아래 순서 그대로).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string", description: "할 일 내용(사진 표기 그대로)" },
          done: {
            type: "boolean",
            description: "체크박스가 칠해져(체크되어) 있으면 true, 비어 있으면 false",
          },
        },
        required: ["text", "done"],
      },
    },
  },
  required: ["notes", "tasks"],
} as const;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    weekly_goals: {
      type: "array",
      description: "Weekly Goals 섹션의 목표 목록",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          done: { type: "boolean", description: "체크되어 있으면 true" },
        },
        required: ["text", "done"],
      },
    },
    main_test: {
      type: "array",
      description: "Main Test 섹션의 시험/일정 목록. 각 항목은 문자열.",
      items: { type: "string" },
    },
    days: {
      type: "object",
      additionalProperties: false,
      description: "월~일 요일별 계획",
      properties: {
        mon: DAY_SCHEMA,
        tue: DAY_SCHEMA,
        wed: DAY_SCHEMA,
        thu: DAY_SCHEMA,
        fri: DAY_SCHEMA,
        sat: DAY_SCHEMA,
        sun: DAY_SCHEMA,
      },
      required: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
    summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        achievement: {
          type: "string",
          description: "Summary의 달성률 관련 기록. 없으면 빈 문자열.",
        },
        feedback: {
          type: "string",
          description: "Summary의 피드백 텍스트. 없으면 빈 문자열.",
        },
      },
      required: ["achievement", "feedback"],
    },
  },
  required: ["weekly_goals", "main_test", "days", "summary"],
} as const;

const SYSTEM_PROMPT = `너는 학생의 "주간 계획표" 사진(손글씨/표/스크린샷)을 보고 내용을 그대로 구조화하는 도우미다.

[원칙]
- 사진에 실제로 보이는 내용만 옮긴다. 없는 내용을 지어내지 않는다.
- 각 할 일 항목의 체크박스가 칠해져(체크되어) 있으면 done=true, 비어 있으면 done=false 로 정확히 판별한다.
- 요일은 Monday→mon, Tuesday→tue, … Sunday→sun 으로 정확히 매핑한다. 요일 라벨을 기준으로 배치한다.
- Weekly Goals, Main Test, 요일별 할 일/Notes, Summary(달성률·피드백)를 각각 해당 필드에 넣는다.
- 표기(영어 용어, 숫자, 과목명, 기호 등)는 사진 그대로 유지한다. 줄 단위로 항목을 분리한다.
- 특정 섹션이 비어 있으면 빈 배열 또는 빈 문자열로 둔다.`;

// AI가 반환하는 원시 형태 (id 없음)
type RawTask = { text: string; done: boolean };
type RawDay = { notes: string; tasks: RawTask[] };
type RawPlan = {
  weekly_goals: RawTask[];
  main_test: string[];
  days: Record<WeekdayKey, RawDay>;
  summary: { achievement: string; feedback: string };
};

function withId(t: RawTask): PlanTask {
  return { id: crypto.randomUUID(), text: (t.text || "").trim(), done: !!t.done };
}

function toPlanData(raw: RawPlan): WeeklyPlanData {
  const days = WEEKDAYS.reduce(
    (acc, k) => {
      const d = raw.days?.[k] || { notes: "", tasks: [] };
      acc[k] = {
        notes: d.notes || "",
        tasks: (d.tasks || []).filter((t) => (t.text || "").trim()).map(withId),
      };
      return acc;
    },
    {} as WeeklyPlanData["days"],
  );
  return {
    weekly_goals: (raw.weekly_goals || []).filter((t) => (t.text || "").trim()).map(withId),
    main_test: (raw.main_test || []).map((s) => String(s).trim()).filter(Boolean),
    days,
    summary: {
      achievement: raw.summary?.achievement || "",
      feedback: raw.summary?.feedback || "",
    },
  };
}

function toContentBlocks(assets: UploadAsset[]): any[] {
  return assets.map((a) =>
    a.kind === "pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: a.data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: a.mediaType, data: a.data },
        },
  );
}

/** 주간 계획표 사진(이미지/PDF)에서 계획 데이터를 추출한다. */
export async function extractWeeklyPlan(assets: UploadAsset[]): Promise<WeeklyPlanData> {
  if (assets.length === 0) throw new Error("이미지가 최소 1개 필요합니다.");

  const message = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    // Opus 4.8 adaptive thinking (SDK 타입에 아직 없어 캐스팅)
    thinking: { type: "adaptive" } as any,
    system: SYSTEM_PROMPT,
    output_format: betaJSONSchemaOutputFormat(PLAN_SCHEMA as any),
    messages: [
      {
        role: "user",
        content: [
          ...toContentBlocks(assets),
          { type: "text", text: "이 주간 계획표 사진의 내용을 구조에 맞게 그대로 추출해줘." },
        ],
      },
    ],
  });

  const raw = message.parsed_output as RawPlan | null;
  if (!raw) throw new Error("계획표 인식에 실패했습니다. 사진을 다시 확인해 주세요.");
  return toPlanData(raw);
}

import type { Metadata } from "next";

/**
 * 카카오톡 등에 링크를 붙여넣었을 때 보이는 미리보기(OG) 정보.
 *
 * 기본값만 두면 모든 링크가 "SKY MATE 코칭 대시보드 / 여기를 눌러 링크를 확인하세요"로
 * 똑같이 보여서, 받은 학생이 주간 질문지인지 레포트인지 구분할 수 없었다.
 * 페이지마다 이 함수로 제목·설명을 지정한다.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://monthly-roan.vercel.app";

const OG_IMAGE = { url: "/logo.jpg", width: 200, height: 200, alt: "SKY MATE" };

export function shareMeta(
  title: string,
  description: string,
  opts?: { index?: boolean },
): Metadata {
  return {
    // 템플릿(" · SKY MATE") 없이 지정한 제목 그대로 쓴다, 카톡 카드가 짧아야 읽힌다
    title: { absolute: title },
    description,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: "SKY MATE",
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary", title, description, images: [OG_IMAGE.url] },
    // 학생 개인 링크는 검색엔진에 절대 노출되지 않게 한다
    robots: opts?.index
      ? undefined
      : { index: false, follow: false, nocache: true },
  };
}

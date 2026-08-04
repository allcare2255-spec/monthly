import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKY MATE 코칭 대시보드",
  description: "SKY MATE 1:1 밀착 코칭 멘토 및 레포트 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        {/* 손글씨(필기체) 폰트 — 복습 결과지 응원 문구용 */}
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap"
        />
        {/* Pretendard — 로그인 화면을 '고등 코칭 ERP'와 동일한 폰트로 렌더 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      {/* 브라우저 맞춤법 검사 끄기 — 사전이 영어 기준이라 한국어 입력에 빨간 물결줄이 계속 그어진다.
          spellcheck 는 상속되므로 body 한 곳에서 모든 입력란·에디터에 적용된다. */}
      <body className="min-h-screen antialiased" spellCheck={false}>
        {children}
      </body>
    </html>
  );
}

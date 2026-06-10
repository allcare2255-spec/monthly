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
        {/* 손글씨(필기체) 폰트 — 복습 결과지 응원 문구용 */}
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

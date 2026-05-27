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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

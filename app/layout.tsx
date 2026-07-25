import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한자별곡 — 안개 왕국의 비밀",
  description: "한자의 힘으로 왕국을 되찾는 초등 한자 8급 학습 모험",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

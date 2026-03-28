import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '贪吃蛇游戏',
  description: '一个经典的贪吃蛇游戏，支持多种难度级别',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
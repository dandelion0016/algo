import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'アルゴ（algo）Web - 頭脳派推理カードゲーム',
  description: '算数オリンピック・ピーター・フランクル氏ら開発の頭脳派推理ゲーム「アルゴ（algo）」をWeb上で遊べる対戦システムです。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-zinc-950 text-zinc-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}

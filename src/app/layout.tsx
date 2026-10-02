import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NumLogic（ナムロジック） - 頭脳派数字推理カードゲーム',
  description: '論理的思考で白と黒の数字カードを推理するオンライン対戦ボードゲーム「NumLogic（ナムロジック）」。2〜4人対戦・思考AI搭載。',
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

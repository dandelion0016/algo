import { GameBoard } from '../components/GameBoard';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col justify-between">
      <GameBoard />
      <footer className="py-4 text-center text-xs text-zinc-600 border-t border-zinc-900">
        <p>アルゴ（algo）Web - 開発版 (Phase 0-A: Walking Skeleton)</p>
      </footer>
    </main>
  );
}

import { GameBoard } from '../components/GameBoard';

export default function Home() {
  return (
    <main className="min-h-screen bg-algo-sand flex flex-col justify-between">
      <GameBoard />
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 font-medium">
        <p>アルゴ（algo）Web - 2〜4人対戦 ＆ 思考AI搭載 (Phase 0-A)</p>
      </footer>
    </main>
  );
}

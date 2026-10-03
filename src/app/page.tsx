import { GameBoard } from '../components/GameBoard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getAppVersion } from '../lib/version';

export default function Home() {
  return (
    <ErrorBoundary>
      <main className="min-h-[100dvh] h-[100dvh] lg:h-auto lg:min-h-screen overflow-hidden lg:overflow-visible bg-algo-sand flex flex-col justify-between">
        <GameBoard />
        <footer className="py-1.5 sm:py-2.5 lg:py-4 text-center text-[10px] sm:text-xs text-slate-400 border-t border-slate-200/60 font-medium shrink-0 bg-white/40 lg:bg-transparent backdrop-blur-xs">
          <p>アルゴ（algo）Web {getAppVersion()} - 2〜4人対戦 ＆ 思考AI搭載 (Phase 0-A)</p>
        </footer>
      </main>
    </ErrorBoundary>
  );
}

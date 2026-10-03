import { GameBoard } from '../components/GameBoard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getAppVersion } from '../lib/version';

export default function Home() {
  return (
    <ErrorBoundary>
      <main className="h-[100dvh] max-h-[100dvh] lg:h-auto lg:min-h-screen overflow-hidden lg:overflow-visible bg-algo-sand flex flex-col justify-between">
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-visible overscroll-contain flex flex-col">
          <GameBoard />
        </div>
        <footer className="py-1 sm:py-2 lg:py-3 text-center text-[10px] sm:text-xs text-slate-400 border-t border-slate-200/60 font-medium shrink-0 bg-white/60 lg:bg-transparent backdrop-blur-xs pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <p>アルゴ（algo）Web {getAppVersion()} - 2〜4人対戦 ＆ 思考AI搭載 (Phase 0-A)</p>
        </footer>
      </main>
    </ErrorBoundary>
  );
}

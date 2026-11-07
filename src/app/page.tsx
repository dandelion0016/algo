import { GameBoard } from '../components/GameBoard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { I18nProvider } from '../lib/i18n';

export default function Home() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <main className="h-[100dvh] max-h-[100dvh] lg:h-auto lg:min-h-screen overflow-hidden lg:overflow-visible bg-algo-sand flex flex-col justify-between">
          <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-visible overscroll-contain flex flex-col">
            <GameBoard />
          </div>
        </main>
      </I18nProvider>
    </ErrorBoundary>
  );
}

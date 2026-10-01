'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const CONFETTI_COLORS = [
  '#FCF97A', // algo-yellow
  '#7BA6EF', // algo-blue
  '#F43F5E', // rose
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#06B6D4', // cyan
];

export const ConfettiEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // JSDOM / 非対応ブラウザでのフォールバックガード
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;

    // 画面サイズ設定
    const updateCanvasSize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // パーティクル生成（80個の華やかな紙吹雪片）
    const particleCount = 80;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height, // 上部画面外からスタート
        width: Math.random() * 8 + 6,
        height: Math.random() * 14 + 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        speedX: (Math.random() - 0.5) * 3,
        speedY: Math.random() * 3 + 2.5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        opacity: Math.random() * 0.4 + 0.6,
      });
    }

    const render = () => {
      if (!isRunning || !ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 物理移動と回転
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        // 画面下部に到達したら上部へループ
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        // 3Dひらひら感を演出（cosによる幅のスケーリング）
        const cosScale = Math.cos((p.rotation * Math.PI) / 180);
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width * Math.abs(cosScale), p.height);

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div
      data-testid="confetti-effect"
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

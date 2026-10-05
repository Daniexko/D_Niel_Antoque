import React, { useEffect, useRef } from "react";

export const NetworkLoaderCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.radius = Math.random() * 1.5 + 0.6;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce boundaries
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = "rgba(6, 182, 212, 0.45)";
        c.fill();
      }
    }

    let isPerformanceMode = false;
    try {
      isPerformanceMode = localStorage.getItem("gcr_performance_mode") === "true";
    } catch {}

    const handlePerfChange = (e: Event & { detail?: boolean } | any) => {
      isPerformanceMode = e.detail === true;
    };
    window.addEventListener("gcr_performance_mode_changed", handlePerfChange);

    const particlesCount = Math.min(80, Math.floor((width * height) / 15000));
    const particles: Particle[] = [];
    for (let i = 0; i < particlesCount; i++) {
      particles.push(new Particle());
    }

    const animateParticles = () => {
      ctx.clearRect(0, 0, width, height);

      const activeCount = isPerformanceMode ? Math.min(10, particles.length) : particles.length;

      // Draw subtle connectors (bypassed in performance mode)
      if (!isPerformanceMode) {
        for (let i = 0; i < activeCount; i++) {
          for (let j = i + 1; j < activeCount; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 130) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(6, 182, 212, ${0.12 * (1 - dist / 130)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      // Draw and update particles
      for (let i = 0; i < activeCount; i++) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animateParticles);
    };

    animateParticles();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("gcr_performance_mode_changed", handlePerfChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none opacity-40 z-0" 
      id="loading-constellation-network"
    />
  );
};

// High-Performance Interactive HTML5 Canvas Petroleum / Crude Oil Liquid Simulation
export class PetroleumCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animationFrameId = null;
    this.width = 0;
    this.height = 0;
    this.time = 0;

    // Interactive mouse state
    this.mouse = {
      x: -1000,
      y: -1000,
      vx: 0,
      vy: 0,
      lastX: 0,
      lastY: 0,
      isDown: false
    };

    // Droplets / Bubble particles
    this.particles = [];
    this.maxParticles = 65;

    // Oil wave surface nodes
    this.waveNodes = [];
    this.nodeCount = 70;

    this.init();
  }

  init() {
    this.resize();
    this.initWaveNodes();
    this.initParticles();
    this.bindEvents();
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement || document.body;
    this.width = this.canvas.width = Math.max(parent.clientWidth || 0, window.innerWidth || 1200);
    this.height = this.canvas.height = Math.max(parent.clientHeight || 0, window.innerHeight || 800);
    this.initWaveNodes();
  }

  initWaveNodes() {
    this.waveNodes = [];
    const step = (this.width || window.innerWidth || 1200) / (this.nodeCount - 1);
    const baseHeight = (this.height || window.innerHeight || 800) * 0.68;
    for (let i = 0; i < this.nodeCount; i++) {
      this.waveNodes.push({
        x: i * step,
        y: baseHeight,
        baseY: baseHeight,
        vy: 0,
        targetY: baseHeight
      });
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomY = false) {
    const w = this.width || window.innerWidth || 1200;
    const h = this.height || window.innerHeight || 800;
    return {
      x: Math.random() * w,
      y: randomY ? h * 0.6 + Math.random() * (h * 0.4) : h + Math.random() * 20,
      radius: Math.random() * 4.5 + 1.5,
      speedY: -(Math.random() * 0.8 + 0.3),
      speedX: (Math.random() - 0.5) * 0.4,
      wobbleSpeed: Math.random() * 0.05 + 0.02,
      wobbleDistance: Math.random() * 20 + 5,
      opacity: Math.random() * 0.6 + 0.2,
      hue: Math.random() > 0.4 ? 'gold' : 'petrol'
    };
  }

  bindEvents() {
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);

    this.onMouseMove = (e) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;
      this.mouse.vx = newX - this.mouse.lastX;
      this.mouse.vy = newY - this.mouse.lastY;
      this.mouse.lastX = newX;
      this.mouse.lastY = newY;
      this.mouse.x = newX;
      this.mouse.y = newY;

      // Disturb nearest wave nodes
      this.disturb(this.mouse.x, this.mouse.y, this.mouse.vy * 0.8);
    };

    this.onMouseDown = () => {
      this.mouse.isDown = true;
      this.spawnSplash(this.mouse.x, this.mouse.y);
    };

    this.onMouseUp = () => {
      this.mouse.isDown = false;
    };

    this.onTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const newX = touch.clientX - rect.left;
        const newY = touch.clientY - rect.top;
        this.mouse.x = newX;
        this.mouse.y = newY;
        this.disturb(this.mouse.x, this.mouse.y, -15);
      }
    };

    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
  }

  disturb(x, y, power) {
    const radius = 120;
    const force = Math.max(Math.min(power, 40), -40);
    this.waveNodes.forEach(node => {
      const dx = node.x - x;
      if (Math.abs(dx) < radius) {
        const factor = (1 - Math.abs(dx) / radius);
        node.vy += force * factor * 0.35;
      }
    });
  }

  spawnSplash(x, y) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y,
        radius: Math.random() * 5 + 2,
        speedY: (Math.random() - 0.8) * 3,
        speedX: (Math.random() - 0.5) * 4,
        wobbleSpeed: 0.05,
        wobbleDistance: 10,
        opacity: 0.8,
        hue: 'gold'
      });
    }
  }

  updatePhysics() {
    this.time += 0.03;

    // 1. Spring physics on wave surface nodes
    const tension = 0.035;
    const damping = 0.04;
    const spread = 0.28;

    for (let i = 0; i < this.waveNodes.length; i++) {
      const node = this.waveNodes[i];
      const ambientWave = Math.sin(this.time * 0.8 + i * 0.12) * 14 + Math.cos(this.time * 0.5 + i * 0.06) * 8;
      const target = node.baseY + ambientWave;
      const diff = target - node.y;
      node.vy += diff * tension;
      node.vy *= (1 - damping);
      node.y += node.vy;
    }

    // Wave neighbor propagation passes
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.waveNodes.length; i++) {
        if (i > 0) {
          const leftDiff = spread * (this.waveNodes[i].y - this.waveNodes[i - 1].y);
          this.waveNodes[i - 1].vy += leftDiff;
        }
        if (i < this.waveNodes.length - 1) {
          const rightDiff = spread * (this.waveNodes[i].y - this.waveNodes[i + 1].y);
          this.waveNodes[i + 1].vy += rightDiff;
        }
      }
    }

    // 2. Upward buoyant hydrocarbon bubble particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.speedY;
      p.x += p.speedX + Math.sin(this.time + p.y * 0.02) * 0.4;

      if (p.y < this.height * 0.65) {
        p.opacity -= 0.015;
      }

      if (p.y < this.height * 0.45 || p.opacity <= 0) {
        this.particles.splice(i, 1);
        if (this.particles.length < this.maxParticles) {
          this.particles.push(this.createParticle(false));
        }
      }
    }
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    // Deep Atmospheric Industrial Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#06090E');
    bgGrad.addColorStop(0.5, '#0C121D');
    bgGrad.addColorStop(1, '#111827');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid lines for Oil Refinery Engineering blueprint feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 48;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (this.waveNodes.length === 0) return;

    // Background Layer: Deep Viscous Secondary Wave
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.72);
    for (let i = 0; i < w; i += 20) {
      const y = h * 0.72 + Math.sin(this.time * 0.6 + i * 0.008) * 22 + Math.cos(this.time * 0.4 + i * 0.015) * 12;
      ctx.lineTo(i, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const deepOilGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
    deepOilGrad.addColorStop(0, 'rgba(180, 83, 9, 0.25)'); // Amber-gold shimmer
    deepOilGrad.addColorStop(0.3, 'rgba(17, 24, 39, 0.85)');
    deepOilGrad.addColorStop(1, 'rgba(3, 7, 18, 0.98)');
    ctx.fillStyle = deepOilGrad;
    ctx.fill();

    // Primary Petroleum Wave Body
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(this.waveNodes[0].x, this.waveNodes[0].y);

    // Smooth Bezier Curve through wave nodes
    for (let i = 0; i < this.waveNodes.length - 1; i++) {
      const current = this.waveNodes[i];
      const next = this.waveNodes[i + 1];
      const mx = (current.x + next.x) / 2;
      const my = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, mx, my);
    }
    const last = this.waveNodes[this.waveNodes.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(w, h);
    ctx.closePath();

    const mainOilGrad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    mainOilGrad.addColorStop(0, '#E0291D'); // Oil India Red Highlight crest
    mainOilGrad.addColorStop(0.04, '#F59E0B'); // Golden amber surface tension line
    mainOilGrad.addColorStop(0.12, '#1E232F'); // Heavy crude core
    mainOilGrad.addColorStop(0.4, '#0B0F19');
    mainOilGrad.addColorStop(1, '#020408'); // Pitch black bottom
    ctx.fillStyle = mainOilGrad;
    ctx.fill();

    // Specular Golden Crest Stroke (Iridescent Petroleum sheen)
    ctx.beginPath();
    ctx.moveTo(this.waveNodes[0].x, this.waveNodes[0].y);
    for (let i = 0; i < this.waveNodes.length - 1; i++) {
      const current = this.waveNodes[i];
      const next = this.waveNodes[i + 1];
      const mx = (current.x + next.x) / 2;
      const my = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, mx, my);
    }
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Gloss Highlight Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Render Hydrocarbon Bubbles / Micro-Droplets
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      if (p.hue === 'gold') {
        ctx.fillStyle = `rgba(245, 158, 11, ${p.opacity})`;
      } else {
        ctx.fillStyle = `rgba(224, 41, 29, ${p.opacity * 0.8})`;
      }
      ctx.fill();

      // Mini highlight dot inside droplet
      ctx.beginPath();
      ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.7})`;
      ctx.fill();
    }
  }

  animate() {
    this.updatePhysics();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mouseup', this.onMouseUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('touchmove', this.onTouchMove);
    }
  }
}

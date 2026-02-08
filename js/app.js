// Zigzag Runner - Main Game
class ZigzagRunner {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.W = 400;
        this.H = 700;
        this.tileW = 65;
        this.tileH = 32;

        // game state
        this.screen = 'main';
        this.state = 'idle'; // idle, playing, falling, gameover
        this.score = 0;
        this.coins = 0;
        this.totalCoins = 0;
        this.gameCount = 0;

        // ball
        this.ballX = 0;
        this.ballY = 0;
        this.ballRadius = 10;
        this.ballSpeed = 0.05;
        this.moveProgress = 0;

        // direction: 0 = +x (right), 1 = +y (forward)
        this.direction = 0;
        this.fallVelX = 0;
        this.fallVelY = 0;
        this.fallRotation = 0;

        // path
        this.tiles = [];
        this.coinTiles = new Set();
        this.currentTileIndex = 0;
        this.pathLength = 60;

        // camera
        this.cameraX = 0;
        this.cameraY = 0;
        this.targetCamX = 0;
        this.targetCamY = 0;

        // particles
        this.particles = [];

        // visual
        this.trailPoints = [];
        this.screenShake = 0;

        // stats & progression
        this.stats = {
            maxScore: 0,
            totalGames: 0,
            totalCoins: 0,
            totalDistance: 0
        };
        this.currentTheme = 'classic';
        this.currentSkin = 'default';
        this.unlockedThemes = ['classic'];
        this.unlockedSkins = ['default'];

        // ad timing
        this.reviveUsed = false;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.loadData();
        this.bindEvents();
        this.updateMainUI();
        this.showScreen('main');
        this.loop(0);
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        this.scaleX = (rect.width * dpr) / this.W;
        this.scaleY = (rect.height * dpr) / this.H;
        this.scale = Math.min(this.scaleX, this.scaleY);
        this.offsetX = (rect.width * dpr - this.W * this.scale) / 2;
        this.offsetY = (rect.height * dpr - this.H * this.scale) / 2;

        window.addEventListener('resize', () => {
            const r = container.getBoundingClientRect();
            const d = window.devicePixelRatio || 1;
            this.canvas.width = r.width * d;
            this.canvas.height = r.height * d;
            this.canvas.style.width = r.width + 'px';
            this.canvas.style.height = r.height + 'px';
            this.scaleX = (r.width * d) / this.W;
            this.scaleY = (r.height * d) / this.H;
            this.scale = Math.min(this.scaleX, this.scaleY);
            this.offsetX = (r.width * d - this.W * this.scale) / 2;
            this.offsetY = (r.height * d - this.H * this.scale) / 2;
        });
    }

    loadData() {
        try {
            const d = JSON.parse(localStorage.getItem('zigzagRunner_v1'));
            if (d) {
                this.stats = { ...this.stats, ...d.stats };
                this.currentTheme = d.theme || 'classic';
                this.currentSkin = d.skin || 'default';
                this.unlockedThemes = d.unlockedThemes || ['classic'];
                this.unlockedSkins = d.unlockedSkins || ['default'];
            }
        } catch (e) {}
    }

    saveData() {
        localStorage.setItem('zigzagRunner_v1', JSON.stringify({
            stats: this.stats,
            theme: this.currentTheme,
            skin: this.currentSkin,
            unlockedThemes: this.unlockedThemes,
            unlockedSkins: this.unlockedSkins
        }));
    }

    getTheme() {
        return THEMES_DATA.find(t => t.id === this.currentTheme) || THEMES_DATA[0];
    }

    getSkin() {
        return SKINS_DATA.find(s => s.id === this.currentSkin) || SKINS_DATA[0];
    }

    getTitle(score) {
        let title = TITLES_DATA[0];
        for (const t of TITLES_DATA) {
            if (score >= t.score) title = t;
        }
        return title;
    }

    // --- Path Generation ---
    generatePath() {
        this.tiles = [];
        this.coinTiles = new Set();
        let x = 0, y = 0;
        this.tiles.push({ x, y });

        // first 3 tiles go right (safe start)
        for (let i = 1; i <= 3; i++) {
            x++;
            this.tiles.push({ x, y });
        }

        // rest is random
        for (let i = 4; i < this.pathLength; i++) {
            if (Math.random() < 0.5) {
                x++;
            } else {
                y++;
            }
            this.tiles.push({ x, y });
            if (Math.random() < 0.3 && i > 5) {
                this.coinTiles.add(i);
            }
        }
    }

    extendPath(count) {
        const last = this.tiles[this.tiles.length - 1];
        let x = last.x, y = last.y;
        for (let i = 0; i < count; i++) {
            if (Math.random() < 0.5) {
                x++;
            } else {
                y++;
            }
            this.tiles.push({ x, y });
            const idx = this.tiles.length - 1;
            if (Math.random() < 0.3) {
                this.coinTiles.add(idx);
            }
        }
    }

    toIso(gx, gy) {
        const sx = (gx - gy) * (this.tileW / 2);
        const sy = (gx + gy) * (this.tileH / 2);
        return { x: this.W / 2 + sx, y: 180 + sy };
    }

    // --- Events ---
    bindEvents() {
        const tap = (e) => {
            e.preventDefault();
            if (this.screen !== 'game') return;
            if (this.state === 'idle') {
                this.startGame();
            } else if (this.state === 'playing') {
                this.changeDirection();
            }
        };

        this.canvas.addEventListener('pointerdown', tap);

        // UI buttons
        document.getElementById('btnPlay')?.addEventListener('click', () => {
            this.showScreen('game');
            this.resetGame();
        });
        document.getElementById('btnTheme')?.addEventListener('click', () => {
            this.showScreen('theme');
            this.renderThemeList();
        });
        document.getElementById('btnSkin')?.addEventListener('click', () => {
            this.showScreen('skin');
            this.renderSkinList();
        });
        document.getElementById('btnStats')?.addEventListener('click', () => {
            this.showScreen('stats');
            this.renderStats();
        });
        document.getElementById('btnBack')?.addEventListener('click', () => {
            this.showScreen('main');
            this.updateMainUI();
        });
        document.getElementById('btnBackSkin')?.addEventListener('click', () => {
            this.showScreen('main');
            this.updateMainUI();
        });
        document.getElementById('btnBackStats')?.addEventListener('click', () => {
            this.showScreen('main');
            this.updateMainUI();
        });
        document.getElementById('btnReplay')?.addEventListener('click', () => {
            this.showScreen('game');
            this.resetGame();
        });
        document.getElementById('btnHome')?.addEventListener('click', () => {
            this.showScreen('main');
            this.updateMainUI();
        });
        document.getElementById('btnShare')?.addEventListener('click', () => this.shareResult());
        document.getElementById('btnRevive')?.addEventListener('click', () => this.revive());
    }

    showScreen(name) {
        this.screen = name;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(`screen-${name}`);
        if (el) el.classList.add('active');
    }

    // --- Game Logic ---
    resetGame() {
        this.state = 'idle';
        this.score = 0;
        this.coins = 0;
        this.currentTileIndex = 0;
        this.direction = 0;
        this.moveProgress = 0;
        this.ballSpeed = 0.05;
        this.particles = [];
        this.trailPoints = [];
        this.reviveUsed = false;
        this.screenShake = 0;
        this.fallVelX = 0;
        this.fallVelY = 0;
        this.fallRotation = 0;
        this.generatePath();

        const start = this.toIso(0, 0);
        this.ballX = start.x;
        this.ballY = start.y;
        this.targetCamX = start.x - this.W / 2;
        this.targetCamY = start.y - 300;
        this.cameraX = this.targetCamX;
        this.cameraY = this.targetCamY;

        document.getElementById('hud').style.display = 'flex';
        document.getElementById('screen-gameover').classList.remove('active');
        document.getElementById('tapHint').style.display = 'block';
        this.updateHUD();
    }

    startGame() {
        this.state = 'playing';
        document.getElementById('tapHint').style.display = 'none';
    }

    changeDirection() {
        this.direction = this.direction === 0 ? 1 : 0;
    }

    update(dt) {
        if (this.screen !== 'game') return;

        // particles update
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= p.decay;
            return p.life > 0;
        });

        // trail
        if (this.state === 'playing') {
            this.trailPoints.push({ x: this.ballX, y: this.ballY, life: 1 });
            if (this.trailPoints.length > 15) this.trailPoints.shift();
        }
        this.trailPoints = this.trailPoints.filter(t => {
            t.life -= 0.06;
            return t.life > 0;
        });

        if (this.screenShake > 0) this.screenShake *= 0.9;

        if (this.state === 'playing') {
            this.moveProgress += this.ballSpeed * (dt / 16);

            // clamp so we never skip the direction check
            if (this.moveProgress > 1) this.moveProgress = 1;

            const cur = this.tiles[this.currentTileIndex];
            const next = this.tiles[this.currentTileIndex + 1];

            if (!cur || !next) {
                this.triggerFall();
                return;
            }

            // which direction does the PATH go?
            const pathDir = next.x > cur.x ? 0 : 1;
            const isoC = this.toIso(cur.x, cur.y);

            if (this.direction === pathDir) {
                // correct direction - interpolate toward next tile
                const isoN = this.toIso(next.x, next.y);
                this.ballX = isoC.x + (isoN.x - isoC.x) * this.moveProgress;
                this.ballY = isoC.y + (isoN.y - isoC.y) * this.moveProgress;

                // reached next tile
                if (this.moveProgress >= 1) {
                    this.moveProgress = 0;
                    this.currentTileIndex++;
                    this.score++;

                    // collect coins
                    if (this.coinTiles.has(this.currentTileIndex)) {
                        this.coins++;
                        this.totalCoins++;
                        this.score += 5;
                        this.coinTiles.delete(this.currentTileIndex);
                        this.spawnParticles(this.ballX, this.ballY - 12, this.getTheme().coinColor, 8);
                    }

                    // speed up every 15 points
                    if (this.score % 15 === 0) {
                        this.ballSpeed = Math.min(0.14, this.ballSpeed + 0.004);
                    }

                    // extend path
                    if (this.currentTileIndex > this.tiles.length - 25) {
                        this.extendPath(30);
                    }

                    this.updateHUD();
                }
            } else {
                // wrong direction - ball goes off the path
                const wrongNext = this.direction === 0
                    ? { x: cur.x + 1, y: cur.y }
                    : { x: cur.x, y: cur.y + 1 };
                const isoW = this.toIso(wrongNext.x, wrongNext.y);
                this.ballX = isoC.x + (isoW.x - isoC.x) * this.moveProgress;
                this.ballY = isoC.y + (isoW.y - isoC.y) * this.moveProgress;

                // fall off after going too far in wrong direction
                if (this.moveProgress >= 0.55) {
                    this.triggerFall();
                    return;
                }
            }

            // camera follow
            this.targetCamX = this.ballX - this.W / 2;
            this.targetCamY = this.ballY - 300;
            this.cameraX += (this.targetCamX - this.cameraX) * 0.08;
            this.cameraY += (this.targetCamY - this.cameraY) * 0.08;

        } else if (this.state === 'falling') {
            this.fallVelY += 0.4;
            this.ballX += this.fallVelX;
            this.ballY += this.fallVelY;
            this.fallRotation += 0.15;

            if (this.ballY > this.cameraY + this.H + 100) {
                this.triggerGameOver();
            }
        }
    }

    triggerFall() {
        this.state = 'falling';
        this.fallVelX = this.direction === 0 ? 2 : -2;
        this.fallVelY = -3;
        this.screenShake = 10;
        this.spawnParticles(this.ballX, this.ballY, '#ff4444', 12);
    }

    triggerGameOver() {
        this.state = 'gameover';
        this.gameCount++;
        document.getElementById('hud').style.display = 'none';

        if (this.score > this.stats.maxScore) this.stats.maxScore = this.score;
        this.stats.totalGames++;
        this.stats.totalCoins += this.coins;
        this.stats.totalDistance += this.score;

        this.checkUnlocks();
        this.saveData();

        const title = this.getTitle(this.score);
        document.getElementById('goScore').textContent = this.score;
        document.getElementById('goCoins').textContent = this.coins;
        document.getElementById('goBest').textContent = this.stats.maxScore;
        document.getElementById('goTitle').textContent = `${title.emoji} ${title.name}`;

        const reviveBtn = document.getElementById('btnRevive');
        if (reviveBtn) reviveBtn.style.display = this.reviveUsed ? 'none' : 'flex';

        if (this.gameCount % 3 === 0) {
            this.showInterstitialAd(() => {
                document.getElementById('screen-gameover').classList.add('active');
            });
        } else {
            document.getElementById('screen-gameover').classList.add('active');
        }
    }

    revive() {
        if (this.reviveUsed) return;
        this.showInterstitialAd(() => {
            this.reviveUsed = true;
            this.state = 'playing';
            this.moveProgress = 0;
            this.fallVelX = 0;
            this.fallVelY = 0;
            this.fallRotation = 0;

            // align direction to path
            const cur = this.tiles[this.currentTileIndex];
            const next = this.tiles[this.currentTileIndex + 1];
            if (cur && next) {
                this.direction = next.x > cur.x ? 0 : 1;
                const iso = this.toIso(cur.x, cur.y);
                this.ballX = iso.x;
                this.ballY = iso.y;
            }

            document.getElementById('screen-gameover').classList.remove('active');
            document.getElementById('hud').style.display = 'flex';
            const reviveBtn = document.getElementById('btnRevive');
            if (reviveBtn) reviveBtn.style.display = 'none';
        });
    }

    checkUnlocks() {
        for (const t of THEMES_DATA) {
            if (!this.unlockedThemes.includes(t.id)) {
                if (t.unlockCondition === 'score' && this.stats.maxScore >= t.unlockValue) {
                    this.unlockedThemes.push(t.id);
                }
            }
        }
        for (const s of SKINS_DATA) {
            if (!this.unlockedSkins.includes(s.id)) {
                if (s.unlockCondition === 'score' && this.stats.maxScore >= s.unlockValue) {
                    this.unlockedSkins.push(s.id);
                }
            }
        }
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 2,
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                color,
                size: 2 + Math.random() * 4
            });
        }
    }

    // --- Rendering ---
    render() {
        const ctx = this.ctx;
        const theme = this.getTheme();
        const skin = this.getSkin();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // background
        const bg = ctx.createLinearGradient(0, 0, 0, this.H);
        bg.addColorStop(0, theme.bgGradient[0]);
        bg.addColorStop(1, theme.bgGradient[1]);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.W, this.H);

        if (this.screen !== 'game') return;

        ctx.save();
        const shakeX = this.screenShake > 0.5 ? (Math.random() - 0.5) * this.screenShake : 0;
        const shakeY = this.screenShake > 0.5 ? (Math.random() - 0.5) * this.screenShake : 0;
        ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

        // draw tiles
        const startIdx = Math.max(0, this.currentTileIndex - 3);
        const endIdx = Math.min(this.tiles.length, this.currentTileIndex + 30);

        for (let i = startIdx; i < endIdx; i++) {
            const tile = this.tiles[i];
            const iso = this.toIso(tile.x, tile.y);
            this.drawTile(ctx, iso.x, iso.y, theme, i < this.currentTileIndex);
        }

        // draw coins
        for (let i = startIdx; i < endIdx; i++) {
            if (this.coinTiles.has(i)) {
                const tile = this.tiles[i];
                const iso = this.toIso(tile.x, tile.y);
                this.drawCoin(ctx, iso.x, iso.y - 18, theme);
            }
        }

        // draw trail
        for (const t of this.trailPoints) {
            const ballColor = skin.color === 'rainbow'
                ? `hsl(${Date.now() / 10 % 360}, 80%, 60%)`
                : (skin.color || theme.ballColor);
            ctx.globalAlpha = t.life * 0.3;
            ctx.fillStyle = ballColor;
            ctx.beginPath();
            ctx.arc(t.x, t.y - 12, this.ballRadius * t.life * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // draw ball
        this.drawBall(ctx, this.ballX, this.ballY - 12, theme, skin);

        // draw particles
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.restore();
    }

    drawTile(ctx, x, y, theme, passed) {
        const tw = this.tileW;
        const th = this.tileH;

        ctx.globalAlpha = passed ? 0.35 : 1;

        // top face
        ctx.fillStyle = theme.tileHighlight;
        ctx.beginPath();
        ctx.moveTo(x, y - th / 2);
        ctx.lineTo(x + tw / 2, y);
        ctx.lineTo(x, y + th / 2);
        ctx.lineTo(x - tw / 2, y);
        ctx.closePath();
        ctx.fill();

        // left face
        ctx.fillStyle = theme.tileShadow;
        ctx.beginPath();
        ctx.moveTo(x - tw / 2, y);
        ctx.lineTo(x, y + th / 2);
        ctx.lineTo(x, y + th / 2 + 10);
        ctx.lineTo(x - tw / 2, y + 10);
        ctx.closePath();
        ctx.fill();

        // right face
        ctx.fillStyle = theme.tileColor;
        ctx.beginPath();
        ctx.moveTo(x + tw / 2, y);
        ctx.lineTo(x, y + th / 2);
        ctx.lineTo(x, y + th / 2 + 10);
        ctx.lineTo(x + tw / 2, y + 10);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    drawCoin(ctx, x, y, theme) {
        const t = Date.now() / 500;
        const bounce = Math.sin(t) * 3;
        ctx.fillStyle = theme.coinColor;
        ctx.shadowColor = theme.coinColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y + bounce, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(x - 2, y + bounce - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    drawBall(ctx, x, y, theme, skin) {
        const r = this.ballRadius;
        let color = skin.color || theme.ballColor;
        if (color === 'rainbow') {
            color = `hsl(${Date.now() / 5 % 360}, 80%, 60%)`;
        }

        ctx.save();
        if (this.state === 'falling') {
            ctx.translate(x, y);
            ctx.rotate(this.fallRotation);
            ctx.translate(-x, -y);
        }

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + r + 6, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // ball body
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        grad.addColorStop(0, this.lightenColor(color, 50));
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // highlight
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    lightenColor(hex, amt) {
        if (hex.startsWith('hsl')) return hex;
        let c = hex.replace('#', '');
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        let r = parseInt(c.substring(0, 2), 16);
        let g = parseInt(c.substring(2, 4), 16);
        let b = parseInt(c.substring(4, 6), 16);
        r = Math.min(255, r + amt);
        g = Math.min(255, g + amt);
        b = Math.min(255, b + amt);
        return `rgb(${r},${g},${b})`;
    }

    // --- UI ---
    updateHUD() {
        const el = document.getElementById('hudScore');
        if (el) el.textContent = this.score;
        const ce = document.getElementById('hudCoins');
        if (ce) ce.textContent = this.coins;
    }

    updateMainUI() {
        const title = this.getTitle(this.stats.maxScore);
        const bestEl = document.getElementById('mainBest');
        if (bestEl) bestEl.textContent = `최고 ${this.stats.maxScore}점`;
        const titleEl = document.getElementById('mainTitle');
        if (titleEl) titleEl.textContent = `${title.emoji} ${title.name}`;
    }

    renderThemeList() {
        const list = document.getElementById('themeList');
        if (!list) return;
        list.innerHTML = '';

        for (const t of THEMES_DATA) {
            const unlocked = this.unlockedThemes.includes(t.id);
            const active = this.currentTheme === t.id;
            const div = document.createElement('div');
            div.className = `item-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`;
            div.innerHTML = `
                <span class="item-emoji">${t.emoji}</span>
                <span class="item-name">${t.name}</span>
                <span class="item-desc">${unlocked ? (active ? '사용 중' : '선택') : t.description}</span>
            `;
            if (unlocked) {
                div.addEventListener('click', () => {
                    this.currentTheme = t.id;
                    this.saveData();
                    this.renderThemeList();
                });
            }
            list.appendChild(div);
        }
    }

    renderSkinList() {
        const list = document.getElementById('skinList');
        if (!list) return;
        list.innerHTML = '';

        for (const s of SKINS_DATA) {
            const unlocked = this.unlockedSkins.includes(s.id);
            const active = this.currentSkin === s.id;
            const desc = unlocked
                ? (active ? '사용 중' : '선택')
                : `${s.unlockValue}점 달성 시 해금`;
            const div = document.createElement('div');
            div.className = `item-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`;
            div.innerHTML = `
                <span class="item-emoji">${s.emoji}</span>
                <span class="item-name">${s.name}</span>
                <span class="item-desc">${desc}</span>
            `;
            if (unlocked) {
                div.addEventListener('click', () => {
                    this.currentSkin = s.id;
                    this.saveData();
                    this.renderSkinList();
                });
            }
            list.appendChild(div);
        }
    }

    renderStats() {
        const el = document.getElementById('statsContent');
        if (!el) return;
        const title = this.getTitle(this.stats.maxScore);
        el.innerHTML = `
            <div class="stat-row"><span>최고 점수</span><span>${this.stats.maxScore}</span></div>
            <div class="stat-row"><span>현재 칭호</span><span>${title.emoji} ${title.name}</span></div>
            <div class="stat-row"><span>총 게임 수</span><span>${this.stats.totalGames}</span></div>
            <div class="stat-row"><span>총 이동 거리</span><span>${this.stats.totalDistance}</span></div>
            <div class="stat-row"><span>총 코인</span><span>${this.stats.totalCoins}</span></div>
            <div class="stat-row"><span>해금 테마</span><span>${this.unlockedThemes.length}/${THEMES_DATA.length}</span></div>
            <div class="stat-row"><span>해금 스킨</span><span>${this.unlockedSkins.length}/${SKINS_DATA.length}</span></div>
        `;
    }

    // --- Share ---
    shareResult() {
        const title = this.getTitle(this.score);
        const text = `${title.emoji} Zigzag Runner\n점수: ${this.score} | 코인: ${this.coins}\n칭호: ${title.name}\n\n나의 지그재그 실력을 확인해보세요!`;
        const url = 'https://dopabrain.com/zigzag-runner/';

        if (navigator.share) {
            navigator.share({ title: 'Zigzag Runner', text, url }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text + '\n' + url).then(() => {
                const btn = document.getElementById('btnShare');
                if (btn) {
                    const orig = btn.textContent;
                    btn.textContent = '복사됨!';
                    setTimeout(() => btn.textContent = orig, 1500);
                }
            }).catch(() => {});
        }
    }

    // --- Ads ---
    showInterstitialAd(callback) {
        const overlay = document.getElementById('adOverlay');
        if (!overlay) { callback(); return; }
        overlay.style.display = 'flex';
        let sec = 5;
        const countEl = document.getElementById('adCountdown');
        if (countEl) countEl.textContent = sec;
        const timer = setInterval(() => {
            sec--;
            if (countEl) countEl.textContent = sec;
            if (sec <= 0) {
                clearInterval(timer);
                overlay.style.display = 'none';
                callback();
            }
        }, 1000);
    }

    // --- Game Loop ---
    loop(ts) {
        const dt = Math.min(32, ts - (this._lastTs || ts));
        this._lastTs = ts;
        this.update(dt || 16);
        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
    new ZigzagRunner();
});

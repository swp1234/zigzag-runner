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
        this.ballRadius = 16;
        this.ballSpeed = 0.035;
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
        this.bgParticles = [];

        // visual
        this.trailPoints = [];
        this.screenShake = 0;
        this.screenFlash = 0;

        // dopamine enhancements
        this.currentCombo = 0;
        this.lastCoinScore = 0;
        this.consecutiveTiles = 0; // Track consecutive tiles for combo bonus
        this.currentStage = 1;
        this.lastStageShowTime = 0;

        // stats & progression
        this.stats = {
            maxScore: 0,
            totalGames: 0,
            totalCoins: 0,
            totalDistance: 0,
            maxBossesDefeated: 0
        };
        this.currentTheme = 'classic';
        this.currentSkin = 'default';
        this.unlockedThemes = ['classic'];
        this.unlockedSkins = ['default'];

        // ad timing
        this.reviveUsed = false;

        // boss system
        this.isBossPhase = false;
        this.bossStartScore = 0;
        this.bossesDefeated = 0;
        this.bossTier = 1; // 1st boss = 1.3x, 2nd = 1.5x, 3rd = 1.7x, 4th+ = 2x

        // Leaderboard system
        this.leaderboard = new LeaderboardManager('zigzag-runner', 10);
        this.bossWarningStartTime = 0;
        this.bossPhaseEndScore = 0;

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
                if (!this.stats.maxBossesDefeated) this.stats.maxBossesDefeated = 0;
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
        let lastDir = 0; // track last direction for consecutive limit
        this.tiles.push({ x, y });

        // first 5 tiles go right (safe start - gives player time to understand)
        for (let i = 1; i <= 5; i++) {
            x++;
            this.tiles.push({ x, y });
        }

        // rest is random, but early tiles have less zigzag
        for (let i = 6; i < this.pathLength; i++) {
            // Early game: bias toward keeping same direction (fewer turns)
            // Later: pure random (50/50)
            const turnChance = i < 20 ? 0.3 : 0.5;
            let dir;
            if (Math.random() < turnChance) {
                dir = 1 - lastDir; // switch direction
            } else {
                dir = lastDir; // keep same direction
            }
            if (dir === 0) {
                x++;
            } else {
                y++;
            }
            lastDir = dir;
            this.tiles.push({ x, y });
            if (Math.random() < 0.3 && i > 8) {
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
        this.ballSpeed = 0.035;
        this.particles = [];
        this.trailPoints = [];
        this.reviveUsed = false;
        this.screenShake = 0;
        this.screenFlash = 0;
        this.fallVelX = 0;
        this.fallVelY = 0;
        this.fallRotation = 0;
        this.currentCombo = 0; // Reset combo at game start
        this.consecutiveTiles = 0; // Reset consecutive tiles
        this.currentStage = 1;
        this.lastStageShowTime = 0;
        this.isBossPhase = false;
        this.bossStartScore = 0;
        this.bossesDefeated = 0;
        this.bossTier = 1;
        this.bossWarningStartTime = 0;
        this.bossPhaseEndScore = 0;
        this.initBgParticles();
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
        const newDir = this.direction === 0 ? 1 : 0;
        this.direction = newDir;
        if (window.sfx) window.sfx.click();

        // Early turn forgiveness: if ball is visually close to next tile
        // and new direction matches the UPCOMING path segment, snap forward
        if (this.state === 'playing' && this.moveProgress >= 0.5) {
            const cur = this.tiles[this.currentTileIndex];
            const next = this.tiles[this.currentTileIndex + 1];
            const nextNext = this.tiles[this.currentTileIndex + 2];
            if (cur && next && nextNext) {
                const curPathDir = next.x > cur.x ? 0 : 1;
                const nextPathDir = nextNext.x > next.x ? 0 : 1;
                if (newDir !== curPathDir && newDir === nextPathDir) {
                    this.advanceTile();
                }
            }
        }
    }

    advanceTile() {
        const next = this.tiles[this.currentTileIndex + 1];
        if (!next) return;
        const iso = this.toIso(next.x, next.y);
        this.ballX = iso.x;
        this.ballY = iso.y;
        this.currentTileIndex++;
        this.moveProgress = 0;

        // IMPROVED: Tile passing now gives +3 points (was +1)
        this.score += 3;
        this.consecutiveTiles++;

        // Check for boss defeat during boss phase
        if (this.isBossPhase && this.score >= this.bossPhaseEndScore) {
            this.defeatedBoss();
            return;
        }

        if (this.coinTiles.has(this.currentTileIndex)) {
            this.coins++;
            this.totalCoins++;
            // IMPROVED: Coin collection now gives +15 points (was +5)
            this.score += 15;
            this.currentCombo++;
            this.lastCoinScore = 15;
            this.coinTiles.delete(this.currentTileIndex);
            if (window.sfx) window.sfx.coin();
            this.spawnParticles(this.ballX, this.ballY - 12, this.getTheme().coinColor, 8);

            // Dopamine effects on coin
            this.spawnCoinPopup(this.ballX, this.ballY);

            // NEW: 5-tile consecutive bonus
            if (this.consecutiveTiles === 5) {
                this.score += 30;
                this.triggerScreenShake(200);
                this.spawnConfetti(this.ballX, this.ballY, 10);
                this.showComboIndicator(this.ballX, this.ballY, i18n.t('boss.tileBonus5'));
                this.consecutiveTiles = 0;
            }

            // NEW: 10-tile consecutive bonus
            if (this.consecutiveTiles === 10) {
                this.score += 80;
                this.triggerScreenShake(300);
                this.spawnConfetti(this.ballX, this.ballY, 16);
                this.showComboIndicator(this.ballX, this.ballY, i18n.t('boss.tileBonus10'));
                this.consecutiveTiles = 0;
            }

            // Combo bonus every 5 coins (unchanged)
            if (this.currentCombo % 5 === 0 && this.currentCombo > 0) {
                this.score += this.currentCombo;
                this.triggerScreenShake(250);
                this.spawnConfetti(this.ballX, this.ballY, 12);
                this.showComboIndicator(this.ballX, this.ballY, `${i18n.t('boss.coinBonus')} x${this.currentCombo} +${this.currentCombo}`);
            }

            // Milestone every 20 coins
            if (Math.floor(this.coins / 20) > Math.floor((this.coins - 1) / 20)) {
                const milestone = Math.floor(this.coins / 20) * 20;
                this.showMilestoneBanner(`${i18n.t('boss.coins')} ${milestone}`);
                this.triggerScreenFlash('flash-success', 150);
            }
        }

        // NEW: Stage progression
        this.updateStage();

        // Check for boss phase entry
        this.checkBossEntry();

        if (this.currentTileIndex > this.tiles.length - 25) {
            this.extendPath(30);
        }
        this.updateHUD();
    }

    checkBossEntry() {
        // Boss appears every 50 points (50, 100, 150, 200, ...)
        const targetScore = Math.ceil(this.score / 50) * 50;
        if (!this.isBossPhase && this.score === targetScore && targetScore > 0) {
            this.startBossPhase(targetScore);
        }
    }

    startBossPhase(triggerScore) {
        this.isBossPhase = true;
        this.bossStartScore = triggerScore;
        this.bossPhaseEndScore = triggerScore + 15; // Boss phase lasts about 15 points
        this.bossesDefeated++;
        this.bossTier = Math.min(4, this.bossesDefeated); // Cap at tier 4 (2x speed)
        this.bossWarningStartTime = Date.now();

        // Show boss warning
        this.showBossWarning();
        if (window.sfx) window.sfx.explosion();
    }

    defeatedBoss() {
        this.isBossPhase = false;
        this.score += 20; // Boss defeat bonus
        if (this.bossesDefeated > this.stats.maxBossesDefeated) {
            this.stats.maxBossesDefeated = this.bossesDefeated;
        }

        // Boss defeated effects
        this.triggerScreenShake(500);
        this.triggerScreenFlash('flash-success', 300);
        this.spawnConfetti(this.ballX, this.ballY, 24);

        // Show victory message
        this.showBossDefeatedBanner();
        if (window.sfx) window.sfx.coin();
        if (window.sfx) window.sfx.coin();

        this.updateHUD();
    }

    update(dt) {
        if (this.screen !== 'game') return;

        // background particles update
        this.updateBgParticles();

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
        if (this.screenFlash > 0) this.screenFlash *= 0.85;

        if (this.state === 'playing') {
            // IMPROVED: Continuous gradual speed increase based on score
            // Stage 1 (0-100): 0.035
            // Stage 2 (100-300): 0.035 → 0.055 (20% increase)
            // Stage 3 (300-600): 0.055 → 0.075 (40% increase)
            // Stage 4 (600+): 0.075 → 0.15 (capped, was uncapped)
            let speed = 0.035;
            if (this.score < 100) {
                speed = 0.035;
            } else if (this.score < 300) {
                speed = 0.035 + (0.020) * ((this.score - 100) / 200);
            } else if (this.score < 600) {
                speed = 0.055 + (0.020) * ((this.score - 300) / 300);
            } else {
                speed = Math.min(0.15, 0.075 + (0.00005) * (this.score - 600));  // IMPROVED: Cap at 0.15
            }

            // Apply boss speed multiplier
            if (this.isBossPhase) {
                const bossDifficulty = [1.3, 1.5, 1.7, 2.0];
                const multiplier = bossDifficulty[Math.min(3, this.bossTier - 1)] || 2.0;
                speed *= multiplier;
            }

            this.ballSpeed = speed;
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
                    // IMPROVED: Tile passing now gives +3 points (was +1)
                    this.score += 3;
                    this.consecutiveTiles++;

                    // collect coins
                    // Check for boss defeat during boss phase
                    if (this.isBossPhase && this.score >= this.bossPhaseEndScore) {
                        this.defeatedBoss();
                    }

                    if (this.coinTiles.has(this.currentTileIndex)) {
                        this.coins++;
                        this.totalCoins++;
                        // IMPROVED: Coin collection now gives +15 points (was +5)
                        this.score += 15;
                        this.coinTiles.delete(this.currentTileIndex);
                        if (window.sfx) window.sfx.coin();
                        this.spawnParticles(this.ballX, this.ballY - 12, this.getTheme().coinColor, 8);

                        // NEW: 5-tile consecutive bonus (in update path)
                        if (this.consecutiveTiles === 5) {
                            this.score += 30;
                            this.consecutiveTiles = 0;
                        }
                        // NEW: 10-tile consecutive bonus (in update path)
                        if (this.consecutiveTiles === 10) {
                            this.score += 80;
                            this.consecutiveTiles = 0;
                        }
                    }

                    // NEW: Stage progression
                    this.updateStage();

                    // Check for boss entry
                    this.checkBossEntry();

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
                if (this.moveProgress >= 0.80) {
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
        this.screenShake = 15;
        if (window.sfx) window.sfx.explosion();
        this.spawnParticles(this.ballX, this.ballY, '#ff4444', 20);
        // Brief screen flash for death effect
        this.screenFlash = 0.3;
    }

    triggerGameOver() {
        this.state = 'gameover';
        this.gameCount++;
        document.getElementById('hud').style.display = 'none';

        // Dopamine effects on game over
        this.triggerScreenShake(500);
        this.triggerScreenFlash('flash-danger', 300);
        this.currentCombo = 0; // Reset combo on game over

        if (this.score > this.stats.maxScore) this.stats.maxScore = this.score;
        this.stats.totalGames++;
        this.stats.totalCoins += this.coins;
        this.stats.totalDistance += this.score;

        // Add score to leaderboard
        const leaderboardResult = this.leaderboard.addScore(this.score, {
            coins: this.coins,
            bossesDefeated: this.bossesDefeated
        });

        this.checkUnlocks();
        this.saveData();

        const title = this.getTitle(this.score);
        document.getElementById('goScore').textContent = this.score;
        document.getElementById('goCoins').textContent = this.coins;
        const goBestEl = document.getElementById('goBest');
        if (goBestEl) {
            const format = i18n.t('gameover.best');
            goBestEl.textContent = format.includes('0') ? format.replace('0', this.stats.maxScore) : `${this.stats.maxScore} ${format}`;
        }
        document.getElementById('goTitle').textContent = `${title.emoji} ${title.name}`;

        const reviveBtn = document.getElementById('btnRevive');
        if (reviveBtn) reviveBtn.style.display = this.reviveUsed ? 'none' : 'flex';

        // Display leaderboard
        this.displayGameOverLeaderboard(leaderboardResult);

        if (this.gameCount % 3 === 0) {
            this.showInterstitialAd(() => {
                document.getElementById('screen-gameover').classList.add('active');
            });
        } else {
            document.getElementById('screen-gameover').classList.add('active');
        }
    }

    displayGameOverLeaderboard(leaderboardResult) {
        const gameoverScreen = document.getElementById('screen-gameover');
        let leaderboardContainer = gameoverScreen.querySelector('.leaderboard-section');
        if (!leaderboardContainer) {
            leaderboardContainer = document.createElement('div');
            leaderboardContainer.className = 'leaderboard-section';
            gameoverScreen.appendChild(leaderboardContainer);
        }

        const topScores = this.leaderboard.getTopScores(5);
        let html = '<div class="leaderboard-title">🏆 Top 5 Scores</div>';
        html += '<div class="leaderboard-list">';

        topScores.forEach((entry, index) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const isCurrentScore = entry.score === this.score && leaderboardResult.isNewRecord;
            const classes = isCurrentScore ? 'leaderboard-item highlight' : 'leaderboard-item';

            html += `
                <div class="${classes}">
                    <span class="medal">${medals[index] || (index + 1) + '.'}</span>
                    <span class="score-value">${entry.score}</span>
                    <span class="score-date">${entry.date}</span>
                </div>
            `;
        });

        html += '</div>';
        leaderboardContainer.innerHTML = html;
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

    initBgParticles() {
        const theme = this.getTheme();
        if (!theme.particles) return;

        this.bgParticles = [];
        const p = theme.particles;
        for (let i = 0; i < p.count; i++) {
            const color = Array.isArray(p.colors)
                ? p.colors[Math.floor(Math.random() * p.colors.length)]
                : p.color;
            this.bgParticles.push({
                x: Math.random() * this.W,
                y: Math.random() * this.H,
                vx: (Math.random() - 0.5) * p.speed,
                vy: (Math.random() - 0.5) * p.speed,
                color: color,
                size: p.sizeMin + Math.random() * (p.sizeMax - p.sizeMin),
                type: p.type,
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    updateBgParticles() {
        const theme = this.getTheme();
        if (!theme.particles) return;

        const p = theme.particles;
        for (let i = 0; i < this.bgParticles.length; i++) {
            const particle = this.bgParticles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.rotation += 0.02;

            // Wrap around screen
            if (particle.x < -10) particle.x = this.W + 10;
            if (particle.x > this.W + 10) particle.x = -10;
            if (particle.y < -10) particle.y = this.H + 10;
            if (particle.y > this.H + 10) particle.y = -10;
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

        // background with score-based color progression
        let bgColor0 = theme.bgGradient[0];
        let bgColor1 = theme.bgGradient[1];

        // Boss phase: darken background to dark red
        if (this.isBossPhase) {
            bgColor0 = '#2d0a0a';
            bgColor1 = '#4d1a1a';
        } else if (this.score > 0 && this.currentTheme !== 'gold') {
            // Interpolate colors based on score for visual progression
            const scoreProgress = Math.min(1, (this.score % 100) / 100);
            const nextThemeIndex = (THEMES_DATA.findIndex(t => t.id === this.currentTheme) + 1) % THEMES_DATA.length;
            const nextTheme = THEMES_DATA[nextThemeIndex];
            if (scoreProgress > 0.8 && nextTheme) {
                const blend = (scoreProgress - 0.8) * 5;
                bgColor0 = this.lerpColor(theme.bgGradient[0], nextTheme.bgGradient[0], blend);
                bgColor1 = this.lerpColor(theme.bgGradient[1], nextTheme.bgGradient[1], blend);
            }
        }

        const bg = ctx.createLinearGradient(0, 0, 0, this.H);
        bg.addColorStop(0, bgColor0);
        bg.addColorStop(1, bgColor1);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.W, this.H);

        // Draw background particles
        for (const p of this.bgParticles) {
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            if (p.type === 'star') {
                this.drawStar(ctx, 0, 0, 5, p.size, p.size * 0.5);
            } else if (p.type === 'spark') {
                ctx.fillRect(-p.size * 0.5, -p.size * 0.5, p.size, p.size);
            } else if (p.type === 'ember' || p.type === 'snowflake') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.75, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
        ctx.globalAlpha = 1;

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

        // draw trail (footprint-style afterimage)
        for (const t of this.trailPoints) {
            const trailColor = skin.color === 'rainbow'
                ? `hsl(${Date.now() / 10 % 360}, 80%, 60%)`
                : (skin.color || theme.ballColor);
            ctx.globalAlpha = t.life * 0.15;
            ctx.fillStyle = trailColor;
            ctx.beginPath();
            ctx.arc(t.x, t.y - 12, 3 * t.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // draw runner
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

        // screen flash effect on death
        if (this.screenFlash > 0) {
            ctx.globalAlpha = this.screenFlash;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-this.cameraX, -this.cameraY, this.W, this.H);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let step = Math.PI / spikes;
        let x = cx;
        let y = cy - outerRadius;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < spikes * 2; i++) {
            let r = (i & 1) === 0 ? outerRadius : innerRadius;
            x = cx + r * Math.sin(i * step);
            y = cy - r * Math.cos(i * step);
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }

    lerpColor(color1, color2, t) {
        // Simple linear interpolation between two hex colors
        const c1 = parseInt(color1.substring(1), 16);
        const c2 = parseInt(color2.substring(1), 16);
        const r1 = (c1 >> 16) & 255;
        const g1 = (c1 >> 8) & 255;
        const b1 = c1 & 255;
        const r2 = (c2 >> 16) & 255;
        const g2 = (c2 >> 8) & 255;
        const b2 = c2 & 255;
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `rgb(${r},${g},${b})`;
    }

    drawTile(ctx, x, y, theme, passed) {
        const tw = this.tileW;
        const th = this.tileH;

        ctx.globalAlpha = passed ? 0.35 : 1;

        // top face with gradient
        const grad = ctx.createLinearGradient(x - tw / 2, y - th / 2, x + tw / 2, y + th / 2);
        grad.addColorStop(0, theme.tileHighlight);
        grad.addColorStop(1, theme.tileColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y - th / 2);
        ctx.lineTo(x + tw / 2, y);
        ctx.lineTo(x, y + th / 2);
        ctx.lineTo(x - tw / 2, y);
        ctx.closePath();
        ctx.fill();

        // subtle grid pattern on top face
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        const gridCount = 3;
        for (let i = 1; i < gridCount; i++) {
            const ratio = i / gridCount;
            ctx.beginPath();
            const p1x = x - tw / 2 + (x + tw / 2 - (x - tw / 2)) * ratio;
            const p1y = y - th / 2 + (y + th / 2 - (y - th / 2)) * ratio;
            ctx.moveTo(p1x, y - th / 2);
            ctx.lineTo(p1x, y + th / 2);
            ctx.stroke();
        }

        // highlight line along top edge
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - tw / 4, y - th / 4);
        ctx.lineTo(x + tw / 4, y - th / 4);
        ctx.stroke();

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
        const rotation = Date.now() / 1000;

        ctx.save();
        ctx.translate(x, y + bounce);
        ctx.rotate(rotation);

        ctx.fillStyle = theme.coinColor;
        ctx.shadowColor = theme.coinColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        // Coin rotation: scale x-axis to create spinning effect
        const scaleX = Math.cos(rotation * 0.5);
        ctx.save();
        ctx.scale(Math.abs(scaleX), 1);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();

        // Sparkle particles around coin occasionally
        if (Math.sin(t * 2) > 0.8) {
            const sparkX = x + Math.cos(t * 3) * 12;
            const sparkY = y + bounce + Math.sin(t * 4) * 12;
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = theme.coinColor;
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
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

        const s = r * 2; // total size

        // Drop shadow on ground
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + r + 4, r * 0.6, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Runner character ---
        const headR = s * 0.22;
        const bodyTop = y - s * 0.15;
        const bodyBot = y + s * 0.25;

        // Legs (animated running motion)
        const runCycle = Date.now() * 0.012;
        const legSwing = Math.sin(runCycle) * 0.4;
        const legLen = s * 0.32;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        // Left leg
        ctx.beginPath();
        ctx.moveTo(x - 1, bodyBot);
        ctx.lineTo(x - 3 + Math.sin(legSwing) * 4, bodyBot + legLen);
        ctx.stroke();
        // Right leg
        ctx.beginPath();
        ctx.moveTo(x + 1, bodyBot);
        ctx.lineTo(x + 3 + Math.sin(legSwing + Math.PI) * 4, bodyBot + legLen);
        ctx.stroke();

        // Body
        const bodyGrad = ctx.createLinearGradient(x, bodyTop, x, bodyBot);
        bodyGrad.addColorStop(0, this.lightenColor(color, 30));
        bodyGrad.addColorStop(1, color);
        ctx.fillStyle = bodyGrad;
        const bw = s * 0.32, bh = bodyBot - bodyTop, bx = x - s * 0.16, br = 3;
        ctx.beginPath();
        ctx.moveTo(bx + br, bodyTop);
        ctx.lineTo(bx + bw - br, bodyTop);
        ctx.quadraticCurveTo(bx + bw, bodyTop, bx + bw, bodyTop + br);
        ctx.lineTo(bx + bw, bodyTop + bh - br);
        ctx.quadraticCurveTo(bx + bw, bodyTop + bh, bx + bw - br, bodyTop + bh);
        ctx.lineTo(bx + br, bodyTop + bh);
        ctx.quadraticCurveTo(bx, bodyTop + bh, bx, bodyTop + bh - br);
        ctx.lineTo(bx, bodyTop + br);
        ctx.quadraticCurveTo(bx, bodyTop, bx + br, bodyTop);
        ctx.closePath();
        ctx.fill();

        // Arms (animated swing)
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const armSwing = Math.sin(runCycle + Math.PI) * 0.35;
        // Left arm
        ctx.beginPath();
        ctx.moveTo(x - s * 0.14, bodyTop + s * 0.08);
        ctx.lineTo(x - s * 0.28 + Math.sin(armSwing) * 3, bodyTop + s * 0.28);
        ctx.stroke();
        // Right arm
        ctx.beginPath();
        ctx.moveTo(x + s * 0.14, bodyTop + s * 0.08);
        ctx.lineTo(x + s * 0.28 + Math.sin(armSwing + Math.PI) * 3, bodyTop + s * 0.28);
        ctx.stroke();

        // Head
        const headGrad = ctx.createRadialGradient(x - headR * 0.2, y - s * 0.32, 0, x, y - s * 0.28, headR);
        headGrad.addColorStop(0, this.lightenColor(color, 50));
        headGrad.addColorStop(1, color);
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(x, y - s * 0.28, headR, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (looking forward in direction)
        const eyeOffX = this.direction === 0 ? 2 : -2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + eyeOffX - 2, y - s * 0.3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeOffX + 2, y - s * 0.3, 2, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(x + eyeOffX - 1.5, y - s * 0.3, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeOffX + 2.5, y - s * 0.3, 1, 0, Math.PI * 2);
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

        // NEW: Update Stage display
        const stageEl = document.getElementById('hudStage');
        if (stageEl) {
            let stageText = `Stage ${this.currentStage}`;
            if (this.isBossPhase) {
                stageText = `⚠️ BOSS! (${this.bossesDefeated})`;
            }
            stageEl.textContent = stageText;
            const progressEl = document.getElementById('stageProgress');
            if (progressEl) {
                let progress = 0;
                if (this.isBossPhase) {
                    progress = ((this.score - this.bossStartScore) / (this.bossPhaseEndScore - this.bossStartScore)) * 100;
                } else if (this.currentStage === 1) {
                    progress = (this.score / 100) * 100;
                } else if (this.currentStage === 2) {
                    progress = ((this.score - 100) / 200) * 100;
                } else if (this.currentStage === 3) {
                    progress = ((this.score - 300) / 300) * 100;
                } else {
                    progress = 100;
                }
                progress = Math.min(100, progress);
                progressEl.style.width = progress + '%';
            }
        }
    }

    updateMainUI() {
        const title = this.getTitle(this.stats.maxScore);
        const bestEl = document.getElementById('mainBest');
        if (bestEl) {
            const format = i18n.t('menu.bestScore');
            bestEl.textContent = format.includes('0') ? format.replace('0', this.stats.maxScore) : `${this.stats.maxScore} ${format}`;
        }
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
            const statusText = unlocked ? (active ? i18n.t('skins.inUse') : i18n.t('skins.select')) : t.description;
            div.innerHTML = `
                <span class="item-emoji">${t.emoji}</span>
                <span class="item-name">${t.name}</span>
                <span class="item-desc">${statusText}</span>
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
                ? (active ? i18n.t('skins.inUse') : i18n.t('skins.select'))
                : `${s.unlockValue}${i18n.t('skins.unlockAtScore')}`;
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
            <div class="stat-row"><span data-i18n="stats.bestScore">${i18n.t('stats.bestScore')}</span><span>${this.stats.maxScore}</span></div>
            <div class="stat-row"><span data-i18n="stats.currentTitle">${i18n.t('stats.currentTitle')}</span><span>${title.emoji} ${title.name}</span></div>
            <div class="stat-row"><span data-i18n="stats.totalGames">${i18n.t('stats.totalGames')}</span><span>${this.stats.totalGames}</span></div>
            <div class="stat-row"><span data-i18n="stats.totalDistance">${i18n.t('stats.totalDistance')}</span><span>${this.stats.totalDistance}</span></div>
            <div class="stat-row"><span data-i18n="stats.totalCoins">${i18n.t('stats.totalCoins')}</span><span>${this.stats.totalCoins}</span></div>
            <div class="stat-row"><span data-i18n="boss.maxDefeated">${i18n.t('boss.maxDefeated')}</span><span>${this.stats.maxBossesDefeated}</span></div>
            <div class="stat-row"><span data-i18n="stats.unlockedThemes">${i18n.t('stats.unlockedThemes')}</span><span>${this.unlockedThemes.length}/${THEMES_DATA.length}</span></div>
            <div class="stat-row"><span data-i18n="stats.unlockedSkins">${i18n.t('stats.unlockedSkins')}</span><span>${this.unlockedSkins.length}/${SKINS_DATA.length}</span></div>
        `;
    }

    // NEW: Stage progression system
    updateStage() {
        let newStage = 1;
        if (this.score >= 600) {
            newStage = 4;
        } else if (this.score >= 300) {
            newStage = 3;
        } else if (this.score >= 100) {
            newStage = 2;
        }

        if (newStage !== this.currentStage) {
            this.currentStage = newStage;
            this.lastStageShowTime = Date.now();
            this.triggerScreenShake(150);
            this.triggerScreenFlash('flash-success', 100);
            this.showStageBanner(`Stage ${newStage}!`);
        }
    }

    showStageBanner(text) {
        const banner = document.createElement('div');
        banner.className = 'stage-banner';
        banner.textContent = text;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 900);
    }

    // === DOPAMINE EFFECT FUNCTIONS ===
    triggerScreenShake(duration = 300) {
        const wrap = document.querySelector('.game-canvas-wrap');
        if (!wrap) return;
        wrap.classList.add('shake');
        setTimeout(() => wrap.classList.remove('shake'), duration);
    }

    triggerScreenFlash(color = 'flash', duration = 200) {
        const wrap = document.querySelector('.game-canvas-wrap');
        if (!wrap) return;
        wrap.classList.add(color);
        setTimeout(() => wrap.classList.remove(color), duration);
    }

    spawnCoinPopup(x, y) {
        const popup = document.createElement('div');
        popup.className = 'coin-popup';
        popup.textContent = '🪙';
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        const wrap = document.querySelector('.game-canvas-wrap');
        if (wrap) wrap.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }

    showComboIndicator(x, y, comboCount) {
        const indicator = document.createElement('div');
        indicator.className = 'combo-indicator';
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';

        const text = document.createElement('div');
        text.className = 'combo-text';
        // Support both numeric combo counts and custom text strings
        if (typeof comboCount === 'string') {
            text.textContent = comboCount;
        } else {
            text.textContent = `COMBO x${comboCount}!`;
        }
        indicator.appendChild(text);

        const wrap = document.querySelector('.game-canvas-wrap');
        if (wrap) wrap.appendChild(indicator);
        setTimeout(() => indicator.remove(), 600);
    }

    spawnConfetti(x, y, count = 12) {
        const wrap = document.querySelector('.game-canvas-wrap');
        if (!wrap) return;

        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = `confetti type-${(i % 3) + 1}`;
            confetti.style.left = x + 'px';
            confetti.style.top = y + 'px';
            confetti.style.transform = `translate(${(Math.random() - 0.5) * 200}px, 0) rotateZ(${Math.random() * 360}deg)`;

            wrap.appendChild(confetti);

            // Animate confetti fall
            const duration = 800 + Math.random() * 400;
            confetti.style.animation = `confetti-fall ${duration}ms linear forwards`;

            setTimeout(() => confetti.remove(), duration);
        }
    }

    showMilestoneBanner(text) {
        const banner = document.createElement('div');
        banner.className = 'milestone-banner';
        banner.innerHTML = `
            <span class="icon">🎉</span>
            <div>${text}</div>
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 900);
    }

    showBossWarning() {
        const banner = document.createElement('div');
        banner.className = 'boss-warning-banner';
        const tier = this.bossTier;
        const tierNames = [i18n.t('boss.tier1'), i18n.t('boss.tier2'), i18n.t('boss.tier3'), i18n.t('boss.tier4')];
        const tierName = tierNames[Math.min(3, tier - 1)] || tierNames[3];
        banner.innerHTML = `
            <span class="icon">⚠️</span>
            <div>${i18n.t('boss.warning')}</div>
            <span class="tier">${tierName}</span>
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 900);
    }

    showBossDefeatedBanner() {
        const banner = document.createElement('div');
        banner.className = 'boss-defeated-banner';
        banner.innerHTML = `
            <span class="icon">⚡</span>
            <div>${i18n.t('boss.defeated')}</div>
            <span class="count">+20 ${i18n.t('boss.points')}</span>
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 1100);
    }

    // --- Share ---
    shareResult() {
        const title = this.getTitle(this.score);
        const shareTemplate = window.i18n?.t('shareResult.text') || '{emoji} Zigzag Runner\nScore: {score} | Coins: {coins}\nTitle: {title}\n\nTry the zigzag challenge!';
        const text = shareTemplate.replace('{emoji}', title.emoji).replace('{score}', this.score).replace('{coins}', this.coins).replace('{title}', title.name);
        const url = 'https://dopabrain.com/zigzag-runner/';

        if (navigator.share) {
            navigator.share({ title: 'Zigzag Runner', text, url }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text + '\n' + url).then(() => {
                const btn = document.getElementById('btnShare');
                if (btn) {
                    const orig = btn.textContent;
                    btn.textContent = window.i18n?.t('shareResult.copied') || 'Copied!';
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
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize language support
        await i18n.loadTranslations(i18n.currentLang);
        i18n.updateUI();

        const langBtn = document.getElementById('langBtn');
        const langMenu = document.getElementById('langMenu');

        if (langBtn && langMenu) {
            langMenu.innerHTML = '';
            i18n.supportedLanguages.forEach(lang => {
                const btn = document.createElement('button');
                btn.className = `lang-option ${lang === i18n.currentLang ? 'active' : ''}`;
                btn.textContent = i18n.getLanguageName(lang);
                btn.addEventListener('click', async () => {
                    await i18n.setLanguage(lang);
                    document.querySelectorAll('.lang-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    langMenu.classList.add('hidden');
                });
                langMenu.appendChild(btn);
            });

            langBtn.addEventListener('click', () => {
                langMenu.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.language-selector')) {
                    langMenu.classList.add('hidden');
                }
            });
        }
    } catch (e) {
        console.warn('i18n init failed:', e);
    }

    new ZigzagRunner();

    // Hide app loader
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 300);
    }
});

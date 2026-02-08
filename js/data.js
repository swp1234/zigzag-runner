// Zigzag Runner - Game Data
const THEMES_DATA = [
    {
        id: 'classic',
        name: '클래식',
        emoji: '🟦',
        tileColor: '#4a90d9',
        tileHighlight: '#5ba3ec',
        tileShadow: '#3a7bc8',
        bgGradient: ['#0f0c29', '#1a1a3e'],
        ballColor: '#ff6348',
        coinColor: '#ffd700',
        unlockCondition: 'default',
        description: '기본 테마'
    },
    {
        id: 'neon',
        name: '네온',
        emoji: '💜',
        tileColor: '#9b59b6',
        tileHighlight: '#af6ec7',
        tileShadow: '#8e44ad',
        bgGradient: ['#0a0012', '#1a0030'],
        ballColor: '#00ff88',
        coinColor: '#ff00ff',
        unlockCondition: 'score',
        unlockValue: 500,
        description: '500점 달성 시 해금'
    },
    {
        id: 'sunset',
        name: '선셋',
        emoji: '🌅',
        tileColor: '#e74c3c',
        tileHighlight: '#f06050',
        tileShadow: '#c0392b',
        bgGradient: ['#2c1810', '#4a2020'],
        ballColor: '#f1c40f',
        coinColor: '#e67e22',
        unlockCondition: 'score',
        unlockValue: 1500,
        description: '1500점 달성 시 해금'
    },
    {
        id: 'arctic',
        name: '아틱',
        emoji: '❄️',
        tileColor: '#1abc9c',
        tileHighlight: '#2ee0b8',
        tileShadow: '#16a085',
        bgGradient: ['#0a1628', '#122240'],
        ballColor: '#ecf0f1',
        coinColor: '#00d2ff',
        unlockCondition: 'score',
        unlockValue: 3000,
        description: '3000점 달성 시 해금'
    },
    {
        id: 'gold',
        name: '골드',
        emoji: '👑',
        tileColor: '#d4a017',
        tileHighlight: '#e8b830',
        tileShadow: '#b8860b',
        bgGradient: ['#1a1400', '#2d2200'],
        ballColor: '#ffffff',
        coinColor: '#ffeaa7',
        unlockCondition: 'score',
        unlockValue: 5000,
        description: '5000점 달성 시 해금'
    }
];

const SKINS_DATA = [
    { id: 'default', name: '기본 공', emoji: '🔴', color: null, unlockCondition: 'default' },
    { id: 'blue', name: '파란 공', emoji: '🔵', color: '#3498db', unlockCondition: 'score', unlockValue: 300 },
    { id: 'green', name: '초록 공', emoji: '🟢', color: '#2ecc71', unlockCondition: 'score', unlockValue: 800 },
    { id: 'purple', name: '보라 공', emoji: '🟣', color: '#9b59b6', unlockCondition: 'score', unlockValue: 1200 },
    { id: 'star', name: '별 공', emoji: '⭐', color: '#f1c40f', unlockCondition: 'score', unlockValue: 2000 },
    { id: 'diamond', name: '다이아 공', emoji: '💎', color: '#00d2ff', unlockCondition: 'score', unlockValue: 3500 },
    { id: 'fire', name: '불꽃 공', emoji: '🔥', color: '#ff4500', unlockCondition: 'score', unlockValue: 5000 },
    { id: 'rainbow', name: '무지개 공', emoji: '🌈', color: 'rainbow', unlockCondition: 'score', unlockValue: 8000 }
];

const TITLES_DATA = [
    { score: 0, name: '초보 걸음마', emoji: '👶' },
    { score: 50, name: '첫 발걸음', emoji: '🐣' },
    { score: 100, name: '길 위의 여행자', emoji: '🚶' },
    { score: 200, name: '방향 전환 견습생', emoji: '🔄' },
    { score: 350, name: '민첩한 러너', emoji: '🏃' },
    { score: 500, name: '지그재그 탐험가', emoji: '🧭' },
    { score: 750, name: '코인 수집가', emoji: '💰' },
    { score: 1000, name: '숙련된 러너', emoji: '⚡' },
    { score: 1500, name: '지그재그 마스터', emoji: '🎯' },
    { score: 2000, name: '방향 전환의 달인', emoji: '🌀' },
    { score: 2500, name: '무한 질주자', emoji: '🏎️' },
    { score: 3000, name: '길의 지배자', emoji: '👑' },
    { score: 4000, name: '전설의 러너', emoji: '🌟' },
    { score: 5000, name: '지그재그 영웅', emoji: '🦸' },
    { score: 6500, name: '초월자', emoji: '🔮' },
    { score: 8000, name: '차원의 걸음', emoji: '🌌' },
    { score: 10000, name: '시공간 러너', emoji: '⏳' },
    { score: 15000, name: '불멸의 발걸음', emoji: '♾️' },
    { score: 20000, name: '우주의 끝', emoji: '🪐' },
    { score: 30000, name: '지그재그의 신', emoji: '👼' }
];

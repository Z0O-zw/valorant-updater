// 选手榜单界面模块

// 玩家数据
export let players = [];
let leaderboardData = null;

// 设置玩家数据
export function setPlayers(newPlayers) {
  players = newPlayers;
}

// 设置排行榜数据
export function setLeaderboardData(data) {
  leaderboardData = data;
  console.log('🔄 setLeaderboardData 被调用，数据示例:', data?.players?.[0]);
}


// 渲染选手榜单界面
export async function render() {
  const content = document.getElementById('content');
  if (!content) return;

  console.log('🎨 render() 被调用，当前 leaderboardData:', leaderboardData?.players?.[0]);

  if (!leaderboardData || !leaderboardData.players) {
    content.innerHTML = `
      <div class="section">
        <h2>选手榜单</h2>
        <p>正在加载排行榜数据...</p>
      </div>
    `;
    return;
  }

  // 合并玩家基础信息和排行榜数据
  const playerStats = leaderboardData.players.map((stats) => {
    const player = players.find(p => p.puuid === stats.puuid);

    // 计算统计数据
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
    const winRate = stats.all > 0 ? ((stats.win / stats.all) * 100).toFixed(1) : '0.0';

    return {
      puuid: stats.puuid,
      name: player?.name || 'Unknown',
      avatar: player?.card || '', // 直接使用游戏内头像
      kills: stats.kills,
      deaths: stats.deaths,
      assists: stats.assists,
      kd: kd,
      headrate: stats.headrate.toFixed(1),
      wins: stats.win,
      winRate: winRate,
      totalGames: stats.all
    };
  });

  // 按助攻数排序（从高到低）
  playerStats.sort((a, b) => b.assists - a.assists);

  let html = `
    <div class="section">
      <h2>🏆 选手榜单</h2>
      <div class="leaderboard-container">
  `;

  playerStats.forEach((player) => {
    html += `
      <div class="player-banner">
        <div class="player-basic">
          <img src="${player.avatar}" alt="${player.name}" class="player-avatar">
          <div class="player-name">${player.name}</div>
        </div>
        <div class="player-stats">
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-label">击杀</span>
              <span class="stat-value">${player.kills}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">死亡</span>
              <span class="stat-value">${player.deaths}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">助攻</span>
              <span class="stat-value">${player.assists}</span>
            </div>
          </div>
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-label">K/D</span>
              <span class="stat-value">${player.kd}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">爆头率</span>
              <span class="stat-value">${player.headrate}%</span>
            </div>
          </div>
          <div class="stat-group">
            <div class="stat-item">
              <span class="stat-label">胜利</span>
              <span class="stat-value">${player.wins}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">胜率</span>
              <span class="stat-value">${player.winRate}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">总场次</span>
              <span class="stat-value">${player.totalGames}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  content.innerHTML = html;
}


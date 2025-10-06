// 对局记录界面模块
import { players } from './players.js';
import { getMatches } from '../data/match.js';

// 渲染对局记录界面
export function render() {
  const content = document.getElementById('content');
  if (!content) return;

  const matches = getMatches();

  if (!matches || matches.length === 0) {
    content.innerHTML = `
      <div class="section">
        <h2>对局记录</h2>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载对局记录...</div>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="section">
      <h2>对局记录</h2>

      <!-- 对局记录列表 -->
      <div class="match-records">
        <div class="matches-list">
  `;

  // 过滤掉指定的 matchid 并按时间倒序排列对局
  const filteredMatches = matches.filter(match =>
    match.metadata?.matchid !== '98cce6af-a308-4f13-ad8e-b3362af0ac05'
  );

  const sortedMatches = [...filteredMatches].sort((a, b) => {
    const timeA = new Date(a.metadata?.game_start_patched || 0).getTime();
    const timeB = new Date(b.metadata?.game_start_patched || 0).getTime();
    return timeB - timeA;
  });

  sortedMatches.forEach((match, index) => {
    const matchInfo = parseMatchInfo(match);
    html += renderMatchCard(matchInfo, index);
  });

  html += `
        </div>
      </div>
    </div>
  `;

  content.innerHTML = html;
}

// 解析比赛信息
function parseMatchInfo(match) {
  const metadata = match.metadata || {};
  const playersData = match.players?.all_players || [];
  const teams = match.teams || {};

  // 解析地图名称
  const map = metadata.map || '未知地图';

  // 解析对局时间（只保留星期、日期）
  let dateStr = '未知时间';
  if (metadata.game_start_patched) {
    const date = new Date(metadata.game_start_patched);
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    dateStr = date.toLocaleDateString('zh-CN', options);
  }

  // 解析队伍组成和计算KDA
  const redTeam = playersData.filter(p => p.team === 'Red').map(player => ({
    ...player,
    kda: calculatePlayerKDA(player, match),
    agentKillfeed: player.assets?.agent?.killfeed || ''
  }));

  const blueTeam = playersData.filter(p => p.team === 'Blue').map(player => ({
    ...player,
    kda: calculatePlayerKDA(player, match),
    agentKillfeed: player.assets?.agent?.killfeed || ''
  }));

  // 确定获胜方和大比分
  let winningTeam = null;
  let redScore = 0;
  let blueScore = 0;

  if (teams.red && teams.blue) {
    winningTeam = teams.red.has_won ? 'Red' : teams.blue.has_won ? 'Blue' : null;
    redScore = teams.red.rounds_won || 0;
    blueScore = teams.blue.rounds_won || 0;
  }

  return {
    map,
    date: dateStr,
    redTeam,
    blueTeam,
    winningTeam,
    redScore,
    blueScore,
    matchId: metadata.matchid
  };
}

// 计算玩家在该场比赛的KDA
function calculatePlayerKDA(player, match) {
  if (!match.kills || !player.stats) {
    return { kills: 0, deaths: 0, assists: 0 };
  }

  // 从玩家统计数据中获取KDA
  const kills = player.stats.kills || 0;
  const deaths = player.stats.deaths || 0;
  const assists = player.stats.assists || 0;

  return { kills, deaths, assists };
}

// 渲染比赛卡片
function renderMatchCard(matchInfo, index) {
  return `
    <div class="match-card">
      <div class="match-header">
        <div class="match-map">
          <span class="map-name">${matchInfo.map}</span>
        </div>
        <div class="match-score">
          <span class="score ${matchInfo.winningTeam === 'Red' ? 'winning-score' : ''}">${matchInfo.redScore}</span>
          <span class="score-separator">:</span>
          <span class="score ${matchInfo.winningTeam === 'Blue' ? 'winning-score' : ''}">${matchInfo.blueScore}</span>
        </div>
        <div class="match-date">
          <span class="date-text">${matchInfo.date}</span>
        </div>
      </div>

      <div class="match-teams">
        <div class="team ${matchInfo.winningTeam === 'Red' ? 'winning-team' : 'losing-team'}">
          <div class="team-label red-label">红队</div>
          <div class="team-members">
            ${matchInfo.redTeam.map(player => `
              <div class="team-player" style="background-image: linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0.7)), url('${player.agentKillfeed}'); background-size: 40%; background-position: right center; background-repeat: no-repeat;">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-small">
                <div class="player-info">
                  <span class="player-name">${player.name}</span>
                  <span class="player-kda">${player.kda.kills}/${player.kda.deaths}/${player.kda.assists}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${matchInfo.winningTeam === 'Red' ? '<div class="victory-badge">胜利</div>' : ''}
        </div>

        <div class="vs-separator">VS</div>

        <div class="team ${matchInfo.winningTeam === 'Blue' ? 'winning-team' : 'losing-team'}">
          <div class="team-label blue-label">蓝队</div>
          <div class="team-members">
            ${matchInfo.blueTeam.map(player => `
              <div class="team-player" style="background-image: linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0.7)), url('${player.agentKillfeed}'); background-size: 40%; background-position: right center; background-repeat: no-repeat;">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-small">
                <div class="player-info">
                  <span class="player-name">${player.name}</span>
                  <span class="player-kda">${player.kda.kills}/${player.kda.deaths}/${player.kda.assists}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${matchInfo.winningTeam === 'Blue' ? '<div class="victory-badge">胜利</div>' : ''}
        </div>
      </div>
    </div>
  `;
}

// 获取玩家头像
function getPlayerAvatar(puuid) {
  const player = players.find(p => p.puuid === puuid);
  return player?.card || 'https://via.placeholder.com/40x40?text=?';
}


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

  // 生成组队推荐
  const teamRecommendation = generateTeamRecommendation();

  let html = `
    <div class="section">
      <h2>📊 对局记录</h2>

      <!-- 组队推荐 -->
      <div class="team-recommendation">
        <h3>🎯 组队推荐</h3>
        <div class="recommended-teams">
          <div class="team red-team">
            <h4>红队</h4>
            <div class="team-players">
              ${teamRecommendation.teamRed.map(player => `
                <div class="recommended-player">
                  <img src="${player.avatar}" alt="${player.name}" class="player-avatar-small">
                  <span class="player-name">${player.name}</span>
                  <span class="player-kd">K/D: ${player.kd}</span>
                </div>
              `).join('')}
            </div>
            <div class="team-stats">平均K/D: ${teamRecommendation.teamRedAvgKD}</div>
          </div>

          <div class="vs-divider">VS</div>

          <div class="team blue-team">
            <h4>蓝队</h4>
            <div class="team-players">
              ${teamRecommendation.teamBlue.map(player => `
                <div class="recommended-player">
                  <img src="${player.avatar}" alt="${player.name}" class="player-avatar-small">
                  <span class="player-name">${player.name}</span>
                  <span class="player-kd">K/D: ${player.kd}</span>
                </div>
              `).join('')}
            </div>
            <div class="team-stats">平均K/D: ${teamRecommendation.teamBlueAvgKD}</div>
          </div>
        </div>
      </div>

      <!-- 对局记录列表 -->
      <div class="match-records">
        <h3>📝 历史对局</h3>
        <div class="matches-list">
  `;

  // 按时间倒序排列对局
  const sortedMatches = [...matches].sort((a, b) => {
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

  // 解析队伍组成
  const redTeam = playersData.filter(p => p.team === 'Red');
  const blueTeam = playersData.filter(p => p.team === 'Blue');

  // 确定获胜方
  let winningTeam = null;
  if (teams.red && teams.blue) {
    winningTeam = teams.red.has_won ? 'Red' : teams.blue.has_won ? 'Blue' : null;
  }

  return {
    map,
    date: dateStr,
    redTeam,
    blueTeam,
    winningTeam,
    matchId: metadata.matchid
  };
}

// 渲染比赛卡片
function renderMatchCard(matchInfo, index) {
  return `
    <div class="match-card">
      <div class="match-header">
        <div class="match-map">
          <span class="map-icon">🗺️</span>
          <span class="map-name">${matchInfo.map}</span>
        </div>
        <div class="match-date">
          <span class="date-icon">📅</span>
          <span class="date-text">${matchInfo.date}</span>
        </div>
      </div>

      <div class="match-teams">
        <div class="team ${matchInfo.winningTeam === 'Red' ? 'winning-team' : 'losing-team'}">
          <div class="team-label red-label">红队</div>
          <div class="team-members">
            ${matchInfo.redTeam.map(player => `
              <div class="team-player">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-small">
                <span class="player-name">${player.name}</span>
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
              <div class="team-player">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-small">
                <span class="player-name">${player.name}</span>
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

// 生成组队推荐
function generateTeamRecommendation() {
  if (!players || players.length === 0) {
    return {
      teamRed: [],
      teamBlue: [],
      teamRedAvgKD: '0.00',
      teamBlueAvgKD: '0.00'
    };
  }

  // 计算每个玩家的统计数据
  const playerStats = players.map(player => {
    const stats = calculatePlayerStats(player.puuid);
    return {
      ...player,
      kd: stats.kd,
      kdValue: stats.kdValue,
      assistsWith: stats.assistsWith
    };
  });

  // 简单的平衡算法：按K/D排序后交替分配
  const sortedPlayers = [...playerStats].sort((a, b) => b.kdValue - a.kdValue);

  const teamRed = [];
  const teamBlue = [];

  sortedPlayers.forEach((player, index) => {
    if (index % 2 === 0) {
      teamRed.push(player);
    } else {
      teamBlue.push(player);
    }
  });

  // 计算平均K/D
  const teamRedAvgKD = (teamRed.reduce((sum, p) => sum + p.kdValue, 0) / Math.max(teamRed.length, 1)).toFixed(2);
  const teamBlueAvgKD = (teamBlue.reduce((sum, p) => sum + p.kdValue, 0) / Math.max(teamBlue.length, 1)).toFixed(2);

  return {
    teamRed,
    teamBlue,
    teamRedAvgKD,
    teamBlueAvgKD
  };
}

// 计算玩家统计数据
function calculatePlayerStats(puuid) {
  const matches = getMatches();
  let totalKills = 0;
  let totalDeaths = 0;
  let assistsWith = new Set();

  matches.forEach(match => {
    if (!match.kills) return;

    match.kills.forEach(kill => {
      if (kill.killer_puuid === puuid) {
        totalKills++;
      }
      if (kill.victim_puuid === puuid) {
        totalDeaths++;
      }

      // 计算协助关系
      if (kill.assistants) {
        kill.assistants.forEach(assistant => {
          if (assistant.assistant_puuid === puuid) {
            assistsWith.add(kill.killer_puuid);
          }
          if (kill.killer_puuid === puuid) {
            assistsWith.add(assistant.assistant_puuid);
          }
        });
      }
    });
  });

  const kdValue = totalDeaths > 0 ? totalKills / totalDeaths : totalKills;
  const kd = kdValue.toFixed(2);

  return {
    kd,
    kdValue,
    assistsWith: assistsWith.size
  };
}
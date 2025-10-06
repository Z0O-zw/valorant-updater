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

      <!-- 组队推荐板块 -->
      <div class="team-recommendation">
        ${renderTeamRecommendation()}
      </div>

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
  const alphaTeam = playersData.filter(p => p.team === 'Red').map(player => ({
    ...player,
    kda: calculatePlayerKDA(player, match),
    agentKillfeed: player.assets?.agent?.killfeed || ''
  }));

  const omegaTeam = playersData.filter(p => p.team === 'Blue').map(player => ({
    ...player,
    kda: calculatePlayerKDA(player, match),
    agentKillfeed: player.assets?.agent?.killfeed || ''
  }));

  // 确定获胜方和大比分
  let winningTeam = null;
  let alphaScore = 0;
  let omegaScore = 0;

  if (teams.red && teams.blue) {
    winningTeam = teams.red.has_won ? 'Alpha' : teams.blue.has_won ? 'Omega' : null;
    alphaScore = teams.red.rounds_won || 0;
    omegaScore = teams.blue.rounds_won || 0;
  }

  return {
    map,
    date: dateStr,
    alphaTeam,
    omegaTeam,
    winningTeam,
    alphaScore,
    omegaScore,
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
          <span class="score ${matchInfo.winningTeam === 'Alpha' ? 'winning-score' : ''}">${matchInfo.alphaScore}</span>
          <span class="score-separator">:</span>
          <span class="score ${matchInfo.winningTeam === 'Omega' ? 'winning-score' : ''}">${matchInfo.omegaScore}</span>
        </div>
        <div class="match-date">
          <span class="date-text">${matchInfo.date}</span>
        </div>
      </div>

      <div class="match-teams">
        <div class="team ${matchInfo.winningTeam === 'Alpha' ? 'winning-team' : 'losing-team'}">
          <div class="team-label red-label">α队</div>
          <div class="team-members">
            ${matchInfo.alphaTeam.map(player => `
              <div class="team-player" style="background-image: linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0.7)), url('${player.agentKillfeed}'); background-size: auto 100%; background-position: right center; background-repeat: no-repeat;">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-small">
                <div class="player-info">
                  <span class="player-name">${player.name}</span>
                  <span class="player-kda">${player.kda.kills}/${player.kda.deaths}/${player.kda.assists}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${matchInfo.winningTeam === 'Alpha' ? '<div class="victory-badge">胜利</div>' : ''}
        </div>

        <div class="vs-separator">VS</div>

        <div class="team ${matchInfo.winningTeam === 'Omega' ? 'winning-team' : 'losing-team'}">
          <div class="team-label blue-label">Ω队</div>
          <div class="team-members">
            ${matchInfo.omegaTeam.map(player => `
              <div class="team-player" style="background-image: linear-gradient(to right, rgba(255,255,255,0.95), rgba(255,255,255,0.7)), url('${player.agentKillfeed}'); background-size: auto 100%; background-position: right center; background-repeat: no-repeat;">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-small">
                <div class="player-info">
                  <span class="player-name">${player.name}</span>
                  <span class="player-kda">${player.kda.kills}/${player.kda.deaths}/${player.kda.assists}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${matchInfo.winningTeam === 'Omega' ? '<div class="victory-badge">胜利</div>' : ''}
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

// 渲染组队推荐
function renderTeamRecommendation() {
  const recommendation = calculateTeamRecommendation();

  if (!recommendation) {
    return `
      <div class="recommendation-card">
        <h3>组队推荐</h3>
        <p class="no-data">暂无足够数据进行推荐</p>
      </div>
    `;
  }

  return `
    <div class="recommendation-card">
      <h3>组队推荐</h3>
      <div class="recommended-teams">
        <div class="recommended-team red-team">
          <div class="team-label">推荐α队</div>
          <div class="team-players">
            ${recommendation.alphaTeam.map(player => `
              <div class="recommended-player">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-mini">
                <span class="player-name">${player.name}</span>
                <span class="player-stats">K/D: ${player.kd.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="vs-divider">VS</div>

        <div class="recommended-team blue-team">
          <div class="team-label">推荐Ω队</div>
          <div class="team-players">
            ${recommendation.omegaTeam.map(player => `
              <div class="recommended-player">
                <img src="${getPlayerAvatar(player.puuid)}" alt="${player.name}" class="player-avatar-mini">
                <span class="player-name">${player.name}</span>
                <span class="player-stats">K/D: ${player.kd.toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="recommendation-stats">
        <div class="balance-info">
          <span>K/D平衡度: ${recommendation.balanceScore.toFixed(3)}</span>
          <span>协作差异度: ${recommendation.collaborationScore.toFixed(3)}</span>
        </div>
      </div>
    </div>
  `;
}

// 计算组队推荐
function calculateTeamRecommendation() {
  if (!players || players.length < 8) {
    return null;
  }

  const matches = getMatches();
  if (!matches || matches.length === 0) {
    return null;
  }

  // 计算每个玩家的K/D比率
  const playerStats = calculatePlayerKDStats();

  // 计算玩家间协作数据
  const collaborationMatrix = calculateCollaborationMatrix();

  // 获取最后一次的组队配置
  const lastTeamConfig = getLastTeamConfiguration();

  // 生成所有可能的4v4组合
  const allCombinations = generateTeamCombinations(players);

  // 评估每个组合
  const scoredCombinations = allCombinations.map(combination => {
    const score = evaluateTeamCombination(combination, playerStats, collaborationMatrix, lastTeamConfig);
    return { ...combination, score };
  });

  // 选择最佳组合
  const bestCombination = scoredCombinations.sort((a, b) => b.score.total - a.score.total)[0];

  return {
    alphaTeam: bestCombination.redTeam.map(p => ({
      ...p,
      kd: playerStats[p.puuid]?.kd || 0
    })),
    omegaTeam: bestCombination.blueTeam.map(p => ({
      ...p,
      kd: playerStats[p.puuid]?.kd || 0
    })),
    balanceScore: 1 - bestCombination.score.kdBalance,
    collaborationScore: bestCombination.score.collaboration
  };
}

// 计算玩家K/D统计
function calculatePlayerKDStats() {
  const stats = {};
  const matches = getMatches();

  players.forEach(player => {
    let totalKills = 0;
    let totalDeaths = 0;
    let gamesPlayed = 0;

    matches.forEach(match => {
      const playerData = match.players?.all_players?.find(p => p.puuid === player.puuid);
      if (playerData && playerData.stats) {
        totalKills += playerData.stats.kills || 0;
        totalDeaths += playerData.stats.deaths || 0;
        gamesPlayed++;
      }
    });

    stats[player.puuid] = {
      kills: totalKills,
      deaths: totalDeaths,
      kd: totalDeaths > 0 ? totalKills / totalDeaths : totalKills,
      gamesPlayed
    };
  });

  return stats;
}

// 计算协作矩阵
function calculateCollaborationMatrix() {
  const matrix = {};
  const matches = getMatches();

  // 初始化矩阵
  players.forEach(p1 => {
    matrix[p1.puuid] = {};
    players.forEach(p2 => {
      if (p1.puuid !== p2.puuid) {
        matrix[p1.puuid][p2.puuid] = 0;
      }
    });
  });

  // 计算协作次数
  matches.forEach(match => {
    if (match.kills && Array.isArray(match.kills)) {
      match.kills.forEach(kill => {
        const killerPuuid = kill.killer_puuid;
        const assistants = kill.assistants || [];

        assistants.forEach(assistant => {
          const assistantPuuid = assistant.assistant_puuid;
          if (matrix[killerPuuid] && matrix[killerPuuid][assistantPuuid] !== undefined) {
            matrix[killerPuuid][assistantPuuid]++;
          }
          if (matrix[assistantPuuid] && matrix[assistantPuuid][killerPuuid] !== undefined) {
            matrix[assistantPuuid][killerPuuid]++;
          }
        });
      });
    }
  });

  return matrix;
}

// 获取最后一次组队配置
function getLastTeamConfiguration() {
  const matches = getMatches();
  if (!matches || matches.length === 0) return null;

  const sortedMatches = [...matches].sort((a, b) => {
    const timeA = new Date(a.metadata?.game_start_patched || 0).getTime();
    const timeB = new Date(b.metadata?.game_start_patched || 0).getTime();
    return timeB - timeA;
  });

  const lastMatch = sortedMatches[0];
  if (!lastMatch || !lastMatch.players?.all_players) return null;

  const redTeam = lastMatch.players.all_players.filter(p => p.team === 'Red').map(p => p.puuid);
  const blueTeam = lastMatch.players.all_players.filter(p => p.team === 'Blue').map(p => p.puuid);

  return { redTeam, blueTeam };
}

// 生成所有4v4组合
function generateTeamCombinations(playerList) {
  if (playerList.length !== 8) return [];

  const combinations = [];

  // 确保第一个玩家总是在红队，避免重复组合
  // 从剩余7个玩家中选3个与第一个玩家组成红队
  for (let i = 1; i < playerList.length; i++) {
    for (let j = i + 1; j < playerList.length; j++) {
      for (let k = j + 1; k < playerList.length; k++) {
        const redTeam = [playerList[0], playerList[i], playerList[j], playerList[k]];
        const blueTeam = playerList.filter(p => !redTeam.some(rp => rp.puuid === p.puuid));

        combinations.push({ redTeam, blueTeam });
      }
    }
  }

  return combinations;
}

// 评估组队组合
function evaluateTeamCombination(combination, playerStats, collaborationMatrix, lastTeamConfig) {
  const { redTeam, blueTeam } = combination;

  // 1. K/D平衡度评分 (kdBalance 越大越不平衡)
  const alphaKD = redTeam.reduce((sum, p) => sum + (playerStats[p.puuid]?.kd || 0), 0) / 4;
  const omegaKD = blueTeam.reduce((sum, p) => sum + (playerStats[p.puuid]?.kd || 0), 0) / 4;
  const kdBalance = Math.abs(alphaKD - omegaKD) / Math.max(alphaKD, omegaKD, 0.1);

  // 2. 协作差异度评分（collaboration 越大队内配合历史越少）
  const alphaCollaboration = calculateTeamCollaboration(redTeam, collaborationMatrix);
  const omegaCollaboration = calculateTeamCollaboration(blueTeam, collaborationMatrix);
  const collaboration = 1 / (1 + alphaCollaboration + omegaCollaboration);

  // 3. 与上次组队差异度评分
  let diversity = 1;
  if (lastTeamConfig) {
    const alphaSameCount = redTeam.filter(p => lastTeamConfig.redTeam.includes(p.puuid)).length;
    const omegaSameCount = blueTeam.filter(p => lastTeamConfig.blueTeam.includes(p.puuid)).length;
    diversity = 1 - (alphaSameCount + omegaSameCount) / 8;
  }

  // 综合评分
  const total = (1 - kdBalance) * 0.1 + (1-collaboration * 0.8) + diversity * 0.1;

  return {
    kdBalance,
    collaboration,
    diversity,
    total
  };
}

// 计算队伍内协作数
function calculateTeamCollaboration(team, collaborationMatrix) {
  let collaboration = 0;

  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const p1 = team[i].puuid;
      const p2 = team[j].puuid;
      collaboration += (collaborationMatrix[p1]?.[p2] || 0) + (collaborationMatrix[p2]?.[p1] || 0);
    }
  }

  return collaboration;
}


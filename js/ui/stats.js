// 统计界面模块
import { players } from './players.js';
import { getMatches } from '../data/match.js';

// 渲染统计界面
export function render() {
  const content = document.getElementById('content');
  if (!content) return;

  const matches = getMatches();
  const stats = calculateStats(matches);

  let html = `
    <div class="section">
      <h2>统计数据</h2>

      <div class="stats-overview">
        <h3>总体统计</h3>
        <table>
          <thead>
            <tr>
              <th>玩家</th>
              <th>参与比赛</th>
              <th>获胜次数</th>
              <th>胜率</th>
            </tr>
          </thead>
          <tbody>
  `;

  players.forEach((player, i) => {
    const playerStats = stats.players[i] || { matches: 0, wins: 0 };
    const winRate = playerStats.matches > 0 ? (playerStats.wins / playerStats.matches * 100).toFixed(1) : 0;

    html += `
      <tr>
        <td>${player.name}</td>
        <td>${playerStats.matches}</td>
        <td>${playerStats.wins}</td>
        <td>${winRate}%</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>

      <div class="team-combinations">
        <h3>最佳队伍组合</h3>
        <table>
          <thead>
            <tr>
              <th>队伍组合</th>
              <th>比赛次数</th>
              <th>获胜次数</th>
              <th>胜率</th>
            </tr>
          </thead>
          <tbody>
  `;

  Object.entries(stats.combinations)
    .sort((a, b) => {
      const aWinRate = a[1].wins / a[1].matches;
      const bWinRate = b[1].wins / b[1].matches;
      return bWinRate - aWinRate;
    })
    .slice(0, 10)
    .forEach(([combo, data]) => {
      const winRate = (data.wins / data.matches * 100).toFixed(1);
      html += `
        <tr>
          <td>${combo}</td>
          <td>${data.matches}</td>
          <td>${data.wins}</td>
          <td>${winRate}%</td>
        </tr>
      `;
    });

  html += `
          </tbody>
        </table>
      </div>

      <div class="worst-combinations">
        <h3>最差队伍组合</h3>
        <table>
          <thead>
            <tr>
              <th>队伍组合</th>
              <th>比赛次数</th>
              <th>获胜次数</th>
              <th>胜率</th>
            </tr>
          </thead>
          <tbody>
  `;

  Object.entries(stats.combinations)
    .sort((a, b) => {
      const aWinRate = a[1].wins / a[1].matches;
      const bWinRate = b[1].wins / b[1].matches;
      return aWinRate - bWinRate;
    })
    .slice(0, 5)
    .forEach(([combo, data]) => {
      const winRate = (data.wins / data.matches * 100).toFixed(1);
      html += `
        <tr>
          <td>${combo}</td>
          <td>${data.matches}</td>
          <td>${data.wins}</td>
          <td>${winRate}%</td>
        </tr>
      `;
    });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  content.innerHTML = html;
}

// 计算统计数据
function calculateStats(matches) {
  const playerStats = {};
  const combinations = {};

  matches.forEach(match => {
    // 统计个人数据
    [...match.teamA, ...match.teamB].forEach(playerId => {
      if (!playerStats[playerId]) {
        playerStats[playerId] = { matches: 0, wins: 0 };
      }
      playerStats[playerId].matches++;
    });

    // 统计获胜数据
    const winnerTeam = match.winner === 'A' ? match.teamA : match.teamB;
    winnerTeam.forEach(playerId => {
      playerStats[playerId].wins++;
    });

    // 统计队伍组合
    const teamACombo = match.teamA
      .map(id => players[id]?.name || '未知')
      .sort()
      .join(' + ');
    const teamBCombo = match.teamB
      .map(id => players[id]?.name || '未知')
      .sort()
      .join(' + ');

    [teamACombo, teamBCombo].forEach((combo, index) => {
      if (!combinations[combo]) {
        combinations[combo] = { matches: 0, wins: 0 };
      }
      combinations[combo].matches++;

      if ((index === 0 && match.winner === 'A') || (index === 1 && match.winner === 'B')) {
        combinations[combo].wins++;
      }
    });
  });

  return {
    players: playerStats,
    combinations
  };
}
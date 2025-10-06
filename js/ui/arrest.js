// 逮捕榜界面模块

import { players } from './players.js';
import { matches } from '../data/match.js';

// 渲染逮捕榜界面
export async function render() {
  const content = document.getElementById('content');
  if (!content) return;

  if (!players || players.length === 0) {
    content.innerHTML = `
      <div class="section">
        <h2>逮捕榜</h2>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载玩家数据...</div>
        </div>
      </div>
    `;
    return;
  }

  // 创建选手tab导航
  let tabsHtml = '<div class="arrest-tabs">';
  players.forEach((player, index) => {
    const activeClass = index === 0 ? 'active' : '';
    tabsHtml += `<button class="arrest-tab ${activeClass}" onclick="showArrestTab('${player.puuid}')">${player.name}</button>`;
  });
  tabsHtml += '</div>';

  // 创建tab内容容器
  let contentHtml = '<div class="arrest-content">';
  players.forEach((player, index) => {
    const activeClass = index === 0 ? 'active' : '';
    const arrestData = calculateArrestData(player.puuid);

    contentHtml += `
      <div class="arrest-tab-content ${activeClass}" id="arrest-${player.puuid}">
        <div class="arrest-section">
          <h3>${player.name} 逮捕榜单</h3>
          <div class="arrest-list">
            ${renderKillList(arrestData.kills)}
          </div>
        </div>
        <div class="arrest-section">
          <h3>${player.name} 被逮捕榜单</h3>
          <div class="arrest-list">
            ${renderDeathList(arrestData.deaths)}
          </div>
        </div>
      </div>
    `;
  });
  contentHtml += '</div>';

  content.innerHTML = `
    <div class="section">
      <h2>🔫 逮捕榜</h2>
      ${tabsHtml}
      ${contentHtml}
    </div>
  `;
}

// 计算逮捕数据
function calculateArrestData(playerPuuid) {
  const killCounts = {};
  const deathCounts = {};

  console.log('=== 逮捕榜数据计算调试 ===');
  console.log('目标玩家PUUID:', playerPuuid);
  console.log('比赛数据数量:', matches ? matches.length : 0);

  if (!matches || matches.length === 0) {
    console.log('没有比赛数据');
    return { kills: [], deaths: [] };
  }

  let totalKills = 0;
  matches.forEach((match, matchIndex) => {
    console.log(`比赛 ${matchIndex + 1}:`, match);

    // 检查是否有击杀数据数组
    if (!match.kills || !Array.isArray(match.kills)) {
      console.log(`比赛 ${matchIndex + 1} 没有击杀数据或格式错误`);
      return;
    }

    console.log(`比赛 ${matchIndex + 1} 击杀数据数量:`, match.kills.length);
    totalKills += match.kills.length;

    match.kills.forEach(kill => {
      const killerPuuid = kill.killer_puuid;
      const victimPuuid = kill.victim_puuid;

      // 记录该玩家击杀其他人的次数
      if (killerPuuid === playerPuuid && victimPuuid !== playerPuuid) {
        killCounts[victimPuuid] = (killCounts[victimPuuid] || 0) + 1;
        console.log(`${getPlayerName(playerPuuid)} 击杀了 ${getPlayerName(victimPuuid)}`);
      }

      // 记录该玩家被其他人击杀的次数
      if (victimPuuid === playerPuuid && killerPuuid !== playerPuuid) {
        deathCounts[killerPuuid] = (deathCounts[killerPuuid] || 0) + 1;
        console.log(`${getPlayerName(playerPuuid)} 被 ${getPlayerName(killerPuuid)} 击杀`);
      }
    });
  });

  console.log('总击杀数据:', totalKills);
  console.log('该玩家击杀统计:', killCounts);
  console.log('该玩家被击杀统计:', deathCounts);

  // 转换为排序数组
  const kills = Object.entries(killCounts)
    .map(([puuid, count]) => ({
      puuid,
      name: getPlayerName(puuid),
      count
    }))
    .sort((a, b) => b.count - a.count);

  const deaths = Object.entries(deathCounts)
    .map(([puuid, count]) => ({
      puuid,
      name: getPlayerName(puuid),
      count
    }))
    .sort((a, b) => b.count - a.count);

  console.log('最终击杀榜单:', kills);
  console.log('最终被击杀榜单:', deaths);

  return { kills, deaths };
}

// 获取玩家名字
function getPlayerName(puuid) {
  const player = players.find(p => p.puuid === puuid);
  return player ? player.name : 'Unknown';
}

// 渲染击杀列表
function renderKillList(kills) {
  if (kills.length === 0) {
    return '<p class="no-data">暂无击杀数据</p>';
  }

  return kills.map((kill, index) => `
    <div class="arrest-item">
      <span class="rank">#${index + 1}</span>
      <span class="player-name">${kill.name}</span>
      <span class="count">${kill.count} 次击杀</span>
    </div>
  `).join('');
}

// 渲染被击杀列表
function renderDeathList(deaths) {
  if (deaths.length === 0) {
    return '<p class="no-data">暂无被击杀数据</p>';
  }

  return deaths.map((death, index) => `
    <div class="arrest-item">
      <span class="rank">#${index + 1}</span>
      <span class="player-name">${death.name}</span>
      <span class="count">被击杀 ${death.count} 次</span>
    </div>
  `).join('');
}

// 显示特定选手的逮捕榜tab
window.showArrestTab = function(puuid) {
  // 移除所有活动状态
  document.querySelectorAll('.arrest-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.arrest-tab-content').forEach(content => content.classList.remove('active'));

  // 添加活动状态
  document.querySelector(`button[onclick="showArrestTab('${puuid}')"]`)?.classList.add('active');
  document.getElementById(`arrest-${puuid}`)?.classList.add('active');
};
// 义父母榜界面模块

import { players } from './players.js';
import { getMatches } from '../data/match.js';

// 渲染义父母榜界面
export async function render() {
  const content = document.getElementById('content');
  if (!content) return;

  if (!players || players.length === 0) {
    content.innerHTML = `
      <div class="section">
        <h2>义父母榜</h2>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px;">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载玩家数据...</div>
        </div>
      </div>
    `;
    return;
  }

  // 创建选手tab导航
  let tabsHtml = '<div class="godfather-tabs">';
  players.forEach((player, index) => {
    const activeClass = index === 0 ? 'active' : '';
    tabsHtml += `<button class="godfather-tab ${activeClass}" onclick="showGodfatherTab('${player.puuid}')">${player.name}</button>`;
  });
  tabsHtml += '</div>';

  // 创建tab内容容器
  let contentHtml = '<div class="godfather-content">';
  players.forEach((player, index) => {
    const activeClass = index === 0 ? 'active' : '';
    const assistData = calculateAssistData(player.puuid);

    contentHtml += `
      <div class="godfather-tab-content ${activeClass}" id="godfather-${player.puuid}">
        <div class="godfather-section">
          <h3>${player.name} 协助他人榜单</h3>
          <div class="godfather-list">
            ${renderAssistList(assistData.assists)}
          </div>
        </div>
        <div class="godfather-section">
          <h3>${player.name} 被协助榜单</h3>
          <div class="godfather-list">
            ${renderAssistedList(assistData.assisted)}
          </div>
        </div>
      </div>
    `;
  });
  contentHtml += '</div>';

  content.innerHTML = `
    <div class="section">
      <h2>👑 义父母榜</h2>
      ${tabsHtml}
      ${contentHtml}
    </div>
  `;
}

// 计算协助数据
function calculateAssistData(playerPuuid) {
  const assistCounts = {};
  const assistedCounts = {};

  const matches = getMatches();

  if (!matches || matches.length === 0) {
    return { assists: [], assisted: [] };
  }

  matches.forEach(match => {
    // 检查是否有击杀数据数组
    if (!match.kills || !Array.isArray(match.kills)) return;

    match.kills.forEach(kill => {
      const killerPuuid = kill.killer_puuid;
      const victimPuuid = kill.victim_puuid;
      const assistants = kill.assistants || [];

      // 计算该玩家协助其他人的次数
      assistants.forEach(assistant => {
        if (assistant.assistant_puuid === playerPuuid && killerPuuid !== playerPuuid) {
          // 该玩家协助了击杀者
          assistCounts[killerPuuid] = (assistCounts[killerPuuid] || 0) + 1;
        }
      });

      // 计算该玩家被其他人协助的次数
      if (killerPuuid === playerPuuid) {
        assistants.forEach(assistant => {
          if (assistant.assistant_puuid !== playerPuuid) {
            // 其他人协助该玩家击杀
            assistedCounts[assistant.assistant_puuid] = (assistedCounts[assistant.assistant_puuid] || 0) + 1;
          }
        });
      }
    });
  });

  // 转换为排序数组
  const assists = Object.entries(assistCounts)
    .map(([puuid, count]) => ({
      puuid,
      name: getPlayerName(puuid),
      count
    }))
    .sort((a, b) => b.count - a.count);

  const assisted = Object.entries(assistedCounts)
    .map(([puuid, count]) => ({
      puuid,
      name: getPlayerName(puuid),
      count
    }))
    .sort((a, b) => b.count - a.count);

  return { assists, assisted };
}

// 获取玩家名字
function getPlayerName(puuid) {
  const player = players.find(p => p.puuid === puuid);
  return player ? player.name : 'Unknown';
}

// 渲染协助列表
function renderAssistList(assists) {
  if (assists.length === 0) {
    return '<p class="no-data">暂无协助数据</p>';
  }

  return assists.map((assist, index) => `
    <div class="godfather-item">
      <span class="rank">#${index + 1}</span>
      <span class="player-name">${assist.name}</span>
      <span class="count">协助 ${assist.count} 次</span>
    </div>
  `).join('');
}

// 渲染被协助列表
function renderAssistedList(assisted) {
  if (assisted.length === 0) {
    return '<p class="no-data">暂无被协助数据</p>';
  }

  return assisted.map((assist, index) => `
    <div class="godfather-item">
      <span class="rank">#${index + 1}</span>
      <span class="player-name">${assist.name}</span>
      <span class="count">协助了 ${assist.count} 次</span>
    </div>
  `).join('');
}

// 显示特定选手的义父母榜tab
window.showGodfatherTab = function(puuid) {
  // 移除所有活动状态
  document.querySelectorAll('.godfather-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.godfather-tab-content').forEach(content => content.classList.remove('active'));

  // 添加活动状态
  document.querySelector(`button[onclick="showGodfatherTab('${puuid}')"]`)?.classList.add('active');
  document.getElementById(`godfather-${puuid}`)?.classList.add('active');
};
// 比赛记录界面模块
import { players } from './players.js';
import { addMatchData, deleteMatchData, getMatches } from '../data/match.js';
import { saveToGithub } from '../api/github.js';

// 比赛选择状态
let selA = [], selB = [], winner = "A";

// 切换玩家选择
function togglePick(team, id) {
  const sel = team === 'A' ? selA : selB;
  const idx = sel.indexOf(id);
  if (idx !== -1) {
    sel.splice(idx, 1);
  } else {
    sel.push(id);
  }
  render();
}

// 添加比赛记录
function addMatch() {
  if (selA.length === 0 || selB.length === 0) {
    alert("请选择队伍成员");
    return;
  }

  const match = {
    id: Date.now(),
    teamA: [...selA],
    teamB: [...selB],
    winner,
    date: new Date().toLocaleString()
  };

  addMatchData(match);
  selA = [];
  selB = [];
  winner = "A";
  render();
}

// 删除比赛记录
function deleteMatch(i) {
  if (!confirm("确定删除这场比赛记录？")) return;
  deleteMatchData(i);
  render();
}

// 保存到 GitHub
async function save() {
  try {
    await saveToGithub(players, getMatches());
    alert("保存成功！");
  } catch (error) {
    console.error("保存失败:", error);
    alert("保存失败，请查看控制台了解详情");
  }
}

// 渲染比赛记录界面
export function render() {
  const content = document.getElementById('content');
  if (!content) return;

  let html = `
    <div class="section">
      <h2>记录对局</h2>

      <div class="match-setup">
        <div class="team-selection">
          <h3>队伍 A</h3>
          <div class="players-grid">
  `;

  players.forEach((player, i) => {
    const selected = selA.includes(i);
    html += `
      <button class="player-btn ${selected ? 'selected' : ''}"
              onclick="window.uiMatch.togglePick('A', ${i})">
        ${player.name}
      </button>
    `;
  });

  html += `
          </div>
        </div>

        <div class="team-selection">
          <h3>队伍 B</h3>
          <div class="players-grid">
  `;

  players.forEach((player, i) => {
    const selected = selB.includes(i);
    html += `
      <button class="player-btn ${selected ? 'selected' : ''}"
              onclick="window.uiMatch.togglePick('B', ${i})">
        ${player.name}
      </button>
    `;
  });

  html += `
          </div>
        </div>
      </div>

      <div class="winner-selection">
        <h3>获胜队伍</h3>
        <label>
          <input type="radio" name="winner" value="A" ${winner === 'A' ? 'checked' : ''}
                 onchange="window.uiMatch.setWinner('A')"> 队伍 A
        </label>
        <label>
          <input type="radio" name="winner" value="B" ${winner === 'B' ? 'checked' : ''}
                 onchange="window.uiMatch.setWinner('B')"> 队伍 B
        </label>
      </div>

      <div class="match-actions">
        <button onclick="window.uiMatch.add()">📝 记录比赛</button>
        <button onclick="window.uiMatch.save()">💾 保存到GitHub</button>
      </div>

      <div class="match-history">
        <h3>比赛历史</h3>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>队伍 A</th>
              <th>队伍 B</th>
              <th>获胜</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
  `;

  const matches = getMatches();
  matches.forEach((match, i) => {
    const teamANames = match.teamA.map(id => players[id]?.name || '未知').join(', ');
    const teamBNames = match.teamB.map(id => players[id]?.name || '未知').join(', ');

    html += `
      <tr>
        <td>${match.date}</td>
        <td>${teamANames}</td>
        <td>${teamBNames}</td>
        <td>队伍 ${match.winner}</td>
        <td><button onclick="window.uiMatch.deleteMatch(${i})">🗑️ 删除</button></td>
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

// 设置获胜队伍
function setWinner(team) {
  winner = team;
}

// 导出给全局使用
if (typeof window !== 'undefined') {
  window.uiMatch = {
    togglePick,
    add: addMatch,
    deleteMatch,
    save,
    setWinner
  };
}
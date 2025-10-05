// 玩家管理界面模块
import { config } from '../config.js';
import { uploadFileToGithub, saveToGithub } from '../api/github.js';
import { getMatches } from '../data/match.js';

// 玩家数据
export let players = [];
let avatarFiles = {};

// 设置玩家数据
export function setPlayers(newPlayers) {
  players = newPlayers;
}

// 添加玩家
function addPlayer() {
  const name = prompt("玩家昵称:");
  if (!name || !name.trim()) return;
  players.push({ name: name.trim(), avatar: "" });
  render();
}

// 删除玩家
function deletePlayer(index) {
  if (!confirm(`确定删除玩家 ${players[index].name}？`)) return;
  players.splice(index, 1);
  delete avatarFiles[index];
  render();
}

// 获取头像
async function fetchAvatar(filePath) {
  if (!filePath) return "";
  try {
    const url = `https://api.github.com/repos/${config.repo}/contents/${filePath}?ref=${config.branch}`;
    const res = await fetch(url, { headers: { Authorization: `token ${config.token}` } });
    if (res.ok) {
      const data = await res.json();
      return `data:image/png;base64,${data.content}`;
    }
  } catch (error) {
    console.error("加载头像失败:", error);
  }
  return "";
}

// 上传头像
function uploadAvatar(idx, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("请选择图片文件");
    return;
  }
  avatarFiles[idx] = file;
  const reader = new FileReader();
  reader.onload = e => {
    players[idx].avatar = e.target.result;
    render();
  };
  reader.readAsDataURL(file);
}

// 保存到 GitHub
async function save() {
  try {
    // 上传所有新头像
    const promises = [];
    for (const [idx, file] of Object.entries(avatarFiles)) {
      if (file && players[idx]) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `src/avatars/${fileName}`;
        promises.push(
          uploadFileToGithub(config.token, filePath, file).then(result => {
            players[idx].avatarPath = filePath;
          }).catch(error => {
            console.error(`上传头像失败 (${fileName}):`, error);
          })
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log("头像上传完成");
    }

    // 保存数据
    await saveToGithub(players, getMatches());
    avatarFiles = {};
    alert("保存成功！");
  } catch (error) {
    console.error("保存失败:", error);
    alert("保存失败，请查看控制台了解详情");
  }
}

// 渲染玩家管理界面
export function render() {
  const content = document.getElementById('content');
  if (!content) return;

  let html = `
    <div class="section">
      <h2>选手管理</h2>
      <button onclick="window.uiPlayers.add()">➕ 添加选手</button>
      <button onclick="window.uiPlayers.save()">💾 保存到GitHub</button>
      <table>
        <thead>
          <tr>
            <th>序号</th>
            <th>昵称</th>
            <th>头像</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    html += `
      <tr>
        <td>${i + 1}</td>
        <td><input type="text" value="${player.name}" onchange="window.uiPlayers.updateName(${i}, this.value)"></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${player.avatar ? `<img src="${player.avatar}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` : '<span style="color: #666;">无头像</span>'}
            <input type="file" accept="image/*" onchange="window.uiPlayers.uploadAvatar(${i}, this.files[0])">
          </div>
        </td>
        <td><button onclick="window.uiPlayers.deletePlayer(${i})">🗑️ 删除</button></td>
      </tr>
    `;
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  content.innerHTML = html;

  // 异步加载已保存的头像
  players.forEach(async (player, idx) => {
    if (player.avatarPath && !player.avatar) {
      const avatarUrl = await fetchAvatar(player.avatarPath);
      if (avatarUrl) {
        player.avatar = avatarUrl;
        render();
      }
    }
  });
}

// 更新玩家名称
function updateName(index, value) {
  players[index].name = value;
}

// 导出给全局使用
if (typeof window !== 'undefined') {
  window.uiPlayers = {
    add: addPlayer,
    deletePlayer,
    uploadAvatar,
    save,
    updateName
  };
}
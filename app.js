// ---------- 配置 ----------
const repo = "LZWuuu/valorant-updater";
const branch = "main";
const path = "data.json";
const token = "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";
const userDataPath = "src/user.json";
const henrikapiKey = "HDEV-576c931f-2755-4956-ada1-700b15d77703";

let players = [];
let matches = [];
let selA = [], selB = [], winner = "A";

// ---------- GitHub 读取 ----------
async function loadDataWithToken() {
  try {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, { headers: { Authorization: `token ${token}` } });

    if (!res.ok) {
      console.error('GitHub API错误:', res.status, res.statusText);
      if (res.status === 401) {
        alert('GitHub Token无效或已过期，请检查token权限');
      } else if (res.status === 404) {
        console.log('data.json文件不存在，使用默认数据');
        players = [];
        matches = [];
        renderPlayers();
      }
      return;
    }

    const data = await res.json();

    if (!data.content) {
      console.error('GitHub API没有返回content字段');
      players = [];
      matches = [];
      renderPlayers();
      return;
    }

    const cleanedContent = data.content.replace(/\s/g, '');
    const bytes = Uint8Array.from(atob(cleanedContent), c => c.charCodeAt(0));
    const jsonStr = new TextDecoder("utf-8").decode(bytes);
    const parsed = JSON.parse(jsonStr);

    players = Array.isArray(parsed.players) ? parsed.players : [];
    matches = Array.isArray(parsed.matches) ? parsed.matches : [];
    renderPlayers();
  } catch (error) {
    console.error('加载数据失败:', error);
    players = [];
    matches = [];
    renderPlayers();
  }
}

// ---------- GitHub 写入 ----------
async function uploadFileToGithub(token, filePath, file) {
  let sha = undefined;
  const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
    headers: { Authorization: `token ${token}` }
  });
  if (checkRes.ok) {
    const { sha: existingSha } = await checkRes.json();
    sha = existingSha;
  }

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async e => {
      const content = btoa(e.target.result);
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
        method: "PUT",
        headers: {
          "Authorization": `token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Upload avatar " + filePath,
          content,
          sha,
          branch
        })
      });
      if (res.ok) {
        resolve(`${filePath}`);
      } else {
        reject(await res.json());
      }
    };
    reader.readAsBinaryString(file);
  });
}

async function saveToGithub() {
  const token = prompt("请输入 GitHub Token（必须有 repo 写权限）:");
  if (!token) return;

  for (const [id, file] of Object.entries(avatarFiles)) {
    const pathAvatar = `avatars/${id}_${file.name}`;
    try {
      const url = await uploadFileToGithub(token, pathAvatar, file);
      const player = players.find(p => p.id === id);
      if (player) player.avatar = url;
    } catch (err) {
      console.error("上传头像失败:", err);
      alert("❌ 上传头像失败: " + (err.message || JSON.stringify(err)));
    }
  }
  avatarFiles = {};

  const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
    headers: { Authorization: `token ${token}` }
  });
  if (!getRes.ok) {
    const err = await getRes.json();
    alert("获取 data.json 失败: " + (err.message || getRes.status));
    return;
  }
  const { sha } = await getRes.json();

  const newData = { players, matches };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(newData, null, 2))));

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update match data",
      content: encoded,
      sha,
      branch
    })
  });

  const out = await res.json();
  if (res.ok) {
    alert("✅ 已保存到 GitHub");
  } else {
    alert("❌ 保存失败: " + res.status + " " + (out.message || ""));
  }
}

// ---------- Tab 切换 ----------
function showTab(tab) {
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  document.getElementById("tab_" + tab).classList.add("active");
  if (tab === "players") renderPlayers();
  if (tab === "match") renderMatch();
  if (tab === "stats") renderStats();
  if (tab === "sync") renderSync();
}

// ---------- 玩家管理 ----------
function addPlayer() {
  if (!Array.isArray(players)) players = [];
  const newId = Date.now().toString();
  players.push({ id: newId, name: "新玩家", wins: 0, losses: 0, avatar: "" });
  renderPlayers();
}

function deletePlayer(index) {
  if (confirm("确定要删除这个选手吗？")) {
    players.splice(index, 1);
    renderPlayers();
  }
}

window.deletePlayer = deletePlayer;

let avatarFiles = {};

async function fetchAvatar(filePath) {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
  const res = await fetch(url, { headers: { Authorization: `token ${token}` } });
  if (!res.ok) {
    console.error("头像请求失败:", res.status, res.statusText);
    return 'https://via.placeholder.com/40';
  }
  const data = await res.json();
  if (!data.content) {
    console.error("API 没有返回 content:", data);
    return 'https://via.placeholder.com/40';
  }
  return "data:image/png;base64," + data.content;
}

function uploadAvatar(idx, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    players[idx].avatar = e.target.result;
    avatarFiles[players[idx].id] = file;
    renderPlayers();
  };
  reader.readAsDataURL(file);
}

function renderPlayers() {
  const c = document.getElementById("content");
  c.innerHTML = "";

  if (!players || players.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "card";
    emptyDiv.innerText = "暂无玩家，请点击下方按钮添加";
    c.appendChild(emptyDiv);
  }

  const tip = document.createElement("p");
  tip.className = "small";
  tip.innerText = "⚠️ 注意：修改玩家后需要点击【保存当前数据到 GitHub】上传，否则其他人看不到";
  c.appendChild(tip);

  const tip2 = document.createElement("p");
  tip2.className = "small";
  tip2.innerText = "⚠️ 注意：头像文件需小于 1MB";
  c.appendChild(tip2);

  players.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "card";
    let avatarSrc = "https://via.placeholder.com/40";
    if (p.avatar && p.avatar.startsWith("avatars/")) {
      fetchAvatar(p.avatar).then(url => {
        const imgEl = div.querySelector("#avatar_" + p.id);
        if (imgEl) imgEl.src = url;
      });
    } else if (p.avatar) {
      avatarSrc = p.avatar;
    }

    div.innerHTML = `
      <img id="avatar_${p.id}" class="avatar" src=${avatarSrc}>
      <input value="${p.name}" onchange="window.players[${i}].name=this.value; renderPlayers()"><br>
      <span class="small">胜 ${p.wins || 0} / 负 ${p.losses || 0}</span><br>
      <input type="file" accept="image/*" onchange="uploadAvatar(${i},this.files[0])"><br>
      <button onclick="deletePlayer(${i})">删除选手</button>
    `;

    c.appendChild(div);
  });

  const addBtn = document.createElement("button");
  addBtn.innerText = "➕ 添加选手";
  addBtn.onclick = () => addPlayer();
  c.appendChild(addBtn);
}

// ---------- 对局记录 ----------
function togglePick(team, id) {
  let arr = team === "A" ? selA : selB;
  if (arr.includes(id)) arr.splice(arr.indexOf(id), 1);
  else if (arr.length < 4 && !selA.concat(selB).includes(id)) arr.push(id);
  renderMatch();
}

function addMatch() {
  if (selA.length !== 4 || selB.length !== 4) return alert("必须选择两支4人队伍");
  const m = { id: Date.now(), teamA: [...selA], teamB: [...selB], winner };
  matches.unshift(m);
  m.teamA.forEach(id => { const p = players.find(x => x.id === id); if (winner === "A") p.wins++; else p.losses++; });
  m.teamB.forEach(id => { const p = players.find(x => x.id === id); if (winner === "B") p.wins++; else p.losses++; });
  selA = []; selB = []; winner = "A";
  renderMatch();
  alert("⚠️ 已添加对局，请点击【保存数据到 GitHub】上传，否则其他人看不到");
}

function deleteMatch(i) {
  if (confirm("确定要删除这场对局吗？")) {
    matches.splice(i, 1);
    renderMatch();
  }
}

function renderMatch() {
  const c = document.getElementById("content");
  c.innerHTML = "";

  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <h3>选择队伍</h3>
    <div>
      <b>A队</b><br>
      ${players.map(p =>
        `<span class="player-btn ${selA.includes(p.id) ? 'selected' : ''}"
          onclick="togglePick('A','${p.id}')">${p.name}</span>`
      ).join(" ")}
    </div>
    <div>
      <b>B队</b><br>
      ${players.map(p =>
        `<span class="player-btn ${selB.includes(p.id) ? 'selected' : ''}"
          onclick="togglePick('B','${p.id}')">${p.name}</span>`
      ).join(" ")}
    </div>
    <p>
      胜者:
      <label><input type="radio" name="win" ${winner === "A" ? "checked" : ""} onchange="window.winner='A'">A队</label>
      <label><input type="radio" name="win" ${winner === "B" ? "checked" : ""} onchange="window.winner='B'">B队</label>
    </p>
    <button onclick="addMatch()">保存对局</button>
    <p class="small">⚠️ 注意：添加对局后需要点击【保存数据到 GitHub】上传，否则其他人看不到</p>
  `;
  c.appendChild(div);

  const listTitle = document.createElement("h3");
  listTitle.innerText = "最近对局";
  c.appendChild(listTitle);

  matches.forEach((m, idx) => {
    const d = document.createElement("div");
    d.className = "card small";

    const teamA = m.teamA.map(id => players.find(p => p.id === id)?.name || "未知").join(", ");
    const teamB = m.teamB.map(id => players.find(p => p.id === id)?.name || "未知").join(", ");

    d.innerHTML = `
      <div><b>${new Date(m.id).toLocaleString()}</b></div>
      <div>A队: ${teamA}</div>
      <div>B队: ${teamB}</div>
      <div>胜者: ${m.winner}</div>
      <button onclick="deleteMatch(${idx})">删除该对局</button>
    `;
    c.appendChild(d);
  });
}

// ---------- 统计功能 ----------
function renderStats() {
  const c = document.getElementById("content");
  c.innerHTML = "<h2>个人统计（按胜率排序）</h2>";

  const sortedPlayers = [...players].map(p => {
    const total = p.wins + p.losses;
    const wr = total ? p.wins / total : 0;
    return { ...p, total, wr };
  }).sort((a, b) => b.wr - a.wr || b.total - a.total);

  const table = document.createElement("table");
  table.innerHTML = `
    <tr><th>排名</th><th>玩家</th><th>对局</th><th>胜</th><th>负</th><th>胜率</th></tr>
    ${sortedPlayers.map((p, idx) => {
      const wrPercent = Math.round(p.wr * 100);
      return `<tr>
        <td>${idx + 1}</td>
        <td>${p.name}</td>
        <td>${p.total}</td>
        <td>${p.wins}</td>
        <td>${p.losses}</td>
        <td>${wrPercent}%</td>
      </tr>`;
    }).join("")}
  `;
  c.appendChild(table);

  // 组合统计
  const comboStats = {};
  function addCombo(ids, win) {
    const key = ids.sort().join("-");
    if (!comboStats[key]) comboStats[key] = { played: 0, wins: 0, ids: [...ids] };
    comboStats[key].played++;
    if (win) comboStats[key].wins++;
  }

  function combinations(arr, k) {
    if (k === 1) return arr.map(x => [x]);
    if (k === arr.length) return [arr];
    let res = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const head = arr[i];
      const tail = combinations(arr.slice(i + 1), k - 1);
      tail.forEach(t => res.push([head, ...t]));
    }
    return res;
  }

  matches.forEach(m => {
    combinations(m.teamA, 2).forEach(cmb => addCombo(cmb, m.winner === "A"));
    combinations(m.teamA, 3).forEach(cmb => addCombo(cmb, m.winner === "A"));
    combinations(m.teamB, 2).forEach(cmb => addCombo(cmb, m.winner === "B"));
    combinations(m.teamB, 3).forEach(cmb => addCombo(cmb, m.winner === "B"));
  });

  const combos = Object.values(comboStats)
    .filter(c => c.played >= 2)
    .map(c => ({ ...c, wr: c.wins / c.played }))
    .sort((a, b) => b.wr - a.wr || b.played - a.played);

  if (combos.length > 0) {
    const bestWr = combos[0].wr;
    const bestCombos = combos.filter(c => c.wr === bestWr);

    const bestDiv = document.createElement("div");
    bestDiv.className = "card";
    bestDiv.innerHTML = "<b>最佳组合：</b><br>" +
      bestCombos.map(c => {
        const names = c.ids.map(id => players.find(p => p.id === id).name).join(" + ");
        return `${names} → ${(c.wr * 100).toFixed(1)}% (${c.wins}/${c.played})`;
      }).join("<br>");
    c.appendChild(bestDiv);

    const worstWr = combos[combos.length - 1].wr;
    const worstCombos = combos.filter(c => c.wr === worstWr);

    const worstDiv = document.createElement("div");
    worstDiv.className = "card";
    worstDiv.innerHTML = "<b>最差组合：</b><br>" +
      worstCombos.map(c => {
        const names = c.ids.map(id => players.find(p => p.id === id).name).join(" + ");
        return `${names} → ${(c.wr * 100).toFixed(1)}% (${c.wins}/${c.played})`;
      }).join("<br>");
    c.appendChild(worstDiv);
  }
}

// ---------- GitHub 同步 Tab ----------
function renderSync() {
  const c = document.getElementById("content");
  c.innerHTML = `
    <div class="card">
      <h2>GitHub 同步</h2>
      <button onclick="const t=prompt('请输入 GitHub Token'); if(t) loadDataWithToken(t)">从 GitHub 拉取最新数据</button>
      <button onclick="saveToGithub()">保存当前数据到 GitHub</button>
      <p class="small">⚠️ 写入需要输入 GitHub Token（必须对本仓库有写权限）。</p>
    </div>
  `;
}

// ---------- 用户数据更新 ----------
async function updateUserData() {
  try {
    const userDataRes = await fetch(`https://api.github.com/repos/${repo}/contents/${userDataPath}?ref=${branch}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!userDataRes.ok) {
      console.log("user.json not found on GitHub, skipping update");
      return;
    }

    const userData = await userDataRes.json();
    const userJson = JSON.parse(atob(userData.content));

    const matchListUrl = `https://api.henrikdev.xyz/valorant/v3/matches/eu/SuperLulino/4088?mode=custom`;
    const matchRes = await fetch(matchListUrl, {
      headers: { "Authorization": henrikapiKey }
    });

    if (!matchRes.ok) return;

    const matchData = await matchRes.json();
    const userPuuids = userJson.players.map(p => p.puuid);

    if (matchData.data && Array.isArray(matchData.data)) {
      for (const match of matchData.data) {
        if (match.metadata?.mode === "custom" || match.metadata?.mode_id === "custom") {
          const matchPlayers = match.players?.all_players || [];
          const matchPuuids = matchPlayers.map(p => p.puuid);

          const allPuuidsMatch = userPuuids.every(puuid => matchPuuids.includes(puuid));

          if (allPuuidsMatch && matchPuuids.length === 8) {
            userJson.newestMatchID = match.metadata.matchid;

            userJson.players = userJson.players.map(player => {
              const matchPlayer = matchPlayers.find(p => p.puuid === player.puuid);
              if (matchPlayer) {
                player.name = matchPlayer.name;
                player.tag = matchPlayer.tag;
                player.card = matchPlayer.assets?.card?.small || "";
              }
              return player;
            });

            await saveUserData(userJson, userData.sha);
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating user data:", error);
  }
}

async function saveUserData(userJson, sha) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(userJson, null, 4))));

  await fetch(`https://api.github.com/repos/${repo}/contents/${userDataPath}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update user data",
      content: encoded,
      sha: sha,
      branch: branch
    })
  });
}

// ---------- 全局变量和函数暴露 ----------
window.showTab = showTab;
window.addPlayer = addPlayer;
window.deletePlayer = deletePlayer;
window.uploadAvatar = uploadAvatar;
window.togglePick = togglePick;
window.addMatch = addMatch;
window.deleteMatch = deleteMatch;
window.saveToGithub = saveToGithub;
window.loadDataWithToken = loadDataWithToken;
window.players = players;
window.matches = matches;
window.selA = selA;
window.selB = selB;
window.winner = winner;

// ---------- 初始化 ----------
addEventListener('DOMContentLoaded', async () => {
  await updateUserData();
  await loadDataWithToken();
  document.getElementById('tab_players')?.click();
});
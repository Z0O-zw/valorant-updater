// ---------- 配置 ----------
let config = {
  repo: "LZWuuu/valorant-updater",
  branch: "main",
  path: "data.json",
  token: "",
  userDataPath: "src/user.json",
  matchDataPath: "src/match.json",
  henrikapiKey: "",
  henrikapiProxy: "/api/henrik"
};

let players = [];
let matches = [];
let selA = [], selB = [], winner = "A";

// 从 API 获取配置
async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      config = await response.json();
      console.log('配置加载成功');
    } else {
      console.error('无法加载配置，使用默认值');
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// ---------- GitHub 读取 ----------
async function loadDataWithToken() {
  try {
    const url = `https://api.github.com/repos/${config.repo}/contents/${config.path}?ref=${config.branch}`;
    const res = await fetch(url, { headers: { Authorization: `token ${config.token}` } });

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
  const checkRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${filePath}?ref=${config.branch}`, {
    headers: { Authorization: `token ${config.token}` }
  });
  if (checkRes.ok) {
    const { sha: existingSha } = await checkRes.json();
    sha = existingSha;
  }

  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async e => {
      const arrayBuffer = e.target.result;
      const bytes = new Uint8Array(arrayBuffer);
      const content = btoa(String.fromCharCode(...bytes));
      const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/${filePath}`, {
        method: "PUT",
        headers: {
          "Authorization": `token ${config.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Upload avatar " + filePath,
          content,
          sha,
          branch: config.branch
        })
      });
      if (res.ok) {
        resolve(`${filePath}`);
      } else {
        reject(await res.json());
      }
    };
    reader.readAsArrayBuffer(file);
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

  const getRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.path}?ref=${config.branch}`, {
    headers: { Authorization: `token ${token}` }
  });
  if (!getRes.ok) {
    const err = await getRes.json();
    alert("获取 data.json 失败: " + (err.message || getRes.status));
    return;
  }
  const { sha } = await getRes.json();

  const newData = { players, matches };
  // 正确的编码方式：支持 UTF-8 字符（包括中文、日文等）
  const jsonString = JSON.stringify(newData, null, 2);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));

  const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.path}`, {
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
  const url = `https://api.github.com/repos/${config.repo}/contents/${filePath}?ref=${config.branch}`;
  const res = await fetch(url, { headers: { Authorization: `token ${config.token}` } });
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

// ---------- 用户数据和比赛数据更新 ----------
async function updateUserData() {
  // 显示加载指示器
  showLoadingIndicator(true);

  try {
    console.log("📥 开始检查数据更新...");

    // =========================
    // 第一步：并行获取所有需要的数据
    // =========================

    // 1.1 准备所有的 fetch 请求
    const fetchPromises = [];

    // user.json 请求
    fetchPromises.push(
      fetch(`https://api.github.com/repos/${config.repo}/contents/${config.userDataPath}?ref=${config.branch}`, {
        headers: { Authorization: `token ${config.token}` }
      })
    );

    // Henrik API 请求（比赛列表）
    const matchListUrl = `${config.henrikapiProxy || '/api/henrik'}?name=SuperLulino&tag=4088&region=eu&mode=custom&size=8`;
    fetchPromises.push(fetch(matchListUrl));

    // 1.2 并行执行所有请求
    console.log("🔄 正在并行获取数据...");
    const [userDataRes, matchRes] = await Promise.all(fetchPromises);

    // =========================
    // 第二步：解析响应数据
    // =========================

    // 2.1 解析 user.json
    if (!userDataRes.ok) {
      console.log("⚠️ user.json not found on GitHub, skipping update");
      return;
    }

    let userJson;
    try {
      const userData = await userDataRes.json();
      const decodedUserContent = atob(userData.content.replace(/\s/g, ''));
      console.log("📄 解码后的 user.json 内容长度:", decodedUserContent.length);

      if (decodedUserContent.trim() === '') {
        console.error("❌ user.json 文件为空");
        return;
      }

      userJson = JSON.parse(decodedUserContent);
      console.log("👥 user.json 中有", userJson.players?.length || 0, "个玩家");
    } catch (error) {
      console.error("❌ 解析 user.json 失败:", error);
      return;
    }

    const userPuuids = userJson.players.map(p => p.puuid);

    // 2.2 解析比赛列表
    if (!matchRes.ok) {
      console.log("❌ Henrik API请求失败:", matchRes.status);
      throw new Error(`Henrik API响应错误: ${matchRes.status}`);
    }
    const matchData = await matchRes.json();

    console.log("📊 当前最新 Match ID:", userJson.newestMatchID || "无");
    console.log("👥 目标玩家数量:", userPuuids.length);
    console.log("🔍 获取到", matchData.data?.length || 0, "场比赛数据");

    // =========================
    // 第三步：一次性处理所有比赛数据
    // =========================

    if (matchData.data && Array.isArray(matchData.data)) {
      let latestCustomMatch = null;
      const newCustomMatches = [];

      // 3.1 一次遍历，收集所有需要的信息
      for (const match of matchData.data) {
        // 只处理自定义模式
        if (match.metadata?.mode === "custom" || match.metadata?.mode_id === "custom") {
          const matchPlayers = match.players?.all_players || [];
          const matchPuuids = matchPlayers.map(p => p.puuid);

          // 验证是否包含所有8个目标玩家
          const allPuuidsMatch = userPuuids.every(puuid => matchPuuids.includes(puuid));

          if (allPuuidsMatch && matchPuuids.length === 8) {
            // 记录最新的比赛（第一个就是最新的）
            if (!latestCustomMatch) {
              latestCustomMatch = match;
              console.log("🎮 找到最新自定义比赛:", match.metadata.matchid);
            }

            // 检查是否是新比赛（不在现有的 match.json 中）
            const matchExists = matchJson.matches.some(m => m.metadata.matchid === match.metadata.matchid);
            if (!matchExists) {
              newCustomMatches.push(match);
              console.log("🆕 发现新比赛:", match.metadata.matchid);
            }
          }
        }
      }

      // =========================
      // 第四步：根据需要更新数据
      // =========================

      if (latestCustomMatch) {
        const latestMatchId = latestCustomMatch.metadata.matchid;
        const promises = []; // 存储所有更新操作

        // 4.1 检查并准备用户数据更新
        if (latestMatchId !== userJson.newestMatchID) {
          console.log("🔄 需要更新用户数据...");

          // 更新 newestMatchID
          userJson.newestMatchID = latestMatchId;

          // 更新每个玩家的信息（基于最新比赛）
          const matchPlayers = latestCustomMatch.players.all_players;
          let updatedCount = 0;

          userJson.players = userJson.players.map(player => {
            const matchPlayer = matchPlayers.find(p => p.puuid === player.puuid);
            if (matchPlayer) {
              const oldInfo = { name: player.name, tag: player.tag, card: player.card };

              player.name = matchPlayer.name;
              player.tag = matchPlayer.tag;
              player.card = matchPlayer.assets?.card?.small || "";

              // 记录变化
              if (oldInfo.name !== player.name || oldInfo.tag !== player.tag || oldInfo.card !== player.card) {
                console.log(`👤 更新玩家: ${oldInfo.name}#${oldInfo.tag} → ${player.name}#${player.tag}`);
                updatedCount++;
              }
            }
            return player;
          });

          // 添加保存用户数据的 Promise
          promises.push(
            saveUserData(userJson, userData.sha)
              .then(() => console.log(`✅ 用户数据更新完成! (${updatedCount} 个玩家信息更新)`))
          );
        }

        // 4.2 检查并准备比赛数据更新
        if (newCustomMatches.length > 0 || latestMatchId !== userJson.newestMatchID) {
          console.log("🔄 需要更新比赛数据...");
          console.log("   - 新比赛数量:", newCustomMatches.length);
          console.log("   - 当前 userJson.newestMatchID:", userJson.newestMatchID);
          console.log("   - 最新 latestMatchId:", latestMatchId);

          // 更新 newestMatchID
          userJson.newestMatchID = latestMatchId;

          // 保存每场新比赛为单独的文件
          if (newCustomMatches.length > 0) {
            console.log("📝 保存新比赛到 src/match/ 目录...");

            for (const match of newCustomMatches) {
              const matchId = match.metadata.matchid;
              const matchPath = `src/match/${matchId}.json`;

              promises.push(
                saveMatchFile(match, matchPath)
                  .then(() => console.log(`✅ 比赛 ${matchId} 已保存`))
                  .catch(err => {
                    console.error(`❌ 保存比赛 ${matchId} 失败:`, err);
                    throw err;
                  })
              );
            }
          }
        } else {
          console.log("ℹ️ 比赛数据无需更新");
        }

        // 4.3 并行执行所有更新操作
        if (promises.length > 0) {
          await Promise.all(promises);

          // 如果有新比赛被保存，更新 leaderboard
          if (newCustomMatches.length > 0) {
            console.log("🏆 开始更新 leaderboard...");
            try {
              await updateLeaderboard();
            } catch (error) {
              console.error("❌ 更新 leaderboard 失败:", error);
            }
          }
        } else {
          console.log("✅ 所有数据已是最新，无需更新");
        }
      } else {
        console.log("🔍 未找到包含所有目标玩家的自定义比赛");
      }
    }
  } catch (error) {
    console.error("❌ 更新数据时发生错误:", error);
    showErrorMessage("数据更新失败: " + error.message);
  } finally {
    // 隐藏加载指示器
    showLoadingIndicator(false);
  }
}

async function saveUserData(userJson, sha) {
  // 正确的编码方式：支持 UTF-8 字符（包括中文、日文等）
  const jsonString = JSON.stringify(userJson, null, 4);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));

  await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.userDataPath}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update user data",
      content: encoded,
      sha: sha,
      branch: config.branch
    })
  });
}

// ---------- 保存单个比赛文件到 src/match/ 目录 ----------
async function saveMatchFile(matchData, matchPath) {
  // 正确的编码方式：支持 UTF-8 字符
  const jsonString = JSON.stringify(matchData, null, 4);
  const encoded = btoa(unescape(encodeURIComponent(jsonString)));

  // 检查文件是否已存在
  let sha = null;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${matchPath}?ref=${config.branch}`, {
      headers: { "Authorization": `token ${config.token}` }
    });
    if (checkRes.ok) {
      const fileInfo = await checkRes.json();
      sha = fileInfo.sha;
      console.log(`⚠️ 比赛文件 ${matchPath} 已存在，将跳过`);
      return; // 文件已存在，跳过
    }
  } catch (error) {
    // 文件不存在，继续创建
  }

  // 构建请求体
  const requestBody = {
    message: `Save match ${matchData.metadata.matchid}`,
    content: encoded,
    branch: config.branch
  };

  // 只有在文件存在时才需要 sha（虽然这里应该不会发生）
  if (sha) {
    requestBody.sha = sha;
  }

  const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/${matchPath}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${config.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const error = await res.json();
    console.error(`❌ 保存比赛文件 ${matchPath} 失败:`, error);
    throw new Error(`Failed to save match file: ${error.message || res.status}`);
  }

  console.log(`✅ 比赛文件 ${matchPath} 已保存`);
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

// ---------- 加载指示器和错误处理 ----------
function showLoadingIndicator(show) {
  let indicator = document.getElementById('loading-indicator');

  if (show) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'loading-indicator';
      indicator.className = 'loading-indicator';
      indicator.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">🔄 正在检查数据更新...</div>
      `;
      document.body.appendChild(indicator);
    }
    indicator.style.display = 'flex';
  } else {
    if (indicator) {
      indicator.style.display = 'none';
    }
  }
}

function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `❌ ${message}`;
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    document.body.removeChild(errorDiv);
  }, 5000);
}

// ---------- Leaderboard 更新 ----------
async function updateLeaderboard() {
  try {
    console.log("🏆 开始更新 leaderboard...");

    // 1. 加载当前的 leaderboard 数据
    let leaderboardData;
    try {
      const leaderboardRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/src/leaderboard.json?ref=${config.branch}`, {
        headers: { "Authorization": `token ${config.token}` }
      });

      if (leaderboardRes.ok) {
        const leaderboardFile = await leaderboardRes.json();
        const decodedLeaderboardContent = atob(leaderboardFile.content.replace(/\s/g, ''));
        console.log("📄 leaderboard更新: 解码后的 leaderboard.json 内容长度:", decodedLeaderboardContent.length);

        if (decodedLeaderboardContent.trim() === '') {
          console.log("⚠️ leaderboard.json 文件为空，无法更新");
          return;
        }

        leaderboardData = JSON.parse(decodedLeaderboardContent);
        console.log("🏆 leaderboard更新: leaderboard.json 中有", leaderboardData.players?.length || 0, "个玩家");
      } else {
        console.log("leaderboard.json 不存在，使用默认数据");
        return;
      }
    } catch (error) {
      console.error("加载 leaderboard.json 失败:", error);
      return;
    }

    // 2. 加载 src/match/ 目录下的所有比赛文件
    let allMatches = [];
    try {
      // 获取 src/match/ 目录下的文件列表
      const dirRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/src/match?ref=${config.branch}`, {
        headers: { "Authorization": `token ${config.token}` }
      });

      if (dirRes.ok) {
        const files = await dirRes.json();
        console.log(`📊 leaderboard更新: 找到 ${files.length} 个比赛文件`);

        // 并行读取所有比赛文件
        const matchPromises = files
          .filter(file => file.name.endsWith('.json'))
          .map(async (file) => {
            try {
              const fileRes = await fetch(file.url, {
                headers: { "Authorization": `token ${config.token}` }
              });
              if (fileRes.ok) {
                const fileData = await fileRes.json();
                const decodedContent = atob(fileData.content.replace(/\s/g, ''));
                return JSON.parse(decodedContent);
              }
            } catch (error) {
              console.error(`加载比赛文件 ${file.name} 失败:`, error);
              return null;
            }
          });

        const matches = await Promise.all(matchPromises);
        allMatches = matches.filter(match => match !== null);
        console.log(`📊 leaderboard更新: 成功加载 ${allMatches.length} 场比赛`);
      } else {
        console.log("src/match 目录不存在，无法更新 leaderboard");
        return;
      }
    } catch (error) {
      console.error("加载比赛文件失败:", error);
      return;
    }

    // 3. 重置所有统计数据
    leaderboardData.players.forEach(player => {
      player.kills = 0;
      player.deaths = 0;
      player.assists = 0;
      // 重置对位击杀数据
      Object.keys(player.killsAgainst).forEach(puuid => {
        player.killsAgainst[puuid] = 0;
      });
    });

    // 4. 统计所有比赛的击杀数据
    if (allMatches && allMatches.length > 0) {
      allMatches.forEach(match => {
        if (match.rounds && match.rounds.length > 0) {
          match.rounds.forEach(round => {
            if (round.kills && round.kills.length > 0) {
              round.kills.forEach(kill => {
                const killerPuuid = kill.killer_puuid;
                const victimPuuid = kill.victim_puuid;

                // 找到 killer 和 victim 在 leaderboard 中的记录
                const killerPlayer = leaderboardData.players.find(p => p.puuid === killerPuuid);
                const victimPlayer = leaderboardData.players.find(p => p.puuid === victimPuuid);

                if (killerPlayer) {
                  killerPlayer.kills += 1;
                  // 更新对位击杀数据
                  if (killerPlayer.killsAgainst[victimPuuid] !== undefined) {
                    killerPlayer.killsAgainst[victimPuuid] += 1;
                  }
                }

                if (victimPlayer) {
                  victimPlayer.deaths += 1;
                }

                // 处理助攻统计
                if (kill.assistants && kill.assistants.length > 0) {
                  kill.assistants.forEach(assistant => {
                    const assistantPuuid = assistant.assistant_puuid;
                    const assistantPlayer = leaderboardData.players.find(p => p.puuid === assistantPuuid);

                    if (assistantPlayer) {
                      assistantPlayer.assists += 1;
                    }
                  });
                }
              });
            }
          });
        }
      });
    }

    // 5. 保存更新后的 leaderboard 数据
    await saveLeaderboardData(leaderboardData);
    console.log("✅ leaderboard.json 更新完成");

  } catch (error) {
    console.error("❌ 更新 leaderboard 失败:", error);
    throw error;
  }
}

async function saveLeaderboardData(leaderboardData) {
  try {
    // 获取当前文件的 SHA（用于更新）
    let sha = null;
    try {
      const response = await fetch(`https://api.github.com/repos/${config.repo}/contents/src/leaderboard.json?ref=${config.branch}`, {
        headers: { "Authorization": `token ${config.token}` }
      });
      if (response.ok) {
        const fileData = await response.json();
        sha = fileData.sha;
      }
    } catch (error) {
      console.log("获取 leaderboard.json SHA 失败，将创建新文件");
    }

    // 准备请求体
    const content = JSON.stringify(leaderboardData, null, 4);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const requestBody = {
      message: "Update leaderboard data",
      content: encodedContent,
      branch: config.branch
    };

    // 只有在文件存在时才需要 sha
    if (sha) {
      requestBody.sha = sha;
    }

    console.log("📝 正在保存 leaderboard.json...", sha ? "更新文件" : "创建新文件");

    const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/src/leaderboard.json`, {
      method: "PUT",
      headers: {
        "Authorization": `token ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("❌ 保存 leaderboard.json 失败:", error);
      throw new Error(`Failed to save leaderboard data: ${error.message || res.status}`);
    }

    console.log("✅ leaderboard.json 已成功保存到 GitHub");
  } catch (error) {
    console.error("❌ 保存 leaderboard.json 失败:", error);
    throw error;
  }
}

// ---------- 初始化 ----------
addEventListener('DOMContentLoaded', async () => {
  await loadConfig(); // 首先加载配置
  await updateUserData();
  await loadDataWithToken();
  document.getElementById('tab_players')?.click();
});
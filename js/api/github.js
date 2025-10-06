// GitHub API 操作模块
import { config } from '../config.js';

// 从 GitHub 读取用户数据
export async function loadUserData() {
  try {
    const url = `https://api.github.com/repos/${config.repo}/contents/${config.userDataPath}?ref=${config.branch}`;
    const res = await fetch(url, { headers: { Authorization: `token ${config.token}` } });

    if (!res.ok) {
      console.error('GitHub API错误:', res.status, res.statusText);
      if (res.status === 401) {
        alert('GitHub Token无效或已过期，请检查token权限');
      } else if (res.status === 404) {
        console.log('user.json文件不存在，使用默认数据');
        return { players: [] };
      }
      return { players: [] };
    }

    const data = await res.json();

    if (!data.content) {
      console.error('GitHub API没有返回content字段');
      return { players: [] };
    }

    const cleanedContent = data.content.replace(/\s/g, '');
    const bytes = Uint8Array.from(atob(cleanedContent), c => c.charCodeAt(0));
    const jsonStr = new TextDecoder("utf-8").decode(bytes);
    const parsed = JSON.parse(jsonStr);

    return {
      players: Array.isArray(parsed.players) ? parsed.players : []
    };
  } catch (error) {
    console.error('加载用户数据失败:', error);
    return { players: [] };
  }
}

// 从 GitHub 读取排行榜数据
export async function loadLeaderboardData() {
  try {
    const url = `https://api.github.com/repos/${config.repo}/contents/src/leaderboard.json?ref=${config.branch}`;
    const res = await fetch(url, { headers: { Authorization: `token ${config.token}` } });

    if (!res.ok) {
      console.log('leaderboard.json文件不存在或无法访问');
      return null;
    }

    const data = await res.json();
    const cleanedContent = data.content.replace(/\s/g, '');
    const bytes = Uint8Array.from(atob(cleanedContent), c => c.charCodeAt(0));
    const jsonStr = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('加载排行榜数据失败:', error);
    return null;
  }
}

// 加载所有比赛数据
export async function loadAllMatchData() {
  try {
    const dirUrl = `https://api.github.com/repos/${config.repo}/contents/src/match?ref=${config.branch}`;
    const response = await fetch(dirUrl, {
      headers: { "Authorization": `token ${config.token}` }
    });

    if (!response.ok) {
      console.log('比赛数据目录不存在或无法访问');
      return [];
    }

    const files = await response.json();
    const matchFiles = files.filter(file => file.name.endsWith('.json') && file.name !== 'README.md');

    console.log(`发现 ${matchFiles.length} 个比赛文件`);

    const matches = [];
    for (const file of matchFiles) {
      try {
        const fileResponse = await fetch(file.download_url);
        if (fileResponse.ok) {
          const matchData = await fileResponse.json();
          matches.push(matchData);
        }
      } catch (error) {
        console.error(`加载比赛文件 ${file.name} 失败:`, error);
      }
    }

    console.log(`成功加载 ${matches.length} 个比赛数据`);
    return matches;
  } catch (error) {
    console.error('加载比赛数据失败:', error);
    return [];
  }
}

// 兼容性函数：从 GitHub 读取数据（保持向后兼容）
export async function loadDataWithToken() {
  try {
    // 尝试加载用户数据
    const userData = await loadUserData();

    // 加载排行榜数据
    const leaderboardData = await loadLeaderboardData();

    // 加载所有比赛数据
    const matchData = await loadAllMatchData();

    return {
      players: userData.players,
      matches: matchData,
      leaderboard: leaderboardData
    };
  } catch (error) {
    console.error('加载数据失败:', error);
    return { players: [], matches: [], leaderboard: null };
  }
}

// 上传文件到 GitHub
export async function uploadFileToGithub(token, filePath, file) {
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
          message: `Upload ${file.name}`,
          content,
          sha,
          branch: config.branch
        })
      });
      if (res.ok) {
        resolve(await res.json());
      } else {
        const error = await res.json();
        console.error("GitHub API错误:", error);
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// 保存数据到 GitHub
export async function saveToGithub(players, matches) {
  const blob = new Blob([JSON.stringify({ players, matches }, null, 2)], { type: "application/json" });
  try {
    let sha = undefined;
    const checkRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.path}?ref=${config.branch}`, {
      headers: { Authorization: `token ${config.token}` }
    });
    if (checkRes.ok) {
      const { sha: existingSha } = await checkRes.json();
      sha = existingSha;
    }

    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async e => {
        const content = btoa(e.target.result);
        const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.path}`, {
          method: "PUT",
          headers: {
            "Authorization": `token ${config.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: "Update game data",
            content,
            sha,
            branch: config.branch
          })
        });
        if (res.ok) {
          resolve();
        } else {
          const error = await res.json();
          console.error("GitHub API错误:", error);
          if (error.message && error.message.includes("must be 100 MB or smaller")) {
            alert("文件太大（超过100MB），无法保存到GitHub。请减少数据量。");
          }
          reject(error);
        }
      };
      reader.readAsBinaryString(blob);
    });
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存失败，请检查网络连接和GitHub Token权限');
    throw error;
  }
}

// 确保 match 目录存在
export async function ensureMatchDirectoryExists() {
  try {
    const dirUrl = `https://api.github.com/repos/${config.repo}/contents/src/match?ref=${config.branch}`;
    const checkRes = await fetch(dirUrl, {
      headers: { "Authorization": `token ${config.token}` }
    });

    if (checkRes.status === 404) {
      console.log("📂 正在创建 src/match 目录...");
      const readmePath = "src/match/README.md";
      const content = "# Match Files\n\nThis directory contains individual match JSON files.";
      const encoded = btoa(content);

      const createRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${readmePath}`, {
        method: "PUT",
        headers: {
          "Authorization": `token ${config.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Create src/match directory with README",
          content: encoded,
          branch: config.branch
        })
      });

      if (createRes.ok) {
        console.log("✅ 目录创建成功");
        return true;
      } else {
        console.error("❌ 创建目录失败:", await createRes.json());
        return false;
      }
    } else if (checkRes.ok) {
      console.log("✅ src/match 目录已存在");
      return true;
    } else {
      console.error("❌ 检查目录失败:", checkRes.status);
      return false;
    }
  } catch (error) {
    console.error("❌ 确保目录存在时出错:", error);
    return false;
  }
}

// 保存用户数据
export async function saveUserData(userJson, sha) {
  try {
    const content = JSON.stringify(userJson, null, 4);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const requestBody = {
      message: "Update user data",
      content: encodedContent,
      branch: config.branch
    };

    if (sha) {
      requestBody.sha = sha;
    }

    const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.userDataPath}`, {
      method: "PUT",
      headers: {
        "Authorization": `token ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("保存用户数据失败:", error);
      throw new Error(`Failed to save user data: ${error.message || res.status}`);
    }

    console.log("✅ 用户数据已保存到 GitHub");
  } catch (error) {
    console.error("保存用户数据失败:", error);
    throw error;
  }
}

// 保存单个比赛文件
export async function saveMatchFile(matchData, matchPath) {
  try {
    const matchDataCopy = { ...matchData };
    delete matchDataCopy.rounds;

    console.log(`💾 保存比赛 ${matchData.metadata?.matchid}（已移除 rounds 字段，保留 kills 字段）`);

    const jsonString = JSON.stringify(matchDataCopy, null, 4);
    const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

    let sha = null;
    try {
      const checkRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${matchPath}?ref=${config.branch}`, {
        headers: { "Authorization": `token ${config.token}` }
      });
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        sha = fileData.sha;
      }
    } catch (error) {
      console.log("文件不存在，将创建新文件");
    }

    const requestBody = {
      message: `Save match ${matchData.metadata?.matchid}`,
      content: encodedContent,
      branch: config.branch
    };

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
      throw new Error(`Failed to save match: ${error.message || res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error(`保存比赛文件失败 (${matchPath}):`, error);
    throw error;
  }
}

// 保存排行榜数据
export async function saveLeaderboardData(leaderboardData) {
  try {
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

    const content = JSON.stringify(leaderboardData, null, 4);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const requestBody = {
      message: "Update leaderboard data",
      content: encodedContent,
      branch: config.branch
    };

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
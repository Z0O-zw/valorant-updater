// 排行榜数据管理模块
import { config } from '../config.js';
import { saveLeaderboardData } from '../api/github.js';

// 更新排行榜
export async function updateLeaderboard() {
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
      // 清理配置值，确保没有多余的空格
      const cleanRepo = (config.repo || "Z0O-zw/valorant-updater").trim();
      const cleanBranch = (config.branch || "main").trim();

      // 使用数组 join 构建 URL，避免拼接错误
      const baseUrl = "https://api.github.com";
      const pathParts = ["repos", cleanRepo, "contents", "src", "match"];
      const apiUrl = `${baseUrl}/${pathParts.join("/")}?ref=${cleanBranch}`;

      console.log(`🔗 GitHub API URL: ${apiUrl}`);
      console.log(`📋 配置信息:`, {
        repo: cleanRepo,
        branch: cleanBranch,
        hasToken: !!config.token,
        urlLength: apiUrl.length,
        hasSpaces: apiUrl.includes(" ") || apiUrl.includes("%20%20")
      });

      // 验证 URL 是否正确
      if (apiUrl.includes(" ") || apiUrl.includes("%20%20")) {
        console.error("⚠️ URL 包含异常空格，可能导致请求失败");
      }

      const dirRes = await fetch(apiUrl, {
        headers: {
          "Authorization": `token ${config.token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      console.log(`📡 GitHub API 响应:`, {
        status: dirRes.status,
        statusText: dirRes.statusText,
        remaining: dirRes.headers.get('X-RateLimit-Remaining'),
        limit: dirRes.headers.get('X-RateLimit-Limit')
      });

      if (!dirRes.ok) {
        console.error(`❌ 无法读取 match 目录: ${dirRes.status} ${dirRes.statusText}`);
        const errorBody = await dirRes.text();
        console.error("错误详情:", errorBody);
        return;
      }

      const dirContent = await dirRes.json();
      console.log(`📁 找到 ${dirContent.length} 个文件/目录`);

      // 过滤出 JSON 文件
      const matchFiles = dirContent.filter(file =>
        file.type === 'file' &&
        file.name.endsWith('.json') &&
        file.name !== 'README.md'
      );

      console.log(`📊 找到 ${matchFiles.length} 个比赛文件`);

      // 串行读取每个比赛文件（避免并发请求过多）
      for (const fileInfo of matchFiles) {
        try {
          console.log(`📖 正在读取: ${fileInfo.name}`);
          const fileRes = await fetch(fileInfo.url, {
            headers: {
              "Authorization": `token ${config.token}`,
              "Accept": "application/vnd.github.v3+json"
            }
          });

          if (fileRes.ok) {
            const fileData = await fileRes.json();
            const decodedContent = atob(fileData.content.replace(/\s/g, ''));
            const matchData = JSON.parse(decodedContent);
            allMatches.push(matchData);
            console.log(`  ✅ 成功读取比赛: ${matchData.metadata?.matchid || fileInfo.name}`);
          } else {
            console.error(`  ❌ 无法读取文件 ${fileInfo.name}: ${fileRes.status}`);
          }

          // 添加小延迟，避免触发 API 速率限制
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`  ❌ 读取文件 ${fileInfo.name} 失败:`, error);
        }
      }

      console.log(`✅ 成功加载 ${allMatches.length} 场比赛数据`);
    } catch (error) {
      console.error("加载比赛数据失败:", error);
      return;
    }

    // 3. 统计击杀数据
    console.log("📊 开始统计击杀数据...");

    // 初始化所有玩家的统计数据（包含新字段）
    leaderboardData.players.forEach(player => {
      // 重置基础统计数据
      player.kills = 0;
      player.deaths = 0;
      player.assists = 0;

      // 重置命中部位统计
      player.bodyshots = 0;
      player.headshots = 0;
      player.legshots = 0;
      player.headrate = 0;

      // 重置胜负统计
      player.win = 0;
      player.all = 0;

      // 重置 killsAgainst 对象中的所有值
      if (player.killsAgainst) {
        Object.keys(player.killsAgainst).forEach(puuid => {
          player.killsAgainst[puuid] = 0;
        });
      }

      // 重置 assistsWith 对象中的所有值
      if (player.assistsWith) {
        Object.keys(player.assistsWith).forEach(puuid => {
          player.assistsWith[puuid] = 0;
        });
      }
    });

    // 遍历所有比赛统计数据
    console.log("📊 开始从 players.stats 统计基础数据...");

    allMatches.forEach(match => {
      const matchId = match.metadata?.matchid;
      console.log(`🔍 处理比赛: ${matchId}`);

      // 1. 从 players.all_players.stats 统计基础数据
      if (match.players && match.players.all_players) {
        match.players.all_players.forEach(player => {
          const playerPuuid = player.puuid;
          const stats = player.stats || {};

          const leaderboardPlayer = leaderboardData.players.find(p => p.puuid === playerPuuid);
          if (leaderboardPlayer) {
            // 累加基础统计数据
            leaderboardPlayer.kills += (stats.kills || 0);
            leaderboardPlayer.deaths += (stats.deaths || 0);
            leaderboardPlayer.assists += (stats.assists || 0);
            leaderboardPlayer.bodyshots += (stats.bodyshots || 0);
            leaderboardPlayer.headshots += (stats.headshots || 0);
            leaderboardPlayer.legshots += (stats.legshots || 0);

            // 调试：仅在第一个玩家第一次处理时输出
            if (playerPuuid === leaderboardData.players[0].puuid && !leaderboardPlayer._debugged) {
              console.log(`    📊 示例统计 (${playerPuuid.substring(0, 8)}...):`, {
                'stats.bodyshots': stats.bodyshots,
                'stats.headshots': stats.headshots,
                'stats.legshots': stats.legshots,
                '累计bodyshots': leaderboardPlayer.bodyshots,
                '累计headshots': leaderboardPlayer.headshots,
                '累计legshots': leaderboardPlayer.legshots
              });
              leaderboardPlayer._debugged = true;
            }
          }
        });
      } else {
        console.log(`⚠️ 比赛 ${matchId} 没有 players.all_players 数据`);
      }
    });

    // 遍历所有比赛统计 killsAgainst 和 assistsWith（从 kills 事件）
    console.log("📊 开始从 kills 事件统计 killsAgainst 和 assistsWith...");

    let totalKillEvents = 0;
    let validKillEvents = 0;
    let outsiderKills = 0;
    let suicides = 0;

    allMatches.forEach(match => {
      if (!match.kills || !Array.isArray(match.kills)) {
        console.log(`⚠️ 比赛 ${match.metadata?.matchid} 没有击杀事件数据`);
        return;
      }

      match.kills.forEach(kill => {
        totalKillEvents++;
        const killerPuuid = kill.killer_puuid;
        const victimPuuid = kill.victim_puuid;
        const assistants = kill.assistants || [];

        const killerInList = leaderboardData.players.find(p => p.puuid === killerPuuid);
        const victimInList = leaderboardData.players.find(p => p.puuid === victimPuuid);

        if (killerInList) {
          if (killerPuuid === victimPuuid) {
            suicides++;
          } else {
            validKillEvents++;
            if (!victimInList) {
              outsiderKills++;
            }

            // 更新 killsAgainst 统计（排除自杀）
            if (victimPuuid && victimInList) {
              if (!killerInList.killsAgainst) {
                killerInList.killsAgainst = {};
              }
              killerInList.killsAgainst[victimPuuid] = (killerInList.killsAgainst[victimPuuid] || 0) + 1;
            }
          }
        }

        // 更新 assistsWith 统计
        assistants.forEach(assistant => {
          const assistantPuuid = assistant.assistant_puuid;
          if (assistantPuuid && killerPuuid !== assistantPuuid) {
            const assistantPlayer = leaderboardData.players.find(p => p.puuid === assistantPuuid);
            const killerPlayer = leaderboardData.players.find(p => p.puuid === killerPuuid);

            if (assistantPlayer && killerPlayer) {
              if (!assistantPlayer.assistsWith) {
                assistantPlayer.assistsWith = {};
              }
              assistantPlayer.assistsWith[killerPuuid] = (assistantPlayer.assistsWith[killerPuuid] || 0) + 1;
            }
          }
        });
      });
    });

    // 输出击杀事件统计
    console.log(`📈 击杀事件统计:`);
    console.log(`  - 总击杀事件: ${totalKillEvents}`);
    console.log(`  - 有效击杀事件: ${validKillEvents}`);
    console.log(`  - 自杀事件: ${suicides} (不计入 kills)`);
    console.log(`  - 击杀局外人: ${outsiderKills}`);

    // 4. 统计胜负场次
    console.log("📊 统计胜负场次...");

    const excludedMatchId = "98cce6af-a308-4f13-ad8e-b3362af0ac05";

    allMatches.forEach(match => {
      const matchId = match.metadata?.matchid;

      // 排除特定的比赛
      if (matchId === excludedMatchId) {
        console.log(`⏭️ 跳过比赛: ${matchId} (已排除)`);
        return;
      }

      console.log(`🏆 处理胜负统计: ${matchId}`);

      // 获取队伍胜负信息
      const redWon = match.teams?.red?.has_won === true;
      const blueWon = match.teams?.blue?.has_won === true;

      if (!redWon && !blueWon) {
        console.log(`⚠️ 比赛 ${matchId} 没有明确的胜负结果`);
        return;
      }

      // 统计每个玩家的胜负
      if (match.players && match.players.all_players) {
        match.players.all_players.forEach(player => {
          const playerPuuid = player.puuid;
          const playerTeam = player.team; // "Red" 或 "Blue"

          const leaderboardPlayer = leaderboardData.players.find(p => p.puuid === playerPuuid);
          if (leaderboardPlayer) {
            // 增加总场次
            leaderboardPlayer.all += 1;

            // 判断是否获胜
            const playerWon = (playerTeam === "Red" && redWon) || (playerTeam === "Blue" && blueWon);
            if (playerWon) {
              leaderboardPlayer.win += 1;
            }

            console.log(`  玩家 ${playerPuuid} (${playerTeam}队): ${playerWon ? '胜利' : '失败'}`);
          }
        });
      }
    });

    // 5. 计算爆头率
    console.log("📊 计算爆头率...");
    leaderboardData.players.forEach(player => {
      const totalShots = player.headshots + player.bodyshots + player.legshots;
      if (totalShots > 0) {
        player.headrate = Math.round((player.headshots / totalShots) * 1000) / 10; // 保留一位小数
      } else {
        player.headrate = 0;
      }
    });

    // 6. 输出统计结果和验证
    console.log("📊 统计结果:");
    leaderboardData.players.forEach(player => {
      // 计算 killsAgainst 的总和
      const killsAgainstSum = Object.values(player.killsAgainst || {}).reduce((sum, kills) => sum + kills, 0);
      const assistsWithSum = Object.values(player.assistsWith || {}).reduce((sum, assists) => sum + assists, 0);
      const difference = player.kills - killsAgainstSum;
      const winRate = player.all > 0 ? Math.round((player.win / player.all) * 1000) / 10 : 0;

      console.log(`  ${player.puuid}:`);
      console.log(`    - 基础数据: ${player.kills} 击杀 / ${player.deaths} 死亡 / ${player.assists} 助攻`);
      console.log(`    - 命中数据: ${player.headshots} 爆头 / ${player.bodyshots} 身体 / ${player.legshots} 腿部 (爆头率: ${player.headrate}%)`);
      console.log(`    - 胜负数据: ${player.win} 胜 / ${player.all} 总场次 (胜率: ${winRate}%)`);
      console.log(`    - killsAgainst 总和: ${killsAgainstSum}, 差值: ${difference}`);
      console.log(`    - assistsWith 总和: ${assistsWithSum}`);

      if (difference !== 0) {
        console.warn(`    ⚠️ 击杀统计不一致！总击杀(${player.kills}) != killsAgainst总和(${killsAgainstSum})`);
      }
    });

    // 7. 保存更新后的 leaderboard 数据
    await saveLeaderboardData(leaderboardData);
    console.log("✅ leaderboard.json 更新完成");

  } catch (error) {
    console.error("❌ 更新 leaderboard 失败:", error);
    throw error;
  }
}
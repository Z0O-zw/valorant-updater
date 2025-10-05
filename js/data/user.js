// 用户数据管理模块
import { config } from '../config.js';
import { saveUserData, ensureMatchDirectoryExists, saveMatchFile } from '../api/github.js';
import { fetchMatchList } from '../api/henrik.js';
import { updateLeaderboard } from './leaderboard.js';
import { showLoadingIndicator, showErrorMessage } from '../ui/common.js';

// 更新用户数据
export async function updateUserData() {
  try {
    console.log("🔄 开始更新用户数据...");
    showLoadingIndicator(true);

    // 1. 确保 src/match 目录存在
    console.log("📂 正在检查 src/match 目录...");
    const dirExists = await ensureMatchDirectoryExists();
    if (!dirExists) {
      console.error("❌ 无法确保 src/match 目录存在，跳过更新");
      showLoadingIndicator(false);
      return;
    }

    // 2. 加载当前的用户数据
    let userJson, userData;
    try {
      const userRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.userDataPath}?ref=${config.branch}`, {
        headers: { "Authorization": `token ${config.token}` }
      });

      if (userRes.ok) {
        userData = await userRes.json();
        const decodedUserContent = atob(userData.content.replace(/\s/g, ''));
        console.log("📄 解码后的 user.json 内容长度:", decodedUserContent.length);

        if (decodedUserContent.trim() === '') {
          console.log("⚠️ user.json 文件为空，无法更新");
          showLoadingIndicator(false);
          showErrorMessage("user.json 文件为空，请检查数据");
          return;
        }

        userJson = JSON.parse(decodedUserContent);
        console.log("🔍 当前的 newestMatchID:", userJson.newestMatchID || "未设置");
      } else {
        console.log("user.json 不存在，使用默认数据");
        userJson = { players: [], newestMatchID: null };
        userData = { sha: null };
      }
    } catch (error) {
      console.error("加载 user.json 失败:", error);
      showLoadingIndicator(false);
      showErrorMessage("加载用户数据失败");
      return;
    }

    // 3. 获取最新的比赛数据
    console.log("🎮 正在获取最新比赛数据...");
    let matchData;
    try {
      matchData = await fetchMatchList();
    } catch (error) {
      console.error("获取比赛数据失败:", error);
      showLoadingIndicator(false);
      showErrorMessage("获取比赛数据失败，请检查网络连接");
      return;
    }

    if (!matchData || !matchData.data || !Array.isArray(matchData.data)) {
      console.error("❌ 比赛数据格式错误:", matchData);
      showLoadingIndicator(false);
      showErrorMessage("比赛数据格式错误");
      return;
    }

    console.log(`📊 获取到 ${matchData.data.length} 场比赛记录`);

    // 4. 处理比赛数据
    const customMatches = matchData.data.filter(match =>
      match?.metadata?.mode?.toLowerCase() === "custom"
    );
    console.log(`🎯 找到 ${customMatches.length} 场 custom 模式比赛`);

    if (customMatches.length > 0) {
      const latestMatch = customMatches[0];
      const latestMatchId = latestMatch.metadata?.matchid;
      const matchPlayers = latestMatch.players?.all_players || [];

      console.log("📊 最新比赛信息:");
      console.log(`   - Match ID: ${latestMatchId}`);
      console.log(`   - 玩家数量: ${matchPlayers.length}`);
      console.log(`   - 地图: ${latestMatch.metadata?.map}`);
      console.log(`   - 时间: ${latestMatch.metadata?.game_start_patched}`);

      // 需要执行的操作列表
      const promises = [];

      // 4.1 检查并准备用户数据更新
      if (latestMatchId === userJson.newestMatchID) {
        console.log("✅ 比赛 ID 未变化，数据已是最新");
      } else {
        console.log("🔄 发现新比赛，需要更新用户数据");
        console.log("   - 旧 ID:", userJson.newestMatchID);
        console.log("   - 新 ID:", latestMatchId);

        // 找出需要保存的新比赛
        const newCustomMatches = [];
        for (const match of customMatches) {
          if (match.metadata?.matchid === userJson.newestMatchID) {
            break;
          }
          newCustomMatches.push(match);
        }

        console.log(`   - 新增比赛数量: ${newCustomMatches.length}`);

        // 更新用户信息
        let updatedCount = 0;
        userJson.players = userJson.players.map(player => {
          const matchPlayer = matchPlayers.find(p => p.puuid === player.puuid);
          if (matchPlayer) {
            const oldInfo = { name: player.name, tag: player.tag, card: player.card };

            player.name = matchPlayer.name;
            player.tag = matchPlayer.tag;
            player.card = matchPlayer.assets?.card?.small || "";

            if (oldInfo.name !== player.name || oldInfo.tag !== player.tag || oldInfo.card !== player.card) {
              console.log(`👤 更新玩家: ${oldInfo.name}#${oldInfo.tag} → ${player.name}#${player.tag}`);
              updatedCount++;
            }
          }
          return player;
        });

        promises.push(
          saveUserData(userJson, userData.sha)
            .then(() => console.log(`✅ 用户数据更新完成! (${updatedCount} 个玩家信息更新)`))
        );

        // 4.2 检查并准备比赛数据更新
        if (newCustomMatches.length > 0 || latestMatchId !== userJson.newestMatchID) {
          console.log("🔄 需要更新比赛数据...");
          console.log("   - 新比赛数量:", newCustomMatches.length);
          console.log("   - 当前 userJson.newestMatchID:", userJson.newestMatchID);
          console.log("   - 最新 latestMatchId:", latestMatchId);

          userJson.newestMatchID = latestMatchId;

          if (newCustomMatches.length > 0) {
            console.log("📝 开始串行保存新比赛到 src/match/ 目录...");

            for (const match of newCustomMatches) {
              const matchId = match.metadata.matchid;
              const matchPath = `src/match/${matchId}.json`;

              try {
                await saveMatchFile(match, matchPath);
                console.log(`✅ 比赛 ${matchId} 已保存`);
              } catch (err) {
                console.error(`❌ 保存比赛 ${matchId} 失败:`, err);
              }
            }

            console.log("⏳ 等待 2 秒后更新 leaderboard...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log("🏆 开始更新 leaderboard...");
            try {
              await updateLeaderboard();
            } catch (error) {
              console.error("❌ 更新 leaderboard 失败:", error);
            }
          }
        } else {
          console.log("ℹ️ 比赛数据无需更新");

          // 检查 leaderboard 是否需要初始化
          console.log("🔍 检查 leaderboard 是否需要初始化...");
          try {
            const leaderboardRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/src/leaderboard.json?ref=${config.branch}`, {
              headers: { "Authorization": `token ${config.token}` }
            });

            if (leaderboardRes.ok) {
              const leaderboardFile = await leaderboardRes.json();
              const content = atob(leaderboardFile.content.replace(/\s/g, ''));

              let needsUpdate = false;
              try {
                const leaderboardData = JSON.parse(content);

                if (!leaderboardData.players || leaderboardData.players.length === 0) {
                  console.log("⚠️ Leaderboard 没有玩家数据，需要初始化");
                  needsUpdate = true;
                } else {
                  const uninitializedPlayers = leaderboardData.players.filter(player => {
                    const hasNoStats = (player.totalKills === 0 || player.totalKills === undefined) &&
                                      (player.totalDeaths === 0 || player.totalDeaths === undefined);
                    const hasNoKillMap = !player.killMap || Object.keys(player.killMap).length === 0;
                    return hasNoStats && hasNoKillMap;
                  });

                  if (uninitializedPlayers.length > 0) {
                    console.log(`⚠️ 发现 ${uninitializedPlayers.length} 个未初始化的玩家，需要更新 leaderboard`);
                    needsUpdate = true;
                  }
                }

                if (needsUpdate) {
                  console.log("🏆 开始初始化 leaderboard...");
                  try {
                    await updateLeaderboard();
                    console.log("✅ Leaderboard 初始化完成");
                  } catch (error) {
                    console.error("❌ 初始化 leaderboard 失败:", error);
                  }
                }
              } catch (parseError) {
                console.log("⚠️ Leaderboard 数据解析失败，需要重新初始化");
                console.log("🏆 开始初始化 leaderboard...");
                try {
                  await updateLeaderboard();
                  console.log("✅ Leaderboard 初始化完成");
                } catch (error) {
                  console.error("❌ 初始化 leaderboard 失败:", error);
                }
              }
            } else {
              console.log("⚠️ Leaderboard 文件不存在或无法访问");
            }
          } catch (error) {
            console.log("⚠️ 无法检查 leaderboard 状态:", error);
          }
        }

        // 4.3 执行用户数据更新操作
        if (promises.length > 0) {
          await Promise.all(promises);
          console.log("✅ 用户数据更新完成");
        } else {
          console.log("ℹ️ 无需更新用户数据");
        }
      }
    } else {
      console.log("⚠️ 没有找到 custom 模式的比赛");
    }

    console.log("✅ 用户数据更新流程完成");
  } catch (error) {
    console.error("❌ 更新用户数据时发生错误:", error);
    showErrorMessage("更新用户数据失败，请检查配置和网络连接");
  } finally {
    showLoadingIndicator(false);
  }
}
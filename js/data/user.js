// 用户数据管理模块
import { config } from '../config.js';
import { saveUserData, ensureMatchDirectoryExists, saveMatchFile } from '../api/github.js';
import { fetchMatchList } from '../api/henrik.js';
import { updateLeaderboard } from './leaderboard.js';
import { showLoadingIndicator, showErrorMessage } from '../ui/common.js';
import { perf } from '../utils/performance.js';

// 更新用户数据
export async function updateUserData() {
  const mainKey = perf.start('用户数据更新', 'updateUserData主函数');
  let hasNewMatches = false;
  let updatedLeaderboardData = null;

  try {
    showLoadingIndicator(true);

    // 1. 确保 src/match 目录存在
    const dirExists = await ensureMatchDirectoryExists();
    if (!dirExists) {
      console.error("无法确保 src/match 目录存在，跳过更新");
      showLoadingIndicator(false);
      return;
    }

    // 2. 加载当前的用户数据
    const loadUserKey = perf.start('数据加载', '用户数据');
    let userJson, userData;
    try {
      const userRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${config.userDataPath}?ref=${config.branch}`, {
        headers: { "Authorization": `token ${config.token}` }
      });

      if (userRes.ok) {
        userData = await userRes.json();
        const decodedUserContent = atob(userData.content.replace(/\s/g, ''));

        if (decodedUserContent.trim() === '') {
          showLoadingIndicator(false);
          showErrorMessage("user.json 文件为空，请检查数据");
          return;
        }

        userJson = JSON.parse(decodedUserContent);
      } else {
        userJson = { players: [], newestMatchID: null };
        userData = { sha: null };
      }
    } catch (error) {
      console.error("加载 user.json 失败:", error);
      perf.end(loadUserKey);
      showLoadingIndicator(false);
      showErrorMessage("加载用户数据失败");
      return;
    }
    perf.end(loadUserKey);

    // 3. 获取最新的比赛数据
    const fetchMatchKey = perf.start('数据获取', 'Henrik API比赛数据');
    let matchData;
    try {
      matchData = await fetchMatchList();
      perf.end(fetchMatchKey);
    } catch (error) {
      console.error("获取比赛数据失败:", error);
      perf.end(fetchMatchKey);
      showLoadingIndicator(false);
      showErrorMessage("获取比赛数据失败，请检查网络连接");
      return;
    }

    if (!matchData || !matchData.data || !Array.isArray(matchData.data)) {
      console.error("比赛数据格式错误:", matchData);
      showLoadingIndicator(false);
      showErrorMessage("比赛数据格式错误");
      return;
    }


    // 4. 处理比赛数据
    const customMatches = matchData.data.filter(match => {
      const mode = match?.metadata?.mode;
      const modeId = match?.metadata?.mode_id;
      // 检查 mode 或 mode_id 是否为 custom（原始逻辑）
      return (mode === "custom" || mode === "Custom" ||
              modeId === "custom" || modeId === "Custom" ||
              mode?.toLowerCase() === "custom" ||
              modeId?.toLowerCase() === "custom");
    });

    if (customMatches.length > 0) {
      const latestMatch = customMatches[0];
      const latestMatchId = latestMatch.metadata?.matchid;
      const matchPlayers = latestMatch.players?.all_players || [];

      // 需要执行的操作列表
      const promises = [];

      // 4.1 检查并准备用户数据更新
      if (latestMatchId === userJson.newestMatchID) {

        // 即使没有新比赛，也检查是否需要补充保存历史比赛文件
        let missingMatches = [];

        for (const match of customMatches) {
          const matchId = match.metadata?.matchid;
          if (matchId) {
            // 检查该比赛文件是否已存在
            try {
              const matchPath = `src/match/${matchId}.json`;
              const checkRes = await fetch(`https://api.github.com/repos/${config.repo}/contents/${matchPath}?ref=${config.branch}`, {
                headers: { "Authorization": `token ${config.token}` }
              });

              if (!checkRes.ok) {
                missingMatches.push(match);
              }
            } catch (error) {
              missingMatches.push(match);
            }
          }
        }

        if (missingMatches.length > 0) {
          const saveMatchesKey = perf.start('文件批量处理', `保存${missingMatches.length}个比赛文件`);

          // 保存缺失的比赛文件
          for (const match of missingMatches) {
            const matchId = match.metadata.matchid;
            const matchPath = `src/match/${matchId}.json`;

            try {
              await saveMatchFile(match, matchPath);
            } catch (err) {
              console.error(`补充保存比赛 ${matchId} 失败:`, err);
            }
          }
          perf.end(saveMatchesKey);

          // 补充保存后更新 newestMatchID
          try {
            await saveUserData(userJson, userData.sha);
          } catch (error) {
            console.error("更新 newestMatchID 失败:", error);
          }

          // 补充保存后更新 leaderboard
          try {
            updatedLeaderboardData = await updateLeaderboard();
          } catch (error) {
            console.error("更新 leaderboard 失败:", error);
          }
        } else {

          // 检查 leaderboard 是否需要初始化
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
                  needsUpdate = true;
                } else {
                  const uninitializedPlayers = leaderboardData.players.filter(player => {
                    const hasNoStats = (player.kills === 0 || player.kills === undefined) &&
                                      (player.deaths === 0 || player.deaths === undefined);
                    const hasNoKillsAgainst = !player.killsAgainst || Object.keys(player.killsAgainst).length === 0;
                    return hasNoStats && hasNoKillsAgainst;
                  });

                  if (uninitializedPlayers.length > 0) {
                    needsUpdate = true;
                  }
                }

                if (needsUpdate) {
                  try {
                    await updateLeaderboard();
                  } catch (error) {
                    console.error("初始化 leaderboard 失败:", error);
                  }
                } else {
                }
              } catch (parseError) {
                try {
                  await updateLeaderboard();
                } catch (error) {
                  console.error("重新初始化 leaderboard 失败:", error);
                }
              }
            } else {
              try {
                await updateLeaderboard();
              } catch (error) {
                console.error("创建 leaderboard 失败:", error);
              }
            }
          } catch (error) {
          }
        }
      } else {
        hasNewMatches = true;

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
        const updateUserInfoKey = perf.start('数据处理', '更新用户信息');
        let updatedCount = 0;
        userJson.players = userJson.players.map(player => {
          const matchPlayer = matchPlayers.find(p => p.puuid === player.puuid);
          if (matchPlayer) {
            const oldInfo = { name: player.name, tag: player.tag, card: player.card };

            player.name = matchPlayer.name;
            player.tag = matchPlayer.tag;
            player.card = matchPlayer.assets?.card?.small || "";

            if (oldInfo.name !== player.name || oldInfo.tag !== player.tag || oldInfo.card !== player.card) {
              updatedCount++;
            }
          }
          return player;
        });
        perf.end(updateUserInfoKey);

        promises.push(
          saveUserData(userJson, userData.sha)
        );

        // 4.2 检查并准备比赛数据更新
        if (newCustomMatches.length > 0 || latestMatchId !== userJson.newestMatchID) {

          userJson.newestMatchID = latestMatchId;

          if (newCustomMatches.length > 0) {
            const saveNewMatchesKey = perf.start('文件批量处理', `保存${newCustomMatches.length}个新比赛`);

            for (const match of newCustomMatches) {
              const matchId = match.metadata.matchid;
              const matchPath = `src/match/${matchId}.json`;

              try {
                await saveMatchFile(match, matchPath);
              } catch (err) {
                console.error(`保存比赛 ${matchId} 失败:`, err);
              }
            }
            perf.end(saveNewMatchesKey);

            // 保存新比赛后更新 newestMatchID 到 user.json
            try {
              await saveUserData(userJson, userData.sha);
            } catch (error) {
              console.error("更新 newestMatchID 失败:", error);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
              updatedLeaderboardData = await updateLeaderboard();
            } catch (error) {
              console.error("更新 leaderboard 失败:", error);
            }
          }
        } else {

          // 检查 leaderboard 是否需要初始化
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
                  needsUpdate = true;
                } else {
                  const uninitializedPlayers = leaderboardData.players.filter(player => {
                    const hasNoStats = (player.kills === 0 || player.kills === undefined) &&
                                      (player.deaths === 0 || player.deaths === undefined);
                    const hasNoKillsAgainst = !player.killsAgainst || Object.keys(player.killsAgainst).length === 0;
                    return hasNoStats && hasNoKillsAgainst;
                  });

                  if (uninitializedPlayers.length > 0) {
                    needsUpdate = true;
                  }
                }

                if (needsUpdate) {
                  try {
                    await updateLeaderboard();
                  } catch (error) {
                    console.error("初始化 leaderboard 失败:", error);
                  }
                }
              } catch (parseError) {
                try {
                  await updateLeaderboard();
                } catch (error) {
                  console.error("初始化 leaderboard 失败:", error);
                }
              }
            } else {
            }
          } catch (error) {
          }
        }

        // 4.3 执行用户数据更新操作
        if (promises.length > 0) {
          await Promise.all(promises);
        } else {
        }
      }
    } else {
    }

  } catch (error) {
    console.error("更新用户数据时发生错误:", error);
    showErrorMessage("更新用户数据失败，请检查配置和网络连接");
    perf.end(mainKey);
  } finally {
    showLoadingIndicator(false);
  }

  perf.end(mainKey);
  return { hasNewMatches, updatedLeaderboardData };
}
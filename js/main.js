// 主入口文件
import { loadConfig } from './config.js';
import { loadDataWithToken } from './api/github.js';
import { updateUserData } from './data/user.js';
import { setPlayers, setLeaderboardData } from './ui/players.js';
import { setMatches } from './data/match.js';
import { showTab } from './ui/common.js';

// 全局初始化函数
async function init() {
  try {
    console.log('🚀 应用初始化开始...');

    // 1. 加载配置
    await loadConfig();
    console.log('✅ 配置加载完成');

    // 2. 更新用户数据（包括 leaderboard）
    const updateResult = await updateUserData();
    console.log('✅ 用户数据更新完成');

    // 3. 加载数据（如果刚更新过，延迟一下避免缓存问题）
    if (updateResult && updateResult.hasNewMatches) {
      console.log('⏳ 等待 GitHub 数据同步...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
    }

    // 4. 加载现有数据
    const data = await loadDataWithToken();
    setPlayers(data.players);
    setMatches(data.matches);

    // 如果刚更新了 leaderboard，使用新数据；否则使用从 GitHub 加载的数据
    if (updateResult && updateResult.updatedLeaderboardData) {
      setLeaderboardData(updateResult.updatedLeaderboardData);
    } else {
      setLeaderboardData(data.leaderboard);
    }
    console.log('✅ 数据加载完成');

    // 5. 显示默认标签页
    showTab('players');
    console.log('✅ 应用初始化完成');

  } catch (error) {
    console.error('❌ 应用初始化失败:', error);
  }
}

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 导出 showTab 给全局使用
if (typeof window !== 'undefined') {
  window.showTab = showTab;
}
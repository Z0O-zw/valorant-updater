// 同步界面模块
import { config } from '../config.js';
import { players } from './players.js';
import { getMatches } from '../data/match.js';
import { saveToGithub } from '../api/github.js';
import { updateUserData } from '../data/user.js';
import { updateLeaderboard } from '../data/leaderboard.js';

// 渲染同步界面
export function render() {
  const content = document.getElementById('content');
  if (!content) return;

  let html = `
    <div class="section">
      <h2>GitHub 同步</h2>

      <div class="sync-info">
        <h3>仓库信息</h3>
        <table>
          <tbody>
            <tr>
              <td>仓库:</td>
              <td>${config.repo}</td>
            </tr>
            <tr>
              <td>分支:</td>
              <td>${config.branch}</td>
            </tr>
            <tr>
              <td>Token状态:</td>
              <td>${config.token ? '✅ 已配置' : '❌ 未配置'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="sync-actions">
        <h3>数据同步</h3>
        <div class="action-buttons">
          <button onclick="window.uiSync.updateUserData()" class="action-btn">
            🔄 更新用户数据
            <small>从 Henrik API 获取最新比赛和用户信息</small>
          </button>

          <button onclick="window.uiSync.forceUpdateLeaderboard()" class="action-btn">
            🏆 强制更新排行榜
            <small>重新计算所有玩家的统计数据（包括爆头率、胜率等）</small>
          </button>

          <button onclick="window.uiSync.syncToGithub()" class="action-btn">
            📤 上传到 GitHub
            <small>将当前玩家和比赛数据保存到 GitHub</small>
          </button>

          <button onclick="window.uiSync.checkStatus()" class="action-btn">
            📊 检查状态
            <small>查看数据文件状态和 API 配额</small>
          </button>
        </div>
      </div>

      <div class="data-preview">
        <h3>数据预览</h3>
        <div class="preview-stats">
          <div class="stat-item">
            <span class="stat-label">玩家数量:</span>
            <span class="stat-value">${players.length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">比赛记录:</span>
            <span class="stat-value">${getMatches().length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最后更新:</span>
            <span class="stat-value">${new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div id="sync-log" class="sync-log">
        <h3>操作日志</h3>
        <div id="log-content">点击上方按钮开始同步操作...</div>
      </div>
    </div>
  `;

  content.innerHTML = html;
}

// 更新用户数据
async function handleUpdateUserData() {
  const logElement = document.getElementById('log-content');
  if (logElement) {
    logElement.innerHTML = '🔄 开始更新用户数据...';
  }

  try {
    await updateUserData();
    if (logElement) {
      logElement.innerHTML += '<br>✅ 用户数据更新完成';
    }
  } catch (error) {
    console.error('更新用户数据失败:', error);
    if (logElement) {
      logElement.innerHTML += `<br>❌ 更新失败: ${error.message}`;
    }
  }
}

// 同步到 GitHub
async function syncToGithub() {
  const logElement = document.getElementById('log-content');
  if (logElement) {
    logElement.innerHTML = '📤 开始上传到 GitHub...';
  }

  try {
    await saveToGithub(players, getMatches());
    if (logElement) {
      logElement.innerHTML += '<br>✅ 数据已成功保存到 GitHub';
    }
  } catch (error) {
    console.error('上传失败:', error);
    if (logElement) {
      logElement.innerHTML += `<br>❌ 上传失败: ${error.message}`;
    }
  }
}

// 检查状态
async function checkStatus() {
  const logElement = document.getElementById('log-content');
  if (logElement) {
    logElement.innerHTML = '📊 检查状态中...';
  }

  try {
    // 检查 GitHub API 限制
    const rateRes = await fetch('https://api.github.com/rate_limit', {
      headers: { Authorization: `token ${config.token}` }
    });

    if (rateRes.ok) {
      const rateData = await rateRes.json();
      const remaining = rateData.rate.remaining;
      const limit = rateData.rate.limit;
      const resetTime = new Date(rateData.rate.reset * 1000).toLocaleString();

      if (logElement) {
        logElement.innerHTML += `<br>📊 API 配额: ${remaining}/${limit}`;
        logElement.innerHTML += `<br>🕒 重置时间: ${resetTime}`;
      }
    }

    // 检查仓库访问
    const repoRes = await fetch(`https://api.github.com/repos/${config.repo}`, {
      headers: { Authorization: `token ${config.token}` }
    });

    if (repoRes.ok) {
      if (logElement) {
        logElement.innerHTML += '<br>✅ 仓库访问正常';
      }
    } else {
      if (logElement) {
        logElement.innerHTML += `<br>❌ 仓库访问失败: ${repoRes.status}`;
      }
    }

  } catch (error) {
    console.error('状态检查失败:', error);
    if (logElement) {
      logElement.innerHTML += `<br>❌ 状态检查失败: ${error.message}`;
    }
  }
}

// 强制更新排行榜
async function forceUpdateLeaderboard() {
  const logElement = document.getElementById('log-content');
  if (logElement) {
    logElement.innerHTML = '🏆 开始更新排行榜...';
  }

  try {
    await updateLeaderboard();
    if (logElement) {
      logElement.innerHTML += '<br>✅ 排行榜更新完成！已重新计算所有统计数据。';
    }
    // 刷新界面以显示新数据
    render();
  } catch (error) {
    console.error('更新排行榜失败:', error);
    if (logElement) {
      logElement.innerHTML += `<br>❌ 更新失败: ${error.message}`;
    }
  }
}

// 导出给全局使用
if (typeof window !== 'undefined') {
  window.uiSync = {
    updateUserData: handleUpdateUserData,
    syncToGithub,
    checkStatus,
    forceUpdateLeaderboard
  };
}
// 头像工具模块
import { config } from '../config.js';

// 获取玩家头像 URL（优先自定义头像，其次游戏内头像）
export async function getPlayerAvatar(puuid, gameCard = null) {
  // 1. 尝试获取自定义头像
  const customAvatar = await getCustomAvatar(puuid);
  if (customAvatar) {
    return customAvatar;
  }

  // 2. 返回游戏内头像
  return gameCard || getDefaultAvatar();
}

// 获取自定义头像
async function getCustomAvatar(puuid) {
  try {
    // 检查 src/avatars/{puuid}/ 目录下是否有头像文件
    const dirUrl = `https://api.github.com/repos/${config.repo}/contents/src/avatars/${puuid}?ref=${config.branch}`;
    const dirRes = await fetch(dirUrl, {
      headers: { "Authorization": `token ${config.token}` }
    });

    if (dirRes.ok) {
      const dirContent = await dirRes.json();

      // 查找图片文件
      const imageFile = dirContent.find(file =>
        file.type === 'file' &&
        /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)
      );

      if (imageFile) {
        // 获取图片内容
        const fileRes = await fetch(imageFile.url, {
          headers: { "Authorization": `token ${config.token}` }
        });

        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const mimeType = getMimeTypeFromExtension(imageFile.name);
          return `data:${mimeType};base64,${fileData.content.replace(/\s/g, '')}`;
        }
      }
    }
  } catch (error) {
    console.log(`没有找到 ${puuid} 的自定义头像`);
  }

  return null;
}

// 根据文件扩展名获取 MIME 类型
function getMimeTypeFromExtension(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/png';
}

// 默认头像
function getDefaultAvatar() {
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ddd"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%23999">?</text></svg>';
}
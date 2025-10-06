// Henrik API 操作模块
import { config } from '../config.js';
import { perf } from '../utils/performance.js';

// 获取比赛列表
export async function fetchMatchList(name = 'SuperLulino', tag = '4088', region = 'eu', mode = 'custom', size = 8) {
  const key = perf.start('Henrik API请求', `getMatches - ${name}#${tag}`);
  try {
    const params = new URLSearchParams({
      name,
      tag,
      region,
      mode,
      size: size // 保持为整数，不转换为字符串
    });

    const response = await fetch(`${config.henrikapiProxy}?${params}`);

    if (!response.ok) {
      throw new Error(`Henrik API 错误: ${response.status}`);
    }

    const result = await response.json();
    perf.end(key);
    return result;
  } catch (error) {
    console.error('获取比赛列表失败:', error);
    perf.end(key);
    throw error;
  }
}
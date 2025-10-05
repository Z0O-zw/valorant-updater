// Henrik API 操作模块
import { config } from '../config.js';

// 获取比赛列表
export async function fetchMatchList(name = 'SuperLulino', tag = '4088', region = 'eu', mode = 'custom', size = 20) {
  try {
    const params = new URLSearchParams({
      name,
      tag,
      region,
      mode,
      size: size.toString()
    });

    const response = await fetch(`${config.henrikapiProxy}?${params}`);

    if (!response.ok) {
      throw new Error(`Henrik API 错误: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取比赛列表失败:', error);
    throw error;
  }
}
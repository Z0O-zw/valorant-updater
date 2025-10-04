// Vercel Serverless Function - Henrik API 代理
// 用于避免 CORS 问题，在服务器端调用 Henrik API

export default async function handler(req, res) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取环境变量中的 API Key
    const henrikapiKey = process.env.Henrik_APIKEY;

    if (!henrikapiKey) {
      return res.status(500).json({ error: 'Henrik API key not configured' });
    }

    // 从查询参数获取请求信息
    const { name = 'SuperLulino', tag = '4088', region = 'eu', mode = 'custom' } = req.query;

    // 构建 Henrik API URL
    const henrikapiUrl = `https://api.henrikdev.xyz/valorant/v3/matches/${region}/${name}/${tag}${mode ? `?mode=${mode}` : ''}`;

    console.log('请求 Henrik API:', henrikapiUrl);

    // 调用 Henrik API
    const response = await fetch(henrikapiUrl, {
      headers: {
        'Authorization': henrikapiKey,
        'User-Agent': 'Valorant-Tracker/1.0'
      }
    });

    if (!response.ok) {
      console.error('Henrik API 错误:', response.status, response.statusText);
      return res.status(response.status).json({
        error: `Henrik API error: ${response.status} ${response.statusText}`
      });
    }

    const data = await response.json();

    // 添加 CORS 头部，允许前端访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 返回数据
    res.status(200).json(data);

  } catch (error) {
    console.error('代理请求失败:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// 处理预检请求 (OPTIONS)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
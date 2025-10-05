// 配置管理模块
export let config = {
  repo: "Z0O-zw/valorant-updater",
  branch: "main",
  path: "data.json",
  token: "",
  userDataPath: "src/user.json",
  matchDataPath: "src/match.json",
  henrikapiKey: "",
  henrikapiProxy: "/api/henrik"
};

// 从 API 获取配置
export async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      Object.assign(config, await response.json());
      console.log('配置加载成功');
    } else {
      console.error('无法加载配置，使用默认值');
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}
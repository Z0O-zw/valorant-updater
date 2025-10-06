// 比赛数据管理模块

// 全局比赛数据
export let matches = [];

// 设置比赛数据
export function setMatches(newMatches) {
  matches = newMatches;
}

// 添加比赛
export function addMatchData(match) {
  matches.push(match);
}

// 删除比赛
export function deleteMatchData(index) {
  matches.splice(index, 1);
}

// 获取比赛数据
export function getMatches() {
  return matches;
}
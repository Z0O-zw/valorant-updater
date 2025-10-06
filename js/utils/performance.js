// 性能监控工具
class PerformanceTracker {
  constructor() {
    this.timers = new Map();
    this.logs = [];
  }

  // 开始计时
  start(operation, details = '') {
    const key = `${operation}-${Date.now()}`;
    this.timers.set(key, {
      operation,
      details,
      startTime: performance.now(),
      startTimestamp: new Date().toISOString()
    });
    return key;
  }

  // 结束计时并记录
  end(key) {
    const timer = this.timers.get(key);
    if (!timer) return;

    const endTime = performance.now();
    const duration = endTime - timer.startTime;

    const log = {
      operation: timer.operation,
      details: timer.details,
      duration: Math.round(duration * 100) / 100, // 保留2位小数
      startTime: timer.startTimestamp,
      endTime: new Date().toISOString()
    };

    this.logs.push(log);
    this.timers.delete(key);

    // 输出性能日志
    console.log(`⏱️ ${timer.operation}${timer.details ? ` (${timer.details})` : ''}: ${log.duration}ms`);

    return log;
  }

  // 获取所有性能日志
  getAllLogs() {
    return [...this.logs];
  }

  // 获取指定操作的性能统计
  getStats(operation) {
    const operationLogs = this.logs.filter(log => log.operation === operation);
    if (operationLogs.length === 0) return null;

    const durations = operationLogs.map(log => log.duration);
    return {
      operation,
      count: operationLogs.length,
      total: durations.reduce((sum, d) => sum + d, 0),
      average: durations.reduce((sum, d) => sum + d, 0) / operationLogs.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    };
  }

  // 生成性能报告
  generateReport() {
    const operations = [...new Set(this.logs.map(log => log.operation))];
    const report = operations.map(op => this.getStats(op)).filter(Boolean);

    console.log('\n📊 性能监控报告:');
    console.log('=' .repeat(50));

    report.forEach(stat => {
      console.log(`\n${stat.operation}:`);
      console.log(`  调用次数: ${stat.count}`);
      console.log(`  总耗时: ${stat.total.toFixed(2)}ms`);
      console.log(`  平均耗时: ${stat.average.toFixed(2)}ms`);
      console.log(`  最短耗时: ${stat.min.toFixed(2)}ms`);
      console.log(`  最长耗时: ${stat.max.toFixed(2)}ms`);
    });

    console.log('\n' + '='.repeat(50));
    return report;
  }

  // 清空日志
  clear() {
    this.timers.clear();
    this.logs = [];
  }
}

// 创建全局性能监控实例
export const perf = new PerformanceTracker();

// 便捷函数：用于包装异步函数并自动计时
export function withTiming(operation, fn, details = '') {
  return async (...args) => {
    const key = perf.start(operation, details);
    try {
      const result = await fn(...args);
      perf.end(key);
      return result;
    } catch (error) {
      perf.end(key);
      throw error;
    }
  };
}

// 便捷函数：用于包装同步函数并自动计时
export function withTimingSync(operation, fn, details = '') {
  return (...args) => {
    const key = perf.start(operation, details);
    try {
      const result = fn(...args);
      perf.end(key);
      return result;
    } catch (error) {
      perf.end(key);
      throw error;
    }
  };
}
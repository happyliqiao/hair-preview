// 云函数：定时清理临时原图与过期数据（合规：原图用后即删）
// 配合 config.json 的定时触发器运行
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const RETENTION_MS = 24 * 60 * 60 * 1000; // 保留 24 小时内的记录

exports.main = async () => {
  const cutoff = Date.now() - RETENTION_MS;

  // 1. 清理超时未完成的生成记录
  const stale = await db.collection('generation')
    .where({ status: _.in(['pending', 'processing']), createdAt: _.lt(cutoff) })
    .get();

  // 2. 删除遗留的临时原图（收集 photoFileID）
  const files = [];
  stale.data.forEach((r) => { if (r.photoFileID) files.push(r.photoFileID); });

  let deletedCount = 0;
  if (files.length) {
    try {
      const res = await cloud.deleteFile({ fileList: files });
      deletedCount = (res.fileList || []).filter((f) => f.status === 0).length;
    } catch (e) {}
  }

  // 3. 标记这些记录为 failed（超时）
  if (stale.data.length) {
    await db.collection('generation')
      .where({ status: _.in(['pending', 'processing']), createdAt: _.lt(cutoff) })
      .update({ data: { status: 'failed', errorMsg: 'timeout' } });
  }

  return { cleaned: stale.data.length, deletedCount };
};

// 云函数：拉取目录（发型 / 发色 / 模板）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { collection = 'hairstyle' } = event;
  try {
    const res = await db.collection(collection)
      .where({ enabled: true })
      .orderBy('sortOrder', 'asc')
      .get();
    return { code: 0, data: res.data };
  } catch (e) {
    return { code: -1, msg: e.message };
  }
};

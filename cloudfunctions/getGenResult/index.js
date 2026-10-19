// 云函数：查询生成结果（供前端轮询）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { id } = event;
  try {
    const res = await db.collection('generation').doc(id).get();
    return { code: 0, data: res.data };
  } catch (e) {
    return { code: -1, msg: e.message };
  }
};

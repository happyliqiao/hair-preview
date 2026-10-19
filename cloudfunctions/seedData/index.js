// 云函数：初始化示例数据（发型/发色/模板映射）
// 用法：在云开发控制台或开发者工具里，对本函数「云端测试」执行一次即可。
// 说明：template 的 facefusionModelId 先填占位符，等你上传素材到腾讯云后替换。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const HAIRSTYLES = [
  { name: '短发',   shape: 'short', emoji: '💇‍♀️', category: '短发', sortOrder: 1 },
  { name: '长发',   shape: 'long',  emoji: '💁‍♀️', category: '长发', sortOrder: 2 },
  { name: '卷发',   shape: 'curly', emoji: '👩‍🦱', category: '卷发', sortOrder: 3 },
  { name: '清爽',   shape: 'buzz',  emoji: '👩‍🦲', category: '短发', sortOrder: 4 }
].map((h, i) => Object.assign(h, { _id: ['hair_short', 'hair_long', 'hair_curly', 'hair_buzz'][i], thumbnailUrl: '', overlayUrl: '', enabled: true, createdAt: Date.now(), updatedAt: Date.now() }));

const COLORS = [
  ['c_black', '黑色', '#1a1a1a'], ['c_brown', '深棕', '#4a2c1a'], ['c_caramel', '焦糖棕', '#8A5A2B'],
  ['c_chestnut', '栗棕', '#6b3f23'], ['c_gold', '金色', '#c9a24b'], ['c_ash', '亚麻灰', '#9a8f7a'],
  ['c_blue', '雾蓝', '#5c6b7a'], ['c_wine', '酒红', '#7a2030'], ['c_pink', '粉棕', '#d98aa0']
].map((c, i) => ({ _id: c[0], name: c[1], hex: c[2], tintHex: c[2], tintOpacity: 0.45, sortOrder: i + 1, enabled: true, createdAt: Date.now(), updatedAt: Date.now() }));

exports.main = async () => {
  const result = { hairstyles: 0, colors: 0, templates: 0 };

  for (const h of HAIRSTYLES) {
    await db.collection('hairstyle').doc(h._id).set({ data: h });
    result.hairstyles++;
  }
  for (const c of COLORS) {
    await db.collection('hairColor').doc(c._id).set({ data: c });
    result.colors++;
  }
  // 为每个「发型 × 发色」组合生成模板映射（modelId 需替换）
  for (const h of HAIRSTYLES) {
    for (const c of COLORS) {
      const id = `tpl_${h._id}_${c._id}`;
      await db.collection('template').doc(id).set({
        data: {
          hairstyleId: h._id, colorId: c._id,
          facefusionModelId: 'REPLACE_WITH_MODEL_ID',
          previewUrl: '', enabled: true,
          createdAt: Date.now(), updatedAt: Date.now()
        }
      });
      result.templates++;
    }
  }

  return { code: 0, data: result };
};

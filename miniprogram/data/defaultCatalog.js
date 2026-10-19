/**
 * 内置演示目录：无云环境时，小程序也能展示完整 UI 与实时叠加。
 * 云环境可用时，getCatalog 返回的数据会覆盖这里。
 */
module.exports = {
  hairstyles: [
    { _id: 'hair_short', name: '短发',   shape: 'short', emoji: '💇‍♀️' },
    { _id: 'hair_long',  name: '长发',   shape: 'long',  emoji: '💁‍♀️' },
    { _id: 'hair_curly', name: '卷发',   shape: 'curly', emoji: '👩‍🦱' },
    { _id: 'hair_buzz',  name: '清爽',   shape: 'buzz',  emoji: '👩‍🦲' }
  ],
  colors: [
    { _id: 'c_black',    name: '黑色',   hex: '#1a1a1a' },
    { _id: 'c_brown',    name: '深棕',   hex: '#4a2c1a' },
    { _id: 'c_caramel',  name: '焦糖棕', hex: '#8A5A2B' },
    { _id: 'c_chestnut', name: '栗棕',   hex: '#6b3f23' },
    { _id: 'c_gold',     name: '金色',   hex: '#c9a24b' },
    { _id: 'c_ash',      name: '亚麻灰', hex: '#9a8f7a' },
    { _id: 'c_blue',     name: '雾蓝',   hex: '#5c6b7a' },
    { _id: 'c_wine',     name: '酒红',   hex: '#7a2030' },
    { _id: 'c_pink',     name: '粉棕',   hex: '#d98aa0' }
  ]
};

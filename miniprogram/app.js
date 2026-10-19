App({
  globalData: {
    env: '',            // 云开发环境 ID，留空则使用默认环境
    openid: '',
    catalog: {          // 发型/发色目录缓存
      hairstyles: [],
      colors: []
    }
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env || undefined,
      traceUser: true
    });
  }
});

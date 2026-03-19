// 云函数配置文件
// 集中管理云存储路径等常量配置

module.exports = {
  qr: {
    ttlHours: 168,
    page: 'pages/scan-result/scan-result',
    envVersion: 'trial',
    checkPath: true
  },
  // 云存储配置
  storage: {
    // 默认二维码图片路径
    defaultQRCodePath: 'cloud://cloud1-5gudbe4m8263c9dc.636c-cloud1-5gudbe4m8263c9dc-1379027289/qrcodes/default.png'
  }
};

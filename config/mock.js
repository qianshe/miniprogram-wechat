// 统一的模拟数据
const mockData = {
  // 流程数据
  redSteps: [
    {
      _id: 'mock_red_1',
      title: '婚礼筹备',
      description: '确定婚礼日期、场地等'
    },
    {
      _id: 'mock_red_2',
      title: '婚礼流程',
      description: '婚礼仪式、拍照、宴会等'
    },
    {
      _id: 'mock_red_3',
      title: '婚宴准备',
      description: '制定菜单、布置现场等'
    }
  ],

  whiteSteps: [
    {
      _id: 'mock_white_1',
      title: '初期处理',
      description: '联系殡仪馆、准备材料'
    },
    {
      _id: 'mock_white_2',
      title: '后期手续',
      description: '办理相关证明文件'
    },
    {
      _id: 'mock_white_3',
      title: '追悼仪式',
      description: '举办追悼会、安葬等'
    }
  ],

  // 白事商品数据（仅用于开发测试，生产环境从数据库获取）
  whiteProducts: [
    {
      id: 101,
      name: '花圈套餐',
      price: 38800,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
      stock: 100
    },
    {
      id: 102,
      name: '骨灰盒',
      price: 68800,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
      stock: 50
    },
    {
      id: 103,
      name: '丧葬服务套餐',
      price: 299900,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
      stock: 50
    },
    {
      id: 104,
      name: '寿衣套餐',
      price: 199900,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
      stock: 50
    }
  ]

  // 注意：分类数据已迁移到数据库categories集合
  // 通过 categoryManagement 云函数的 getCategories 接口获取
};

module.exports = mockData;

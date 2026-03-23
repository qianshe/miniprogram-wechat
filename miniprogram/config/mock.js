// 统一的模拟数据
const mockData = {
  // 流程数据
  redSteps: [
    {
      _id: 'mock_red_1',
      title: '婚礼筹备',
      description: '确定婚礼日期、场地等',
      content: '确认婚礼日期、场地和主要流程节点，便于后续资源协调与执行安排。',
      type: 1,
      order: 1,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
    },
    {
      _id: 'mock_red_2',
      title: '婚礼流程',
      description: '婚礼仪式、拍照、宴会等',
      content: '梳理仪式、拍照、宴会等环节，确保流程衔接顺畅。',
      type: 1,
      order: 2,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
    },
    {
      _id: 'mock_red_3',
      title: '婚宴准备',
      description: '制定菜单、布置现场等',
      content: '确认菜单、现场布置与来宾接待安排，保证婚宴顺利进行。',
      type: 1,
      order: 3,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
    }
  ],

  whiteSteps: [
    {
      _id: 'mock_white_1',
      title: '初期处理',
      description: '联系殡仪馆、准备材料',
      content: '确认接运安排与基础材料，尽快建立后续治丧流程的执行节奏。',
      type: 0,
      order: 1,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
    },
    {
      _id: 'mock_white_2',
      title: '后期手续',
      description: '办理相关证明文件',
      content: '根据实际情况办理火化、安葬或其他手续，确保资料完整。',
      type: 0,
      order: 2,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
    },
    {
      _id: 'mock_white_3',
      title: '追悼仪式',
      description: '举办追悼会、安葬等',
      content: '组织告别与安葬环节，让家属能按计划完成追思与送别。',
      type: 0,
      order: 3,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/example1.png',
      tips: [],
      productList: [],
      status: 1
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

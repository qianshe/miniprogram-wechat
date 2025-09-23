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

  // 商品数据
  redProducts: [
    {
      id: 1,
      name: '婚庆布置套餐',
      price: 128800,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
      stock: 100
    },
    {
      id: 2,
      name: '婚礼司仪服务',
      price: 88800,
      imageUrl: 'https://tdesign.gtimg.com/mobile/demos/swiper1.png',
      stock: 50
    }
  ],

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
  ],

  whiteCategories: [
    {
      id: 1,
      name: '骨灰盒',
      sort: 1,
      products: Array(15).fill(null).map((_, i) => ({
        id: 100 + i,
        name: `骨灰盒-${i + 1}号`,
        price: Math.floor(Math.random() * 100000 + 50000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 2,
      name: '寿衣寿具',
      sort: 2,
      products: Array(12).fill(null).map((_, i) => ({
        id: 200 + i,
        name: `寿衣-${i + 1}号`,
        price: Math.floor(Math.random() * 80000 + 30000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 3,
      name: '花圈花篮',
      sort: 3,
      products: Array(20).fill(null).map((_, i) => ({
        id: 300 + i,
        name: `花圈-${i + 1}号`,
        price: Math.floor(Math.random() * 50000 + 20000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 4,
      name: '丧葬服务',
      sort: 4,
      products: Array(10).fill(null).map((_, i) => ({
        id: 400 + i,
        name: `丧葬服务-${i + 1}号`,
        price: Math.floor(Math.random() * 300000 + 100000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 5,
      name: '殡葬用品',
      sort: 5,
      products: Array(18).fill(null).map((_, i) => ({
        id: 500 + i,
        name: `殡葬用品-${i + 1}号`,
        price: Math.floor(Math.random() * 40000 + 10000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    }
  ],

  redCategories: [
    {
      id: 1,
      name: '婚庆布置',
      sort: 1,
      products: Array(15).fill(null).map((_, i) => ({
        id: 1000 + i,
        name: `婚庆布置套餐-${i + 1}号`,
        price: Math.floor(Math.random() * 200000 + 80000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 2,
      name: '婚礼司仪',
      sort: 2,
      products: Array(12).fill(null).map((_, i) => ({
        id: 2000 + i,
        name: `婚礼司仪套餐-${i + 1}号`,
        price: Math.floor(Math.random() * 150000 + 50000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 3,
      name: '婚礼摄影',
      sort: 3,
      products: Array(20).fill(null).map((_, i) => ({
        id: 3000 + i,
        name: `婚礼摄影套餐-${i + 1}号`,
        price: Math.floor(Math.random() * 250000 + 100000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 4,
      name: '婚宴酒店',
      sort: 4,
      products: Array(16).fill(null).map((_, i) => ({
        id: 4000 + i,
        name: `婚宴场地-${i + 1}号`,
        price: Math.floor(Math.random() * 500000 + 200000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    },
    {
      id: 5,
      name: '婚车租赁',
      sort: 5,
      products: Array(14).fill(null).map((_, i) => ({
        id: 5000 + i,
        name: `婚车套餐-${i + 1}号`,
        price: Math.floor(Math.random() * 100000 + 30000),
        image: 'https://tdesign.gtimg.com/mobile/demos/example2.png'
      }))
    }
  ]
};

module.exports = mockData;

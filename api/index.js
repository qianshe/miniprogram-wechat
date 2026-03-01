/**
 * API统一入口模块
 * 提供统一的API访问方式，简化业务调用
 * 
 * 使用示例:
 * ```javascript
 * import api from '../../api'
 * 
 * // 用户端API调用
 * const orders = await api.order.getList({ page: 1, size: 10 })
 * const product = await api.product.getById('product_id')
 * const categories = await api.category.getList({}, { cache: 60000 })
 * 
 * // 管理端API调用
 * const adminOrders = await api.order.adminGetList({ status: 1 })
 * await api.product.create({ name: '新产品', price: 100 })
 * ```
 */

// 导入各业务模块
const user = require('./user.js')
const order = require('./order.js')
const product = require('./product.js')
const category = require('./category.js')
const process = require('./process.js')
const packageApi = require('./package.js')
const address = require('./address.js')
const cart = require('./cart.js')

// 导入云函数调用工具（用于高级使用场景）
const cloudFunction = require('../utils/cloudFunction.js')

/**
 * API模块集合
 * 包含所有业务模块的API接口
 */
const api = {
  /**
   * 用户模块
   * - login() 登录
   * - getInfo() 获取用户信息
   * - updateInfo() 更新用户信息
   * - checkSession() 检查会话
   * - adminLogin() 管理员登录
   * - adminGetList() 获取用户列表
   */
  user,
  
  /**
   * 订单模块
   * - getList() 获取订单列表
   * - getDetail() 获取订单详情
   * - create() 创建订单
   * - cancel() 取消订单
* - submitOfflineSettlementIntent() 提交线下结算意向
 * - remove() 删除订单
   * - bind() 绑定订单
   * - adminGetList() 管理员获取列表
   * - adminGetDetail() 管理员获取详情
   * - adminUpdateStatus() 管理员更新状态
   */
  order,
  
  /**
   * 产品模块
   * - getList() 获取产品列表
   * - getDetail() 获取产品详情
   * - getById() 根据ID获取产品
   * - getByCategory() 按分类获取产品
   * - search() 搜索产品
   * - adminGetList() 管理员获取列表
   * - create() 创建产品
   * - update() 更新产品
   * - remove() 删除产品
   * - publish() 上架产品
   * - unpublish() 下架产品
   */
  product,
  
  /**
   * 分类模块
   * - getList() 获取分类列表（带缓存）
   * - getTree() 获取分类树
   * - getDetail() 获取分类详情
   * - getById() 根据ID获取分类
   * - getChildren() 获取子分类
   * - adminGetList() 管理员获取列表
   * - create() 创建分类
   * - update() 更新分类
   * - remove() 删除分类
   * - enable() 启用分类
   * - disable() 禁用分类
   */
  category,
  
  /**
   * 工序模块
   * - getByOrder() 获取订单工序列表
   * - getDetail() 获取工序详情
   * - getById() 根据ID获取工序
   * - getProgress() 获取工序进度
   * - adminGetList() 管理员获取列表
   * - create() 创建工序
   * - update() 更新工序
   * - remove() 删除工序
   * - start() 开始工序
   * - complete() 完成工序
   * - pause() 暂停工序
   * - batchCreate() 批量创建工序
   * - getTemplates() 获取工序模板
   * - applyTemplate() 应用工序模板
   */
  process,
  
  /**
   * 套餐模块
   * - getList() 获取套餐列表
   * - getDetail() 获取套餐详情
   * - getById() 根据ID获取套餐
   * - adminGetList() 管理员获取列表
   * - create() 创建套餐
   * - update() 更新套餐
   * - remove() 删除套餐
   * - enable() 启用套餐
   * - disable() 禁用套餐
   */
  package: packageApi,
  
  /**
   * 地址模块
   * - getList() 获取地址列表
   * - add() 添加地址
   * - update() 更新地址
   * - remove() 删除地址
   * - setDefault() 设置默认地址
   */
  address,
  
  /**
   * 购物车模块
   * - getList() 获取购物车列表
   * - sync() 同步购物车到云端
   * - add() 添加商品到购物车
   * - update() 更新购物车项
   * - remove() 从购物车移除
   * - clear() 清空购物车
   */
  cart,
  
  /**
   * 云函数工具（高级用法）
   * 提供底层云函数调用能力
   * - call() 调用云函数
   * - clearCache() 清除缓存
   * - clearAllCache() 清除所有缓存
   */
  cloudFunction: {
    call: cloudFunction.call,
    clearCache: cloudFunction.clearCache,
    clearAllCache: cloudFunction.clearAllCache,
    invalidateOrderCache: cloudFunction.invalidateOrderCache
  }
}

// ============ 兼容性导出 ============

/**
 * 为了兼容旧代码，也导出各模块的引用
 */
module.exports = api

/**
 * 命名导出（ES模块兼容）
 * 支持 import { user, order } from '../../api' 的用法
 */
module.exports.user = user
module.exports.order = order
module.exports.product = product
module.exports.category = category
module.exports.process = process
module.exports.package = packageApi
module.exports.address = address
module.exports.cart = cart
module.exports.cloudFunction = api.cloudFunction

/**
 * 默认导出
 * 支持 import api from '../../api' 的用法
 */
module.exports.default = api

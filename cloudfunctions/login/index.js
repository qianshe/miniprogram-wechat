// 云函数入口文件
const cloud = require('wx-server-sdk')
const {
  ErrorCodes,
  success,
  error,
  paramError,
  wrapHandler,
  validateRequired
} = require('../_shared/errorHandler')
const { createLogger, maskOpenId } = require('../_shared/sensitive')

// 创建安全日志记录器
const logger = createLogger('login')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用当前云环境
})

const db = cloud.database()

// 用户登录处理
const userLogin = async (event, wxContext) => {
  const { userInfo } = event

  logger.info('userLogin started', { openid: wxContext.OPENID })

  // 查询用户是否已存在
  const userQuery = await db.collection('users').where({
    openid: wxContext.OPENID
  }).get()

  let userData = {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    nickName: userInfo.nickName,
    avatarUrl: userInfo.avatarUrl,
    role: 0, // 默认普通用户
    isAdmin: false,
    loginTime: new Date(),
    updateTime: new Date()
  }

  if (userQuery.data.length === 0) {
    // 新用户，插入数据库
    logger.info('Creating new user', { openid: wxContext.OPENID })
    const result = await db.collection('users').add({
      data: userData
    })
    userData._id = result._id
  } else {
    // 老用户，更新登录时间和用户信息
    logger.info('Updating existing user', { openid: wxContext.OPENID })
    const existingUser = userQuery.data[0]
    userData = {
      ...existingUser,
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      loginTime: new Date(),
      updateTime: new Date()
    }

    await db.collection('users').doc(existingUser._id).update({
      data: {
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        loginTime: new Date(),
        updateTime: new Date()
      }
    })
  }

  return success({
    openid: wxContext.OPENID,
    userInfo: userData,
    // 云函数环境下不需要token，使用openid作为唯一标识
    role: userData.role,
    isAdmin: userData.isAdmin
  }, '登录成功')
}

// 管理员登录处理
const adminLogin = async (event, wxContext) => {
  const { account, password } = event

  logger.info('adminLogin started', { openid: wxContext.OPENID })

  // 安全说明：管理员凭证从环境变量读取
  // 请在云开发控制台 -> 云函数 -> login -> 配置 -> 环境变量中设置：
  // - ADMIN_USERNAME: 管理员用户名（可选，默认为 'admin'）
  // - ADMIN_PASSWORD: 管理员密码（必须配置，建议使用强密码：至少12位，包含大小写字母、数字和特殊字符）
  const adminAccount = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  // 验证环境变量配置
  if (!adminPassword) {
    logger.error('ADMIN_PASSWORD environment variable is not configured', new Error('ENV_VAR_MISSING'))
    return error(
      ErrorCodes.ENV_VAR_MISSING,
      '管理员密码未配置，请联系系统管理员在云开发控制台配置ADMIN_PASSWORD环境变量'
    )
  }

  if (account === adminAccount && password === adminPassword) {
    // 获取用户信息
    const userQuery = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()

    let userData
    if (userQuery.data.length === 0) {
      // 创建新用户并设置为管理员
      logger.info('Creating new admin user', { openid: wxContext.OPENID })
      userData = {
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID,
        nickName: '管理员',
        avatarUrl: '',
        role: 1, // 管理员角色
        isAdmin: true,
        loginTime: new Date(),
        updateTime: new Date()
      }

      const result = await db.collection('users').add({
        data: userData
      })
      userData._id = result._id
    } else {
      // 更新用户为管理员身份
      logger.info('Updating user to admin', { openid: wxContext.OPENID })
      userData = userQuery.data[0]
      userData = {
        ...userData,
        role: 1,
        isAdmin: true,
        loginTime: new Date(),
        updateTime: new Date()
      }

      await db.collection('users').doc(userData._id).update({
        data: {
          role: 1,
          isAdmin: true,
          loginTime: new Date(),
          updateTime: new Date()
        }
      })
    }

    return success({
      openid: wxContext.OPENID,
      userInfo: userData,
      // 云函数环境下不需要token
      role: userData.role,
      isAdmin: true
    }, '管理员登录成功')
  } else {
    logger.warn('Admin login failed: invalid credentials', { openid: wxContext.OPENID })
    return error(ErrorCodes.AUTH_ERROR, '账号或密码错误')
  }
}

// 主处理逻辑
const handler = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  logger.info('Request received', { action, openid: wxContext.OPENID })

  // 验证action参数
  if (!action) {
    return paramError('缺少action参数')
  }

  // 根据action路由到不同的处理函数
  switch (action) {
    case 'userLogin':
      return await userLogin(event, wxContext)
    case 'adminLogin':
      return await adminLogin(event, wxContext)
    default:
      return paramError(`不支持的action参数: ${action}`)
  }
}

// 导出包装后的处理函数
exports.main = wrapHandler(handler, { functionName: 'login' })

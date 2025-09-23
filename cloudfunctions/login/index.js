// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用当前云环境
})

const db = cloud.database()

// 用户登录处理
const userLogin = async (event, wxContext) => {
  try {
    const { userInfo } = event

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
      const result = await db.collection('users').add({
        data: userData
      })
      userData._id = result._id
    } else {
      // 老用户，更新登录时间和用户信息
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

    return {
      code: 200,
      message: '登录成功',
      data: {
        openid: wxContext.OPENID,
        userInfo: userData,
        // 云函数环境下不需要token，使用openid作为唯一标识
        role: userData.role,
        isAdmin: userData.isAdmin
      }
    }
  } catch (error) {
    console.error('用户登录失败:', error)
    throw error
  }
}

// 管理员登录处理
const adminLogin = async (event, wxContext) => {
  try {
    const { account, password } = event

    // 简单的管理员验证逻辑（实际项目中应使用更安全的验证方式）
    const adminAccount = 'admin' // 默认管理员账号
    const adminPassword = 'admin123' // 默认管理员密码

    if (account === adminAccount && password === adminPassword) {
      // 获取用户信息
      const userQuery = await db.collection('users').where({
        openid: wxContext.OPENID
      }).get()

      let userData
      if (userQuery.data.length === 0) {
        // 创建新用户并设置为管理员
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

      return {
        code: 200,
        message: '管理员登录成功',
        data: {
          openid: wxContext.OPENID,
          userInfo: userData,
          // 云函数环境下不需要token
          role: userData.role,
          isAdmin: true
        }
      }
    } else {
      return {
        code: 401,
        message: '账号或密码错误',
        data: null
      }
    }
  } catch (error) {
    console.error('管理员登录失败:', error)
    throw error
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const { action } = event

    // 根据action路由到不同的处理函数
    switch (action) {
      case 'userLogin':
        return await userLogin(event, wxContext)
      case 'adminLogin':
        return await adminLogin(event, wxContext)
      default:
        return {
          code: 400,
          message: '不支持的action参数',
          data: null
        }
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

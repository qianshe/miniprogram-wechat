// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用当前云环境
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 获取用户信息
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
        token: wxContext.OPENID, // 简化版token，实际项目中应使用JWT
        role: userData.role,
        isAdmin: userData.isAdmin
      }
    }
    
  } catch (error) {
    console.error('登录失败:', error)
    return {
      code: 500,
      message: '登录失败',
      error: error.message
    }
  }
}

# 殡葬/婚庆服务平台小程序

## 项目简介

微信小程序 + 腾讯云开发（CloudBase）项目，提供白事服务的一站式小程序平台，集成商品展示、购物车、订单管理等功能。

## 快速开始

### 1. 环境要求

- Node.js >= 16.x
- 微信开发者工具
- 小程序账号（需配置合法域名）
- 腾讯云开发（CloudBase）环境

### 2. 配置文件初始化

复制示例配置文件并填写实际配置：

```bash
cp cloudbaserc.example.json cloudbaserc.json
cp project.config.example.json project.config.json
cp config/cloud.config.example.js config/cloud.config.js
```

### 3. 环境变量配置

需要在 CloudBase 控制台配置以下环境变量：

| 云函数 | 环境变量名 | 说明 |
|--------|------------|------|
| login | ADMIN_PASSWORD | 管理员登录密码 |

配置路径：CloudBase 控制台 → 云函数 → login → 函数配置 → 环境变量

### 4. 安装依赖

```bash
npm install --production
```

### 5. 运行项目

1. 在微信开发者工具中导入项目目录
2. 工具菜单栏 → 构建 npm
3. 点击"编译"按钮启动开发模式

## 项目结构

```
miniprogram1/
├── api/                          # 前端 API 封装
├── assets/                       # 静态资源
├── cloudfunctions/               # 云函数
│   ├── _shared/                  # 云函数共享模块
│   ├── login/                    # 管理员登录
│   ├── orderManagement/          # 订单管理
│   ├── productManagement/        # 商品管理
│   ├── categoryManagement/       # 分类管理
│   └── processManagement/        # 流程管理
├── config/                       # 配置文件
├── custom-tab-bar/               # 自定义导航栏
├── pages/                        # 页面文件
├── utils/                        # 前端工具模块
├── cloudbaserc.json              # CloudBase CLI 配置
├── project.config.json           # 微信开发者工具配置
└── app.js                        # 小程序入口
```

### 配置文件

| 文件路径 | 说明 |
|----------|------|
| [`config/cloud.config.js`](config/cloud.config.js) | 云开发环境配置（环境ID等） |
| [`config/api.config.js`](config/api.config.js) | API 配置（集合名、超时时间、分页等） |
| [`config/field-permissions.js`](config/field-permissions.js) | 字段级权限配置 |
| [`cloudbaserc.json`](cloudbaserc.json) | CloudBase CLI 配置 |
| [`project.config.json`](project.config.json) | 微信开发者工具配置 |

### 前端工具模块（utils/）

| 文件路径 | 说明 |
|----------|------|
| [`utils/request.js`](utils/request.js) | 增强版请求工具（重试、超时、拦截器） |
| [`utils/cloudFunction.js`](utils/cloudFunction.js) | 云函数调用封装（缓存、重试、追踪） |
| [`utils/trace.js`](utils/trace.js) | 请求追踪 ID 生成 |
| [`utils/permission.js`](utils/permission.js) | 前端权限校验 |
| [`utils/sensitive.js`](utils/sensitive.js) | 敏感数据脱敏 |
| [`utils/fieldAccess.js`](utils/fieldAccess.js) | 字段访问控制 |

### 前端 API 封装（api/）

| 文件路径 | 说明 |
|----------|------|
| [`api/index.js`](api/index.js) | 统一 API 入口 |
| [`api/user.js`](api/user.js) | 用户相关 API |
| [`api/order.js`](api/order.js) | 订单相关 API |
| [`api/product.js`](api/product.js) | 商品相关 API |
| [`api/category.js`](api/category.js) | 分类相关 API |
| [`api/process.js`](api/process.js) | 流程相关 API |

### 云函数共享模块（cloudfunctions/_shared/）

| 文件路径 | 说明 |
|----------|------|
| [`cloudfunctions/_shared/errorHandler.js`](cloudfunctions/_shared/errorHandler.js) | 统一错误处理 |
| [`cloudfunctions/_shared/logger.js`](cloudfunctions/_shared/logger.js) | 日志中间件（含 TraceID） |
| [`cloudfunctions/_shared/permission.js`](cloudfunctions/_shared/permission.js) | 权限校验中间件 |
| [`cloudfunctions/_shared/sensitive.js`](cloudfunctions/_shared/sensitive.js) | 敏感数据处理 |
| [`cloudfunctions/_shared/fieldFilter.js`](cloudfunctions/_shared/fieldFilter.js) | 字段级过滤 |

### 云函数列表

| 云函数名称 | 说明 |
|------------|------|
| `login` | 管理员登录认证 |
| `orderManagement` | 订单增删改查 |
| `productManagement` | 商品增删改查 |
| `categoryManagement` | 分类增删改查 |
| `processManagement` | 流程步骤管理 |

## 数据库集合

| 集合名称 | 说明 |
|----------|------|
| `users` | 用户信息 |
| `orders` | 订单数据 |
| `products` | 商品数据 |
| `categories` | 分类数据 |
| `processSteps` | 流程步骤 |
| `addresses` | 收货地址 |
| `carts` | 购物车 |
| `feedback` | 用户反馈 |
| `admins` | 管理员信息 |

## 核心功能

### 白事服务模块

- 殡葬流程步骤指导
- 服务轮播图展示

### 红事服务模块

- 婚礼/满月酒等庆典流程管理
- 事件步骤跟踪

### 通用功能

- 商品详情查看
- 购物车管理
- 订单管理
- 用户信息管理
- 自定义导航栏

## 安全说明

### 敏感配置保护

以下敏感配置文件已添加到 `.gitignore`，不会提交到版本控制：

- `cloudbaserc.json` - 包含环境 ID
- `project.config.json` - 包含 AppID
- `config/cloud.config.js` - 包含云开发配置

### 管理员密码

管理员密码通过云函数环境变量配置，不在代码中硬编码：

- 配置位置：CloudBase 控制台 → 云函数 → login → 环境变量 → `ADMIN_PASSWORD`

### 字段级权限控制

- 前端通过 [`config/field-permissions.js`](config/field-permissions.js) 配置字段访问权限
- 云函数通过 [`cloudfunctions/_shared/fieldFilter.js`](cloudfunctions/_shared/fieldFilter.js) 实现字段过滤
- 敏感数据通过 [`cloudfunctions/_shared/sensitive.js`](cloudfunctions/_shared/sensitive.js) 进行脱敏处理

## 注意事项

- 首次使用需要复制示例配置文件并填写实际配置
- 云函数部署前需要在 CloudBase 控制台配置环境变量
- 用户系统需要配置微信开放平台权限
- API 接口使用云函数实现，确保已正确部署所有云函数
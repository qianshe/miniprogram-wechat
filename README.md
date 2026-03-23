<!-- [殡葬平台转型] 已更新项目定位 -->
# 殡葬服务平台小程序

## 项目简介

微信小程序 + 腾讯云开发（CloudBase）项目，提供专业殡葬服务的一站式小程序平台，集成商品展示、服务套餐、意向登记、流程指导等功能。采用线下结算模式，小程序仅用于展示和需求登记。

## 业务模式

本小程序采用**线下结算模式**：
- 用户通过小程序浏览商品和服务套餐
- 提交意向单进行需求登记
- 商家通过电话/微信与用户沟通确认
- 线下完成服务交付和款项结算
- 管理端记录线下收款状态

**重要说明**：本小程序仅用于展示与需求登记，不提供在线支付功能，最终以电话/微信沟通及线下结算为准。

### 核心功能

| 模块 | 功能描述 |
|------|----------|
| **白事服务** | 殡葬流程步骤指导、服务轮播图展示、服务内容参考 |
| **商品系统** | 商品分类浏览、商品详情、服务咨询引导 |
| **套餐系统** | 服务套餐展示、套餐详情、线下咨询引导 |
| **用户中心** | 用户信息、收货地址、服务记录查询、意见反馈 |
| **管理后台** | 商品/分类/服务记录/套餐的增删改查管理，线下收款状态记录 |

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
cp miniprogram/config/cloud.config.example.js miniprogram/config/cloud.config.js
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

## 技术栈

| 类型 | 技术 |
|------|------|
| **前端框架** | 微信小程序原生开发 |
| **UI 组件库** | TDesign Miniprogram |
| **后端服务** | 腾讯云开发 CloudBase（Serverless） |
| **数据库** | CloudBase NoSQL 数据库 |
| **存储** | CloudBase 云存储 |

## 项目结构

```
miniprogram1/
├── miniprogram/                  # 小程序前端根目录
│   ├── api/                      # 前端 API 封装
│   ├── assets/                   # 静态资源（字体等）
│   ├── components/               # 自定义组件
│   ├── config/                   # 前端配置文件
│   ├── custom-tab-bar/           # 自定义底部导航栏
│   ├── miniprogram_npm/          # 小程序 npm 产物
│   ├── pages/                    # 页面与分包
│   ├── services/                 # 前端服务层
│   ├── utils/                    # 前端工具模块
│   ├── app.js                    # 小程序入口
│   ├── app.json                  # 小程序配置
│   ├── app.wxss                  # 全局样式
│   └── sitemap.json              # 小程序 sitemap
├── cloudbase/                    # CloudBase 配置
├── cloudfunctions/               # 云函数
│   ├── _shared/                  # 云函数共享模块
│   ├── login/                    # 管理员登录认证
│   ├── orderManagement/          # 服务记录/订单兼容管理
│   ├── productManagement/        # 商品管理
│   ├── categoryManagement/       # 分类管理
│   ├── processManagement/        # 流程管理
│   ├── packageManagement/        # 套餐管理
│   ├── userDataManagement/       # 用户数据管理
│   └── wxpaycommon/              # 微信支付通用模块
├── database/                     # 数据库索引配置
├── docs/                         # 项目文档
├── rules/                        # CloudBase MCP 规则
├── scripts/                      # 构建脚本
├── cloudbaserc.json              # CloudBase CLI 配置
├── project.config.json           # 微信开发者工具配置
└── package.json                  # Node.js 脚本与依赖
```

## 页面说明

### 主包页面

| 页面路径 | 说明 |
|----------|------|
| `pages/index_home` | 启动页/欢迎页 |
| `pages/index` | 首页（服务入口、轮播图） |
| `pages/goods/category` | 商品分类列表 |
| `pages/goods/detail` | 商品详情 |
| `pages/package/list` | 套餐列表 |
| `pages/package/detail` | 套餐详情 |
| `pages/package/confirm` | 服务确认信息页（仅展示与联系引导） |
| `pages/process/list` | 流程列表 |
| `pages/process/detail` | 流程详情 |
| `pages/user` | 用户中心 |
| `pages/address` | 地址管理 |
| `pages/feedback` | 意见反馈 |
| `pages/scan-result` | 扫码结果 |

### 服务记录分包（pages/order）

| 页面路径 | 说明 |
|----------|------|
| `pages/order/list` | 我的服务记录 |
| `pages/order/detail` | 服务记录详情 |
| `pages/order/confirm` | 管理员确认页（普通用户不走在线提交流程） |
| `pages/order/create` | 管理员创建服务记录 |
| `pages/order/user-confirm` | 用户认领后补充/确认服务信息 |

### 管理后台分包（pages/admin）

| 页面路径 | 说明 |
|----------|------|
| `admin/login` | 管理员登录 |
| `admin/index` | 管理后台首页 |
| `admin/category/list` | 分类管理列表 |
| `admin/category/edit` | 分类编辑 |
| `admin/product/list` | 商品管理列表 |
| `admin/product/create` | 商品创建 |
| `admin/product/edit` | 商品编辑 |
| `admin/product/scan` | 商品扫码 |
| `admin/order/list` | 订单管理列表 |
| `admin/order/create` | 订单创建 |
| `admin/order/qr-code` | 订单二维码 |
| `admin/package/list` | 套餐管理列表 |
| `admin/package/edit` | 套餐编辑 |
| `admin/user/list` | 用户管理列表 |
| `admin/assets/images` | 图片资源管理 |

## 配置文件说明

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/config/cloud.config.js` | 云开发环境配置（环境ID等） |
| `miniprogram/config/api.config.js` | API 配置（集合名、超时时间、分页等） |
| `miniprogram/config/field-permissions.js` | 字段级权限配置 |
| `miniprogram/config/assets.config.js` | 静态资源配置 |
| `miniprogram/config/contact.js` | 联系方式配置 |
| `miniprogram/config/mock.js` | Mock 数据配置 |
| `cloudbaserc.json` | CloudBase CLI 配置 |
| `project.config.json` | 微信开发者工具配置 |

## 前端模块说明

### 工具模块（utils/）

| 文件 | 说明 |
|------|------|
| `request.js` | 增强版请求工具（重试、超时、拦截器） |
| `cloudFunction.js` | 云函数调用封装（缓存、重试、追踪） |
| `auth.js` | 用户认证工具 |
| `trace.js` | 请求追踪 ID 生成 |
| `permission.js` | 前端权限校验 |
| `sensitive.js` | 敏感数据脱敏 |
| `errorHandler.js` | 错误处理工具 |
| `validation.js` | 数据验证工具 |
| `util.js` | 通用工具函数 |

### API 封装（api/）

| 文件 | 说明 |
|------|------|
| `order.js` | 服务记录/订单兼容 API |
| `product.js` | 商品相关 API |
| `process.js` | 流程相关 API |
| `package.js` | 套餐相关 API |
| `address.js` | 地址相关 API |

## 云函数说明

### 云函数列表

| 云函数名称 | 说明 |
|------------|------|
| `login` | 用户/管理员登录认证 |
| `orderManagement` | 订单增删改查 |
| `productManagement` | 商品增删改查 |
| `categoryManagement` | 分类增删改查 |
| `processManagement` | 流程步骤管理 |
| `packageManagement` | 套餐管理 |
| `userManagement` | 用户管理（管理员端） |
| `userDataManagement` | 用户数据管理（地址、地理编码等） |

> **注意**：旧版 `wxpaycommon` 目录已清理（未完成的支付预留模块，无功能代码）。

### 共享模块（cloudfunctions/_shared/）

| 文件 | 说明 |
|------|------|
| `errorHandler.js` | 统一错误处理 |
| `logger.js` | 日志中间件（含 TraceID） |
| `permission.js` | 权限校验中间件 |
| `sensitive.js` | 敏感数据处理 |
| `fieldFilter.js` | 字段级过滤 |

## 数据库集合

| 集合名称 | 说明 |
|----------|------|
| `users` | 用户信息 |
| `orders` | 订单数据 |
| `products` | 商品数据 |
| `categories` | 分类数据 |
| `packages` | 套餐数据 |
| `processSteps` | 流程步骤 |
| `addresses` | 收货地址 |
| `feedback` | 用户反馈 |
| `admins` | 管理员信息 |

## 安全说明

### 敏感配置保护

以下敏感配置文件已添加到 `.gitignore`，不会提交到版本控制：

- `cloudbaserc.json` - 包含环境 ID
- `project.config.json` - 包含 AppID
- `miniprogram/config/cloud.config.js` - 包含云开发配置

### 管理员密码

管理员密码通过云函数环境变量配置，不在代码中硬编码：

- 配置位置：CloudBase 控制台 → 云函数 → login → 环境变量 → `ADMIN_PASSWORD`

### 字段级权限控制

- 前端通过 `config/field-permissions.js` 配置字段访问权限
- 云函数通过 `cloudfunctions/_shared/fieldFilter.js` 实现字段过滤
- 敏感数据通过 `cloudfunctions/_shared/sensitive.js` 进行脱敏处理

## 开发脚本

```bash
# 安装依赖
npm install --production

# 修补 TDesign 图标字体
npm run patch:tdesign

# 同步云函数共享模块
npm run sync-shared

# 检查共享模块同步状态
npm run check-shared
```

## 注意事项

1. **首次使用**：需要复制示例配置文件并填写实际配置
2. **云函数部署**：部署前需要在 CloudBase 控制台配置环境变量
3. **NPM 构建**：在微信开发者工具中需要先执行"构建 npm"
4. **共享模块同步**：修改 `_shared` 目录后需运行 `npm run sync-shared` 同步到各云函数
5. **权限配置**：用户系统需要配置微信开放平台权限

## 相关文档

- [API 接口文档](docs/api-documentation.md)
- [管理后台 API](docs/admin-api.md)
- [页面 API 使用说明](docs/page-api-usage.md)
- [流程管理完整指南](docs/process-management-complete-guide.md)
- [样式问题解决指南](docs/小程序样式问题解决指南.md)

---

## AI 开发规范：分块写入协议（Chunked Write Protocol）

> ⚠️ **重要**：所有 AI 辅助开发工具在进行文件操作时必须遵循以下规范，违反规则会导致服务器超时和任务失败。

### 绝对限制

| 限制类型 | 行数 | 说明 |
|----------|------|------|
| **最大限制** | 350 行 | 单次写入/编辑操作的绝对上限，无例外 |
| **推荐限制** | 300 行 | 最佳性能的推荐上限 |

### 强制分块写入策略

#### 新建文件（>300 行）

1. **首次写入**：使用 `write_to_file`/`fsWrite` 写入前 250-300 行
2. **追加内容**：使用文件追加操作，每次追加 250-300 行
3. **重复操作**：继续追加直到完成

#### 编辑现有文件

1. 使用精确编辑（`apply_diff`/定向编辑）- 只修改需要的部分
2. **禁止**重写整个文件 - 使用增量修改
3. 将大型重构拆分为多个小的、聚焦的编辑

#### 大型代码生成

1. 按逻辑部分生成（imports、types、functions 分开）
2. 每个部分作为单独的操作写入
3. 后续部分使用追加操作

### 正确与错误示例

```
✅ 正确：写入 600 行文件
   - 操作 1：写入第 1-300 行（初始文件创建）
   - 操作 2：追加第 301-600 行

✅ 正确：编辑多个函数
   - 操作 1：编辑函数 A
   - 操作 2：编辑函数 B
   - 操作 3：编辑函数 C

❌ 错误：单次操作写入 500 行 → 超时
❌ 错误：为了修改 5 行而重写整个文件 → 超时
❌ 错误：生成大量代码块而不分块 → 超时
```

### 为什么这很重要

- 服务器对操作有 2-3 分钟的超时限制
- 大型写入会超过超时时间并**完全失败**
- 分块写入更**快速**且更**可靠**
- 失败的写入会浪费时间并需要重试

> 💡 **记住**：如有疑问，每次操作写入**更少**内容。多个小操作 > 一个大操作。

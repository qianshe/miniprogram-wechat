#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const exists = (rel) => fs.existsSync(path.join(root, rel))

const appJson = read('app.json')
const permissionJs = read('utils/permission.js')
const processListJs = read('pages/admin/process/list/list.js')
const processListWxml = read('pages/admin/process/list/list.wxml')
const processEditJs = read('pages/admin/process/edit/edit.js')

const checks = {
  editPageExists: exists('pages/admin/process/edit/edit.js')
    && exists('pages/admin/process/edit/edit.wxml')
    && exists('pages/admin/process/edit/edit.json')
    && exists('pages/admin/process/edit/edit.wxss'),
  appRouteRegistered: /"process\/edit\/edit"/.test(appJson),
  adminPermissionRegistered: /'pages\/admin\/process\/edit\/edit'/.test(permissionJs),
  listHasCreateHandler: /createStep\(\)/.test(processListJs),
  listHasEditHandler: /editStep\(e\)/.test(processListJs),
  listHasDeleteHandler: /deleteStep\(e\)/.test(processListJs),
  listNavigatesToEditPage: /\/pages\/admin\/process\/edit\/edit/.test(processListJs),
  listUsesDeleteApi: /adminApi\.deleteProcessStep\(/.test(processListJs),
  listHasActionButtons: /bindtap="createStep"/.test(processListWxml)
    && /catchtap="editStep"/.test(processListWxml)
    && /catchtap="deleteStep"/.test(processListWxml),
  editUsesAdminGuard: /checkAdminAccess\(\)/.test(processEditJs),
  editUsesDetailApi: /adminApi\.getStepDetail\(/.test(processEditJs),
  editUsesCreateApi: /adminApi\.createProcessStep\(/.test(processEditJs),
  editUsesUpdateApi: /adminApi\.updateProcessStep\(/.test(processEditJs),
  editPreservesTypeField: /type:\s*formData\.type \|\| CURRENT_SYSTEM_TYPE/.test(processEditJs)
}

const allPassed = Object.values(checks).every(Boolean)

Object.entries(checks).forEach(([name, value]) => {
  console.log(`[verify-admin-process] ${name}=${value}`)
})

console.log(`[verify-admin-process] STATE=${allPassed ? 'TARGET' : 'ERROR'}`)

if (!allPassed) {
  console.error('[verify-admin-process] FAIL: 治丧指南管理端编辑链路仍未完整接通。')
  process.exit(1)
}

console.log('[verify-admin-process] PASS (TARGET)')

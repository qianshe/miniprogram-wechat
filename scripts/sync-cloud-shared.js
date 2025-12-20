/**
 * 云函数共享文件同步脚本
 * 将 cloudfunctions/_shared/ 同步到各云函数的 _shared/ 目录
 * 
 * 用法:
 *   node scripts/sync-cloud-shared.js          # 执行同步
 *   node scripts/sync-cloud-shared.js --check  # 仅检查一致性
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLOUDFUNCTIONS_DIR = path.join(__dirname, '..', 'cloudfunctions');
const SHARED_SOURCE_DIR = path.join(CLOUDFUNCTIONS_DIR, '_shared');
const EXCLUDE_DIRS = ['_shared', 'node_modules'];

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function getCloudFunctionDirs() {
  return fs.readdirSync(CLOUDFUNCTIONS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !EXCLUDE_DIRS.includes(dirent.name))
    .map(dirent => dirent.name);
}

function getSharedFiles() {
  return fs.readdirSync(SHARED_SOURCE_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);
}

function checkConsistency() {
  const cloudFunctions = getCloudFunctionDirs();
  const sharedFiles = getSharedFiles();
  let hasInconsistency = false;
  const results = [];

  console.log('检查云函数共享文件一致性...\n');
  console.log(`源目录: ${SHARED_SOURCE_DIR}`);
  console.log(`共享文件: ${sharedFiles.join(', ')}`);
  console.log(`云函数: ${cloudFunctions.join(', ')}\n`);

  for (const funcName of cloudFunctions) {
    const funcSharedDir = path.join(CLOUDFUNCTIONS_DIR, funcName, '_shared');
    const funcResults = { name: funcName, missing: [], outdated: [], ok: [] };

    for (const fileName of sharedFiles) {
      const sourceFile = path.join(SHARED_SOURCE_DIR, fileName);
      const targetFile = path.join(funcSharedDir, fileName);
      const sourceHash = getFileHash(sourceFile);
      const targetHash = getFileHash(targetFile);

      if (!targetHash) {
        funcResults.missing.push(fileName);
        hasInconsistency = true;
      } else if (sourceHash !== targetHash) {
        funcResults.outdated.push(fileName);
        hasInconsistency = true;
      } else {
        funcResults.ok.push(fileName);
      }
    }
    results.push(funcResults);
  }

  for (const result of results) {
    const status = result.missing.length === 0 && result.outdated.length === 0 ? '✓' : '✗';
    console.log(`${status} ${result.name}/`);
    if (result.missing.length > 0) {
      console.log(`    缺失: ${result.missing.join(', ')}`);
    }
    if (result.outdated.length > 0) {
      console.log(`    过期: ${result.outdated.join(', ')}`);
    }
  }

  console.log('');
  if (hasInconsistency) {
    console.log('发现不一致，请运行 npm run sync-shared 进行同步');
    process.exit(1);
  } else {
    console.log('所有云函数共享文件一致 ✓');
  }
}

function syncFiles() {
  const cloudFunctions = getCloudFunctionDirs();
  const sharedFiles = getSharedFiles();
  let syncCount = 0;

  console.log('同步云函数共享文件...\n');
  console.log(`源目录: ${SHARED_SOURCE_DIR}`);
  console.log(`共享文件: ${sharedFiles.join(', ')}`);
  console.log(`云函数: ${cloudFunctions.join(', ')}\n`);

  for (const funcName of cloudFunctions) {
    const funcSharedDir = path.join(CLOUDFUNCTIONS_DIR, funcName, '_shared');
    
    if (!fs.existsSync(funcSharedDir)) {
      fs.mkdirSync(funcSharedDir, { recursive: true });
      console.log(`创建目录: ${funcName}/_shared/`);
    }

    for (const fileName of sharedFiles) {
      const sourceFile = path.join(SHARED_SOURCE_DIR, fileName);
      const targetFile = path.join(funcSharedDir, fileName);
      const sourceHash = getFileHash(sourceFile);
      const targetHash = getFileHash(targetFile);

      if (sourceHash !== targetHash) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`  同步: ${funcName}/_shared/${fileName}`);
        syncCount++;
      }
    }
  }

  console.log('');
  if (syncCount > 0) {
    console.log(`同步完成，更新了 ${syncCount} 个文件 ✓`);
  } else {
    console.log('所有文件已是最新，无需同步 ✓');
  }
}

const isCheckMode = process.argv.includes('--check');

if (isCheckMode) {
  checkConsistency();
} else {
  syncFiles();
}

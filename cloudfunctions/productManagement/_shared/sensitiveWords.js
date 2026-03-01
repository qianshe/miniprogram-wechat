/**
 * 敏感词列表（可配置）
 */
const SENSITIVE_WORDS = [
  '烟花爆竹',
  '烟花',
  '爆竹',
  '鞭炮',
  '烟火',
  '焰火'
];

/**
 * 检查文本是否包含敏感词
 * @param {string} text - 待检查文本
 * @param {string} fieldName - 字段名称（预留用于日志/扩展）
 * @returns {{ valid: boolean, matchedWords: string[] }}
 */
function checkSensitiveWords(text, fieldName) {
  if (!text || typeof text !== 'string') {
    return { valid: true, matchedWords: [] };
  }

  const lowerText = text.toLowerCase();
  const matchedWords = SENSITIVE_WORDS.filter(word => lowerText.includes(word.toLowerCase()));

  return {
    valid: matchedWords.length === 0,
    matchedWords
  };
}

module.exports = {
  SENSITIVE_WORDS,
  checkSensitiveWords
};

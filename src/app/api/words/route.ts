import { NextResponse } from 'next/server'

// 单词库 - 包含各种诗意的单词
const WORD_POOL = [
  // 自然
  '月亮', '星星', '太阳', '云朵', '彩虹', '雨滴', '雪花', '微风',
  '森林', '海洋', '山峰', '河流', '花朵', '蝴蝶', '鸟儿', '萤火虫',
  // 情感
  '思念', '梦想', '希望', '温柔', '宁静', '忧伤', '喜悦', '勇气',
  '爱情', '友情', '回忆', '未来', '自由', '孤独', '温暖', '心动',
  // 时间
  '黄昏', '黎明', '午夜', '春天', '夏天', '秋天', '冬天', '永恒',
  // 物品
  '灯笼', '古琴', '书卷', '茶香', '琴声', '烛光', '窗台', '花园',
  // 抽象
  '故事', '传说', '奇迹', '缘分', '命运', '轮回', '天涯', '海角',
  // 颜色
  '金色', '银色', '翠绿', '蔚蓝', '绯红', '纯白', '漆黑', '琥珀',
  // 动作
  '飞舞', '飘落', '绽放', '沉睡', '醒来', '追寻', '等待', '相遇',
  // 状态
  '璀璨', '朦胧', '清澈', '寂静', '繁华', '落寞', '轻盈', '深沉'
]

// 已使用的单词（确保不重复）
let usedWords: string[] = []

export async function GET() {
  // 如果所有单词都用完了，重置
  const availableWords = WORD_POOL.filter(w => !usedWords.includes(w))
  
  if (availableWords.length === 0) {
    usedWords = []
  }
  
  // 随机选择一个未使用的单词
  const pool = availableWords.length > 0 ? availableWords : WORD_POOL
  const word = pool[Math.floor(Math.random() * pool.length)]
  
  // 标记为已使用
  if (!usedWords.includes(word)) {
    usedWords.push(word)
  }
  
  return NextResponse.json({ word })
}

// 重置单词库
export async function DELETE() {
  usedWords = []
  return NextResponse.json({ success: true })
}

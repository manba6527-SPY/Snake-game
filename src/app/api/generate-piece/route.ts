import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { word, previousWords = [], previousLines = [] } = await request.json()

    if (!word) {
      return NextResponse.json({ error: '需要提供单词' }, { status: 400 })
    }

    const zai = await ZAI.create()

    // 生成单句诗
    const poemPrompt = `你是一位诗人。已收集的词语：${previousWords.length > 0 ? previousWords.join('、') : '无'}。
当前新词语：「${word}」
${previousLines.length > 0 ? `已创作的诗句：\n${previousLines.join('\n')}` : ''}

请用「${word}」创作一句优美的诗句（10-20字），要与前文呼应，形成连贯的诗意。只输出诗句本身，不要标点符号结尾。`

    const poemCompletion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: '你是一位才华横溢的中文诗人，擅长创作意境优美的诗句。'
        },
        {
          role: 'user',
          content: poemPrompt
        }
      ],
      thinking: { type: 'disabled' }
    })

    const line = poemCompletion.choices[0]?.message?.content?.trim() || `${word}轻轻飘落`

    // 生成图像
    const imagePrompt = `A poetic scene representing the Chinese word "${word}" in an artistic, dreamlike style. Ethereal, soft lighting, watercolor texture, minimalist composition, pastel colors, artistic illustration, high quality.`

    const imageResponse = await zai.images.generations.create({
      prompt: imagePrompt,
      size: '1024x1024'
    })

    const imageBase64 = imageResponse.data[0].base64

    // 保存图像
    const outputDir = path.join(process.cwd(), 'public', 'puzzle')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const filename = `piece_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
    const filepath = path.join(outputDir, filename)
    
    const buffer = Buffer.from(imageBase64, 'base64')
    fs.writeFileSync(filepath, buffer)

    return NextResponse.json({ 
      word,
      line,
      imageUrl: `/puzzle/${filename}`
    })
  } catch (error) {
    console.error('生成失败:', error)
    return NextResponse.json(
      { error: '生成失败，请重试' }, 
      { status: 500 }
    )
  }
}

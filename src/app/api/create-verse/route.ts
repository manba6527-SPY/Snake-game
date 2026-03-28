import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { word, index, previousVerses } = await request.json()

    if (!word) {
      return NextResponse.json({ error: '需要提供单词' }, { status: 400 })
    }

    const zai = await ZAI.create()

    // 生成诗句
    const contextPrompt = previousVerses && previousVerses.length > 0
      ? `之前的诗句：\n${previousVerses.map((v: {word: string, verse: string}) => `「${v.word}」- ${v.verse}`).join('\n')}\n\n请保持风格一致，创作下一句。`
      : '这是第一句，请为整首诗奠定基调。'

    const versePrompt = `你是一位诗人。请根据单词「${word}」创作一句简短优美的诗句（10-15个字）。

${contextPrompt}

要求：
1. 诗句要包含单词「${word}」
2. 意境优美，朗朗上口
3. 只输出这一句诗，不要其他任何内容`

    const verseCompletion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: '你是一位才华横溢的中文诗人，擅长创作简短优美的诗句。你的诗句意境深远，用词精准。'
        },
        {
          role: 'user',
          content: versePrompt
        }
      ],
      thinking: { type: 'disabled' }
    })

    const verse = verseCompletion.choices[0]?.message?.content?.trim() || `风吹${word}入梦来`

    // 生成图像描述
    const imageDescPrompt = `Based on this Chinese poetic verse, describe a beautiful visual scene for image generation:

Verse: "${verse}" (keyword: ${word})

Describe a dreamy, artistic scene that captures the mood and imagery of this verse. Include colors, atmosphere, and key visual elements. Keep it under 50 words.`

    const descCompletion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: 'You are an expert at creating vivid image descriptions for AI art generation, specializing in poetic and ethereal scenes.'
        },
        {
          role: 'user',
          content: imageDescPrompt
        }
      ],
      thinking: { type: 'disabled' }
    })

    const imageDescription = descCompletion.choices[0]?.message?.content || `A dreamy scene with ${word}, ethereal atmosphere, soft lighting`

    // 生成图像
    const imageResponse = await zai.images.generations.create({
      prompt: `${imageDescription}, artistic, poetic, dreamlike, ethereal, soft colors, high quality`,
      size: '1024x1024'
    })

    const imageBase64 = imageResponse.data[0].base64

    // 保存图像
    const outputDir = path.join(process.cwd(), 'public', 'generated')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const filename = `verse_${Date.now()}_${index}.png`
    const filepath = path.join(outputDir, filename)
    
    const buffer = Buffer.from(imageBase64, 'base64')
    fs.writeFileSync(filepath, buffer)

    return NextResponse.json({ 
      success: true,
      word,
      verse,
      imageUrl: `/generated/${filename}`,
      index
    })
  } catch (error) {
    console.error('诗句生成失败:', error)
    return NextResponse.json(
      { error: '诗句生成失败' }, 
      { status: 500 }
    )
  }
}

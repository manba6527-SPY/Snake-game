import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { poem, words } = await request.json()

    if (!poem) {
      return NextResponse.json({ error: '需要提供诗歌内容' }, { status: 400 })
    }

    const zai = await ZAI.create()

    // 根据诗歌生成图像描述
    const descriptionPrompt = `请根据以下诗歌内容，用英文描述一个适合这首诗意境的视觉画面。描述应该包含：
1. 主要场景和氛围
2. 色调建议
3. 关键视觉元素

诗歌：
${poem}

请只用英文输出描述，不要加任何解释。描述要具体、有画面感，适合AI图像生成。`

    const descriptionCompletion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: 'You are an expert at describing visual scenes for AI image generation. You create detailed, evocative descriptions that capture the mood and essence of poems.'
        },
        {
          role: 'user',
          content: descriptionPrompt
        }
      ],
      thinking: { type: 'disabled' }
    })

    const imageDescription = descriptionCompletion.choices[0]?.message?.content || ''

    // 生成图像
    const response = await zai.images.generations.create({
      prompt: `${imageDescription}, artistic, ethereal, dreamlike, high quality, detailed`,
      size: '1024x1024'
    })

    const imageBase64 = response.data[0].base64

    // 保存图像到public目录
    const outputDir = path.join(process.cwd(), 'public', 'generated')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const filename = `poem_${Date.now()}.png`
    const filepath = path.join(outputDir, filename)
    
    const buffer = Buffer.from(imageBase64, 'base64')
    fs.writeFileSync(filepath, buffer)

    return NextResponse.json({ 
      success: true,
      imageUrl: `/generated/${filename}`,
      description: imageDescription,
      poem,
      words
    })
  } catch (error) {
    console.error('图像生成失败:', error)
    return NextResponse.json(
      { error: '图像生成失败，请重试' }, 
      { status: 500 }
    )
  }
}

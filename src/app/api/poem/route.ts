import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const { words, remix = false, previousPoem = '' } = await request.json()

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: '需要提供单词列表' }, { status: 400 })
    }

    const zai = await ZAI.create()

    let prompt: string
    
    if (remix && previousPoem) {
      // 重新混合诗歌
      prompt = `你是一位才华横溢的诗人。之前我给你这些词语：${words.join('、')}，你创作了这首诗：

"${previousPoem}"

请用完全不同的风格和角度，重新创作一首诗。可以是不同的体裁（如七言绝句、五言律诗、现代诗、词等），但要同样使用这些词语。请只输出诗歌内容，不要加任何解释。`
    } else {
      // 首次创作诗歌
      prompt = `你是一位才华横溢的诗人。请用以下词语创作一首优美的中文诗歌（可以是古诗、现代诗或词）：

词语：${words.join('、')}

要求：
1. 诗歌要包含所有给定的词语
2. 意境优美，朗朗上口
3. 可以是古体诗、现代诗或词牌
4. 请只输出诗歌内容，不要加任何解释或标题`
    }

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: '你是一位才华横溢的中文诗人，擅长创作各种风格的诗歌，包括古诗、现代诗和词。你的诗歌意境优美，用词精准。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      thinking: { type: 'disabled' }
    })

    const poem = completion.choices[0]?.message?.content || ''

    return NextResponse.json({ 
      poem: poem.trim(),
      words 
    })
  } catch (error) {
    console.error('诗歌生成失败:', error)
    return NextResponse.json(
      { error: '诗歌生成失败，请重试' }, 
      { status: 500 }
    )
  }
}

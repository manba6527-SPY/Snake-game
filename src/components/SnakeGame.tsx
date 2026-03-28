'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Play, RotateCcw, Pause, Trophy, Gamepad2, Sparkles, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react'

// 游戏配置
const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SPEED = 140
const SPEED_INCREASE = 2
const WORDS_NEEDED = 8

// 方向类型
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }

// 诗句拼图
interface PoemPiece {
  word: string
  line: string
  imageUrl: string
  index: number
}

// 游戏状态
type GameState = 'idle' | 'playing' | 'paused' | 'gameover' | 'completed'

export default function SnakeGame() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }])
  const [wordPosition, setWordPosition] = useState<Position>({ x: 15, y: 10 })
  const [currentWord, setCurrentWord] = useState<string>('')
  const [direction, setDirection] = useState<Direction>('RIGHT')
  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [speed, setSpeed] = useState(INITIAL_SPEED)
  
  // 诗句拼图收集
  const [pieces, setPieces] = useState<PoemPiece[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  
  const directionRef = useRef(direction)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 生成随机位置
  const generateRandomPosition = useCallback((snakeBody: Position[]): Position => {
    let newPosition: Position
    do {
      newPosition = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      }
    } while (snakeBody.some(segment => segment.x === newPosition.x && segment.y === newPosition.y))
    return newPosition
  }, [])

  // 获取新单词
  const fetchNewWord = useCallback(async () => {
    try {
      const response = await fetch('/api/words')
      const data = await response.json()
      setCurrentWord(data.word)
    } catch {
      setCurrentWord('星星')
    }
  }, [])

  // 生成单句诗和图像
  const generatePiece = useCallback(async (word: string) => {
    setIsGenerating(true)
    
    try {
      const previousWords = pieces.map(p => p.word)
      const previousLines = pieces.map(p => p.line)
      
      const response = await fetch('/api/generate-piece', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          word, 
          previousWords,
          previousLines
        })
      })
      
      const data = await response.json()
      
      if (data.line && data.imageUrl) {
        const newPiece: PoemPiece = {
          word,
          line: data.line,
          imageUrl: data.imageUrl,
          index: pieces.length
        }
        
        setPieces(prev => [...prev, newPiece])
        
        // 检查是否收集完成
        if (pieces.length + 1 >= WORDS_NEEDED) {
          setGameState('completed')
        }
      }
    } catch (error) {
      console.error('生成拼图失败:', error)
    } finally {
      setIsGenerating(false)
    }
  }, [pieces])

  // 初始化游戏
  const initGame = useCallback(async () => {
    const initialSnake = [{ x: 10, y: 10 }]
    setSnake(initialSnake)
    setWordPosition(generateRandomPosition(initialSnake))
    setDirection('RIGHT')
    directionRef.current = 'RIGHT'
    setScore(0)
    setSpeed(INITIAL_SPEED)
    setPieces([])
    setGameState('idle')
    
    await fetch('/api/words', { method: 'DELETE' })
    await fetchNewWord()
  }, [generateRandomPosition, fetchNewWord])

  // 开始游戏
  const startGame = useCallback(() => {
    initGame()
    setGameState('playing')
  }, [initGame])

  // 暂停/继续
  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused')
    } else if (gameState === 'paused') {
      setGameState('playing')
    }
  }, [gameState])

  // 重新开始
  const restartGame = useCallback(() => {
    initGame()
    setGameState('playing')
  }, [initGame])

  // 游戏结束
  const gameOver = useCallback(() => {
    setGameState('gameover')
    if (score > highScore) {
      setHighScore(score)
    }
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
      gameLoopRef.current = null
    }
  }, [score, highScore])

  // 移动蛇
  const moveSnake = useCallback(() => {
    // 如果正在生成，暂停移动
    if (isGenerating) return
    
    setSnake(prevSnake => {
      const head = { ...prevSnake[0] }
      
      switch (directionRef.current) {
        case 'UP': head.y -= 1; break
        case 'DOWN': head.y += 1; break
        case 'LEFT': head.x -= 1; break
        case 'RIGHT': head.x += 1; break
      }

      // 撞墙
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        gameOver()
        return prevSnake
      }

      // 撞自己
      if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver()
        return prevSnake
      }

      const newSnake = [head, ...prevSnake]

      // 吃到单词
      if (head.x === wordPosition.x && head.y === wordPosition.y) {
        const collectedWord = currentWord
        setScore(prev => prev + 10)
        setSpeed(prev => Math.max(prev - SPEED_INCREASE, 80))
        
        // 生成拼图
        generatePiece(collectedWord)
        
        // 生成新位置和单词
        setWordPosition(generateRandomPosition(newSnake))
        fetchNewWord()
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [wordPosition, currentWord, generateRandomPosition, fetchNewWord, gameOver, generatePiece, isGenerating])

  // 游戏循环
  useEffect(() => {
    if (gameState === 'playing' && !isGenerating) {
      gameLoopRef.current = setInterval(moveSnake, speed)
      return () => {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current)
        }
      }
    }
  }, [gameState, moveSnake, speed, isGenerating])

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || isGenerating) return

      const keyDirections: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', W: 'UP', s: 'DOWN', S: 'DOWN', a: 'LEFT', A: 'LEFT', d: 'RIGHT', D: 'RIGHT',
      }

      const newDirection = keyDirections[e.key]
      if (newDirection) {
        e.preventDefault()
        const opposites: Record<Direction, Direction> = {
          UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT'
        }
        if (opposites[newDirection] !== directionRef.current) {
          setDirection(newDirection)
          directionRef.current = newDirection
        }
      }

      if (e.key === ' ') {
        e.preventDefault()
        togglePause()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, togglePause, isGenerating])

  // 初始加载
  useEffect(() => {
    fetchNewWord()
  }, [fetchNewWord])

  // 绘制游戏
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE)

    // 绘制网格
    ctx.strokeStyle = '#16213e'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_SIZE, 0)
      ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_SIZE)
      ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE)
      ctx.stroke()
    }

    // 绘制单词（发光效果）
    const wordX = wordPosition.x * CELL_SIZE + CELL_SIZE / 2
    const wordY = wordPosition.y * CELL_SIZE + CELL_SIZE / 2
    
    const glowGradient = ctx.createRadialGradient(wordX, wordY, 0, wordX, wordY, CELL_SIZE * 1.5)
    glowGradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)')
    glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)')
    ctx.fillStyle = glowGradient
    ctx.fillRect(wordPosition.x * CELL_SIZE - CELL_SIZE, wordPosition.y * CELL_SIZE - CELL_SIZE, CELL_SIZE * 3, CELL_SIZE * 3)
    
    // 单词背景
    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    ctx.roundRect(wordPosition.x * CELL_SIZE - 8, wordPosition.y * CELL_SIZE + 1, CELL_SIZE + 16, CELL_SIZE - 2, 6)
    ctx.fill()
    
    // 单词文字
    ctx.fillStyle = '#1a1a2e'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(currentWord, wordX, wordY)

    // 绘制蛇
    snake.forEach((segment, index) => {
      const x = segment.x * CELL_SIZE
      const y = segment.y * CELL_SIZE
      
      if (index === 0) {
        const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE)
        gradient.addColorStop(0, '#4ade80')
        gradient.addColorStop(1, '#22c55e')
        ctx.fillStyle = gradient
      } else {
        const alpha = 1 - (index / snake.length) * 0.4
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`
      }

      ctx.beginPath()
      ctx.roundRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4)
      ctx.fill()

      // 蛇头眼睛
      if (index === 0) {
        ctx.fillStyle = '#fff'
        const eyeOffset = 5
        ctx.beginPath()
        
        switch (directionRef.current) {
          case 'UP':
            ctx.arc(x + eyeOffset, y + eyeOffset, 3, 0, Math.PI * 2)
            ctx.arc(x + CELL_SIZE - eyeOffset, y + eyeOffset, 3, 0, Math.PI * 2)
            break
          case 'DOWN':
            ctx.arc(x + eyeOffset, y + CELL_SIZE - eyeOffset, 3, 0, Math.PI * 2)
            ctx.arc(x + CELL_SIZE - eyeOffset, y + CELL_SIZE - eyeOffset, 3, 0, Math.PI * 2)
            break
          case 'LEFT':
            ctx.arc(x + eyeOffset, y + eyeOffset, 3, 0, Math.PI * 2)
            ctx.arc(x + eyeOffset, y + CELL_SIZE - eyeOffset, 3, 0, Math.PI * 2)
            break
          case 'RIGHT':
            ctx.arc(x + CELL_SIZE - eyeOffset, y + eyeOffset, 3, 0, Math.PI * 2)
            ctx.arc(x + CELL_SIZE - eyeOffset, y + CELL_SIZE - eyeOffset, 3, 0, Math.PI * 2)
            break
        }
        ctx.fill()
      }
    })
  }, [snake, wordPosition, currentWord])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-3">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 mb-1">
            ✨ 诗歌拼图贪吃蛇 ✨
          </h1>
          <p className="text-slate-400 text-xs md:text-sm">
            每吃一个单词，AI为你创作一句诗和一幅画 · 收集 {WORDS_NEEDED} 个拼成完整的诗画
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-3">
          {/* 左侧 - 游戏区 */}
          <div className="space-y-3">
            {/* 游戏卡片 */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-slate-200 text-base">
                    <Gamepad2 className="w-4 h-4 text-green-400" />
                    游戏面板
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-slate-700 text-slate-200 gap-1 text-xs">
                      <Trophy className="w-3 h-3 text-yellow-400" />
                      {highScore}
                    </Badge>
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                      {score} 分
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-2">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={GRID_SIZE * CELL_SIZE}
                    height={GRID_SIZE * CELL_SIZE}
                    className="rounded-lg border-2 border-slate-600 shadow-lg"
                  />
                  
                  {/* 开始遮罩 */}
                  {gameState === 'idle' && (
                    <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm">
                      <div className="text-5xl mb-3">🐍🧩</div>
                      <p className="text-slate-300 mb-1 text-sm">收集 {WORDS_NEEDED} 个单词</p>
                      <p className="text-slate-400 mb-3 text-xs">每个单词都是一句诗和一幅画</p>
                      <Button
                        onClick={startGame}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white gap-2"
                        size="lg"
                      >
                        <Play className="w-5 h-5" />
                        开始创作
                      </Button>
                    </div>
                  )}
                  
                  {/* 暂停遮罩 */}
                  {gameState === 'paused' && (
                    <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center">
                      <div className="text-4xl mb-3">⏸️</div>
                      <p className="text-slate-300 mb-3">暂停中</p>
                      <Button onClick={togglePause} className="bg-yellow-500 hover:bg-yellow-600 text-white gap-2">
                        <Play className="w-4 h-4" />
                        继续
                      </Button>
                    </div>
                  )}
                  
                  {/* 游戏结束 */}
                  {gameState === 'gameover' && (
                    <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center">
                      <div className="text-5xl mb-3">💀</div>
                      <p className="text-red-400 text-lg font-bold mb-1">游戏结束</p>
                      <p className="text-slate-300 mb-3 text-sm">
                        已收集 <span className="text-yellow-400">{pieces.length}</span> 个拼图
                      </p>
                      <Button onClick={restartGame} className="bg-green-500 hover:bg-green-600 text-white gap-2">
                        <RotateCcw className="w-4 h-4" />
                        重新开始
                      </Button>
                    </div>
                  )}

                  {/* 生成中提示 */}
                  {isGenerating && gameState === 'playing' && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/80 rounded-full px-3 py-1 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                      <span className="text-slate-300 text-xs">AI创作中...</span>
                    </div>
                  )}
                </div>

                {/* 控制按钮 */}
                <div className="flex gap-2 mt-2">
                  {gameState === 'playing' && (
                    <Button onClick={togglePause} variant="outline" size="sm"
                      className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 gap-1">
                      <Pause className="w-3 h-3" /> 暂停
                    </Button>
                  )}
                  {(gameState === 'playing' || gameState === 'paused') && (
                    <Button onClick={restartGame} variant="outline" size="sm"
                      className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600 gap-1">
                      <RotateCcw className="w-3 h-3" /> 重开
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">方向键/WASD移动 · 空格暂停</p>
              </CardContent>
            </Card>

            {/* 完成后展示拼图 */}
            {gameState === 'completed' && pieces.length === WORDS_NEEDED && (
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-slate-200 text-base">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    AI 协作诗画
                    <Button 
                      onClick={restartGame} 
                      size="sm"
                      className="ml-auto bg-green-500 hover:bg-green-600 text-white gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> 新游戏
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  {/* 图像拼图网格 */}
                  <div className="grid grid-cols-4 gap-1 mb-4">
                    {pieces.map((piece, i) => (
                      <div key={i} className="relative aspect-square group">
                        <img 
                          src={piece.imageUrl} 
                          alt={piece.word}
                          className="w-full h-full object-cover rounded-md border border-slate-600 transition-transform group-hover:scale-105"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5 rounded-b-md">
                          <span className="text-xs text-yellow-400">{piece.word}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 完整诗歌 */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-purple-400 text-sm font-medium">协作诗歌</span>
                    </div>
                    <div className="space-y-1">
                      {pieces.map((piece, i) => (
                        <p key={i} className="text-slate-200 text-sm leading-relaxed animate-in fade-in slide-in-from-left-2"
                           style={{ animationDelay: `${i * 100}ms` }}>
                          <span className="text-yellow-400/80 mr-2">{i + 1}.</span>
                          {piece.line}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧 - 拼图收集 */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm h-fit">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-slate-200 text-base">
                  <ImageIcon className="w-4 h-4 text-purple-400" />
                  诗句拼图
                </CardTitle>
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                  {pieces.length}/{WORDS_NEEDED}
                </Badge>
              </div>
              {/* 进度条 */}
              <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                <div 
                  className="bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${(pieces.length / WORDS_NEEDED) * 100}%` }}
                />
              </div>
            </CardHeader>
            <CardContent className="py-2">
              {pieces.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-4xl mb-2">🧩</p>
                  <p className="text-sm">开始游戏收集拼图</p>
                  <p className="text-xs mt-1">每个单词都是一句诗和一幅画</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-1">
                  {pieces.map((piece, i) => (
                    <div 
                      key={i} 
                      className="relative rounded-lg overflow-hidden border border-slate-600 animate-in fade-in zoom-in-95 duration-300"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <img 
                        src={piece.imageUrl} 
                        alt={piece.word}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <Badge className="bg-yellow-500/80 text-black text-xs mb-1">
                          {piece.word}
                        </Badge>
                        <p className="text-slate-200 text-xs leading-snug line-clamp-2">
                          {piece.line}
                        </p>
                      </div>
                      <div className="absolute top-1 left-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">{i + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <footer className="text-center text-slate-500 text-xs mt-4">
          ✨ Poetry Puzzle Snake - AI Collaborative Art ✨
        </footer>
      </div>
    </div>
  )
}

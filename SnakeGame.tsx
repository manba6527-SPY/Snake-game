'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface SmoothPosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

type Difficulty = 'easy' | 'medium' | 'hard';

const GRID_SIZE = 20;
const BASE_CELL_SIZE = 25;
const MIN_CELL_SIZE = 15;

const DIFFICULTY_SPEED: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

export default function SnakeGame() {
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [smoothSnake, setSmoothSnake] = useState<SmoothPosition[]>([
    { x: 10, y: 10, targetX: 10, targetY: 10 },
    { x: 9, y: 9, targetX: 9, targetY: 10 },
    { x: 8, y: 8, targetX: 8, targetY: 10 },
  ]);
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('right');
  const [nextDirection, setNextDirection] = useState<Direction>('right');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [cellSize, setCellSize] = useState(BASE_CELL_SIZE);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastMoveTimeRef = useRef<number>(0);
  const movePendingRef = useRef<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const playEatSound = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, []);

  const calculateCellSize = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    const maxWidth = containerWidth - 40;
    const calculatedSize = Math.floor(maxWidth / GRID_SIZE);
    const newCellSize = Math.max(MIN_CELL_SIZE, Math.min(calculatedSize, BASE_CELL_SIZE));
    
    setCellSize(newCellSize);
  }, []);

  useEffect(() => {
    calculateCellSize();
    window.addEventListener('resize', calculateCellSize);
    return () => window.removeEventListener('resize', calculateCellSize);
  }, [calculateCellSize]);

  const generateFood = useCallback((currentSnake: Position[]) => {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      const newFood: Position = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      
      const isOnSnake = currentSnake.some(
        (segment) => segment.x === newFood.x && segment.y === newFood.y);
      
      if (!isOnSnake) {
        setFood(newFood);
        return;
      }
      
      attempts++;
    }
    
    setFood({ x: 15, y: 10 });
  }, []);

  const resetGame = useCallback(() => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    setSnake(initialSnake);
    setSmoothSnake(initialSnake.map(s => ({ ...s, targetX: s.x, targetY: s.y })));
    setDirection('right');
    setNextDirection('right');
    setGameOver(false);
    setScore(0);
    setGameStarted(false);
    setIsPaused(false);
    setFood({ x: 15, y: 10 });
    lastMoveTimeRef.current = 0;
    movePendingRef.current = false;
  }, []);

  const togglePause = useCallback(() => {
    if (gameStarted && !gameOver) {
      setIsPaused((prev) => !prev);
    }
  }, [gameStarted, gameOver]);

  // 平滑动画循环
  useEffect(() => {
    const speed = DIFFICULTY_SPEED[difficulty];
    let lastTimestamp = 0;
    let accumulatedTime = 0;
    
    const animate = (timestamp: number) => {
      if (!gameStarted || gameOver || isPaused) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // 计算帧时间差，平滑处理
      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
      }
      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      accumulatedTime += deltaTime;

      // 检查是否需要移动（基于时间）
      if (accumulatedTime >= speed) {
        movePendingRef.current = true;
        accumulatedTime = 0;
      }

      // 更新平滑位置
      setSmoothSnake((prevSmooth) => {
        const progress = Math.min(1, accumulatedTime / speed);
        const easedProgress = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2; // easeInOutCubic
        
        return prevSmooth.map((segment, index) => {
          const currentX = segment.x + (segment.targetX - segment.x) * easedProgress;
          const currentY = segment.y + (segment.targetY - segment.y) * easedProgress;
          return {
            ...segment,
            x: currentX,
            y: currentY,
          };
        });
      });

      // 执行逻辑移动
      if (movePendingRef.current) {
        movePendingRef.current = false;
        
        setSnake((prevSnake) => {
          const head = prevSnake[0];
          const newHead = { ...head };

          setDirection(nextDirection);
          
          switch (nextDirection) {
            case 'up':
              newHead.y -= 1;
              break;
            case 'down':
              newHead.y += 1;
              break;
            case 'left':
              newHead.x -= 1;
              break;
            case 'right':
              newHead.x += 1;
              break;
          }

          if (
            newHead.x < 0 ||
            newHead.x >= GRID_SIZE ||
            newHead.y < 0 ||
            newHead.y >= GRID_SIZE
          ) {
            setGameOver(true);
            setHighScore((prev) => Math.max(prev, score));
            return prevSnake;
          }

          if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
            setGameOver(true);
            setHighScore((prev) => Math.max(prev, score));
            return prevSnake;
          }

          const newSnake = [newHead, ...prevSnake];

          if (newHead.x === food.x && newHead.y === food.y) {
            setScore((prev) => prev + 10);
            generateFood(newSnake);
            playEatSound();
          } else {
            newSnake.pop();
          }

          // 更新平滑位置的目标
          setSmoothSnake((prevSmooth) => {
            const newSmoothSnake = newSnake.map((pos, index) => {
              const prevSegment = prevSmooth[index];
              if (prevSegment) {
                return {
                  x: prevSegment.targetX,
                  y: prevSegment.targetY,
                  targetX: pos.x,
                  targetY: pos.y,
                };
              }
              return { x: pos.x, y: pos.y, targetX: pos.x, targetY: pos.y };
            });
            return newSmoothSnake;
          });

          return newSnake;
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameStarted, gameOver, nextDirection, food, score, difficulty, generateFood, isPaused, playEatSound]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (gameStarted && !gameOver) {
          togglePause();
        }
        return;
      }

      if (isPaused) {
        return;
      }

      if (!gameStarted && !gameOver) {
        if (e.key.startsWith('Arrow') || ['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Enter'].includes(e.key)) {
          setGameStarted(true);
          lastMoveTimeRef.current = performance.now();
          return;
        }
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (direction !== 'down') setNextDirection('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (direction !== 'up') setNextDirection('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (direction !== 'right') setNextDirection('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (direction !== 'left') setNextDirection('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, gameStarted, gameOver, isPaused, togglePause]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartRef.current || isPaused) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const minSwipeDistance = 30;

    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      if (!gameStarted && !gameOver) {
        setGameStarted(true);
        lastMoveTimeRef.current = performance.now();
      } else {
        togglePause();
      }
      touchStartRef.current = null;
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 0 && direction !== 'left') {
        setNextDirection('right');
      } else if (deltaX < 0 && direction !== 'right') {
        setNextDirection('left');
      }
    } else {
      if (deltaY > 0 && direction !== 'up') {
        setNextDirection('down');
      } else if (deltaY < 0 && direction !== 'down') {
        setNextDirection('up');
      }
    }

    touchStartRef.current = null;
  }, [direction, gameStarted, gameOver, isPaused, togglePause]);

  const handleDirectionButton = useCallback((newDirection: Direction) => {
    if (isPaused) return;

    if (!gameStarted && !gameOver) {
      setGameStarted(true);
      lastMoveTimeRef.current = performance.now();
      return;
    }

    switch (newDirection) {
      case 'up':
        if (direction !== 'down') setNextDirection('up');
        break;
      case 'down':
        if (direction !== 'up') setNextDirection('down');
        break;
      case 'left':
        if (direction !== 'right') setNextDirection('left');
        break;
      case 'right':
        if (direction !== 'left') setNextDirection('right');
        break;
    }
  }, [direction, gameStarted, gameOver, isPaused]);

  const gameBoardSize = GRID_SIZE * cellSize;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #0f172a, #581c87, #0f172a)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div ref={containerRef} style={{ 
        maxWidth: '40rem', 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
            🐍 贪吃蛇
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 'clamp(0.8rem, 2.5vw, 1rem)' }}>
            用方向键或 WASD 控制蛇的移动
          </p>
        </div>

        <div style={{
          background: '#1e293b',
          borderRadius: '1rem',
          padding: 'clamp(0.75rem, 2vw, 1rem)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}>
            <div style={{ color: 'white' }}>
              <span style={{ color: '#94a3b8', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>分数</span>
              <div style={{
                fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
                fontWeight: 'bold',
                color: '#facc15',
              }}>
                {score}
              </div>
            </div>
            <div style={{ color: 'white' }}>
              <span style={{ color: '#94a3b8', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>最高分</span>
              <div style={{
                fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
                fontWeight: 'bold',
                color: '#4ade80',
              }}>
                {highScore}
              </div>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                style={{
                  flex: 1,
                  minWidth: '80px',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  ...(difficulty === level
                    ? {
                        background: '#7c3aed',
                        color: 'white',
                        boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)',
                      }
                    : {
                        background: '#334155',
                        color: '#94a3b8',
                      }),
                }}
                onMouseOver={(e) => {
                  if (difficulty !== level) {
                    e.currentTarget.style.background = '#475569';
                  }
                }}
                onMouseOut={(e) => {
                  if (difficulty !== level) {
                    e.currentTarget.style.background = '#334155';
                  }
                }}
              >
                {level === 'easy' ? '简单' : level === 'medium' ? '中等' : '困难'}
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <div
              style={{
                position: 'relative',
                background: '#334155',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '4px solid #475569',
                width: gameBoardSize,
                height: gameBoardSize,
                boxSizing: 'content-box',
                touchAction: 'none',
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${cellSize}px ${cellSize}px`,
              }} />

              {smoothSnake.map((segment, index) => {
                const isHead = index === 0;
                return (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      width: isHead ? cellSize - 2 : cellSize - 2,
                      height: isHead ? cellSize - 2 : cellSize - 2,
                      left: segment.x * cellSize + 1,
                      top: segment.y * cellSize + 1,
                      backgroundColor: isHead ? 'transparent' : '#22c55e',
                      borderRadius: Math.max(2, cellSize * 0.15),
                      zIndex: isHead ? 10 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      willChange: 'transform',
                      transform: 'translate3d(0, 0, 0)',
                    }}
                  >
                    {isHead ? (
                      <img
                        src="/assets/snake-head.png"
                        alt="蛇头"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}

              <div
                style={{
                  position: 'absolute',
                  width: cellSize,
                  height: cellSize,
                  left: food.x * cellSize,
                  top: food.y * cellSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cellSize * 0.8,
                  zIndex: 10,
                  transition: 'left 300ms ease-out, top 300ms ease-out',
                }}
              >
                🍎
              </div>

              {!gameStarted && !gameOver && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  zIndex: 20,
                }}>
                  <div style={{
                    fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                  }}>
                    点击或滑动开始游戏
                  </div>
                  <div style={{
                    fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                    color: '#94a3b8',
                  }}>
                    使用方向键、WASD 或触摸控制
                  </div>
                </div>
              )}

              {gameOver && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  zIndex: 20,
                }}>
                  <div style={{
                    fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                    fontWeight: 'bold',
                    color: '#ef4444',
                    marginBottom: '0.5rem',
                  }}>
                    游戏结束
                  </div>
                  <div style={{
                    fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                    marginBottom: '1rem',
                  }}>
                    最终得分: {score}
                  </div>
                  <button
                    onClick={resetGame}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#7c3aed',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                      transition: 'all 0.2s',
                      boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#6d28d9';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#7c3aed';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    🔄 重新开始
                  </button>
                </div>
              )}

              {isPaused && gameStarted && !gameOver && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  zIndex: 20,
                }}>
                  <div style={{
                    fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                    fontWeight: 'bold',
                    color: '#facc15',
                    marginBottom: '0.5rem',
                  }}>
                    ⏸️ 游戏暂停
                  </div>
                  <button
                    onClick={togglePause}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '0.5rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                      transition: 'all 0.2s',
                      boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#16a34a';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#22c55e';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ▶️ 继续游戏
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}>
            <button
              onClick={togglePause}
              disabled={!gameStarted || gameOver}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: gameStarted && !gameOver ? '#f59e0b' : '#64748b',
                color: 'white',
                fontWeight: 'bold',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: gameStarted && !gameOver ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: gameStarted && !gameOver ? '0 4px 6px -1px rgba(245, 158, 11, 0.3)' : 'none',
              }}
              onMouseOver={(e) => {
                if (gameStarted && !gameOver) {
                  e.currentTarget.style.backgroundColor = '#d97706';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseOut={(e) => {
                if (gameStarted && !gameOver) {
                  e.currentTarget.style.backgroundColor = '#f59e0b';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {isPaused ? '▶️ 继续' : '⏸️ 暂停'}
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                (空格)
              </span>
            </button>
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>
              提示：用 <span style={{ color: 'white', fontFamily: 'monospace' }}>↑ ↓ ← →</span> 或 <span style={{ color: 'white', fontFamily: 'monospace' }}>W A S D</span> 控制
            </p>
            <p style={{ color: '#64748b', fontSize: 'clamp(0.7rem, 2vw, 0.8rem)', marginTop: '0.5rem' }}>
              手机端：滑动屏幕或使用下方方向键
            </p>
          </div>

          <div style={{
            marginTop: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
            maxWidth: '200px',
            margin: '1rem auto 0',
          }}>
            <div></div>
            <button
              onClick={() => handleDirectionButton('up')}
              style={{
                padding: '1rem',
                backgroundColor: '#334155',
                color: 'white',
                borderRadius: '0.5rem',
                border: '2px solid #475569',
                cursor: 'pointer',
                fontSize: '1.5rem',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDirectionButton('up');
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = '#475569';
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ↑
            </button>
            <div></div>
            <button
              onClick={() => handleDirectionButton('left')}
              style={{
                padding: '1rem',
                backgroundColor: '#334155',
                color: 'white',
                borderRadius: '0.5rem',
                border: '2px solid #475569',
                cursor: 'pointer',
                fontSize: '1.5rem',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDirectionButton('left');
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = '#475569';
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ←
            </button>
            <button
              onClick={() => handleDirectionButton('down')}
              style={{
                padding: '1rem',
                backgroundColor: '#334155',
                color: 'white',
                borderRadius: '0.5rem',
                border: '2px solid #475569',
                cursor: 'pointer',
                fontSize: '1.5rem',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDirectionButton('down');
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = '#475569';
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ↓
            </button>
            <button
              onClick={() => handleDirectionButton('right')}
              style={{
                padding: '1rem',
                backgroundColor: '#334155',
                color: 'white',
                borderRadius: '0.5rem',
                border: '2px solid #475569',
                cursor: 'pointer',
                fontSize: '1.5rem',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDirectionButton('right');
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = '#475569';
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#334155';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

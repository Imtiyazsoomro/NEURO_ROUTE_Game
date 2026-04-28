/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Trash2, 
  Cpu, 
  Zap, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Trophy,
  AlertTriangle,
  Save,
  Download
} from 'lucide-react';

// --- Constants & Types ---

const GRID_SIZE = 8;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null;
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface Cell {
  direction: Direction;
  isStart: boolean;
  isEnd: boolean;
  isObstacle: boolean;
}

const DIFFICULTY_CONFIG = {
  EASY: { 
    label: 'Easy', 
    density: 0.06, 
    multiplier: 1, 
    minDistance: 3,
    color: 'sky',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: '#38bdf8',
    secondary: '#0ea5e9',
    pulse: '2s'
  },
  MEDIUM: { 
    label: 'Medium', 
    density: 0.18, 
    multiplier: 2, 
    minDistance: 6,
    color: 'emerald',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: '#10b981',
    secondary: '#059669',
    pulse: '1.5s'
  },
  HARD: { 
    label: 'Hard', 
    density: 0.25, 
    multiplier: 3, 
    minDistance: 7,
    color: 'fuchsia',
    glow: 'rgba(192, 38, 211, 0.2)',
    accent: '#c026d3',
    secondary: '#9333ea',
    pulse: '1s'
  },
};

const getInitialInventory = (difficulty: Difficulty) => {
  switch (difficulty) {
    case 'EASY':
      return { UP: 8, DOWN: 8, LEFT: 8, RIGHT: 8 };
    case 'MEDIUM':
      return { UP: 3, DOWN: 4, LEFT: 2, RIGHT: 5 };
    case 'HARD':
      return { UP: 2, DOWN: 2, LEFT: 1, RIGHT: 3 };
    default:
      return { UP: 3, DOWN: 4, LEFT: 2, RIGHT: 5 };
  }
};

// --- Utils ---

const checkSolvability = (grid: Cell[][], start: { x: number, y: number }, end: { x: number, y: number }) => {
  const queue: { x: number, y: number }[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    if (x === end.x && y === end.y) return true;

    const neighbors = [
      { x: x + 1, y }, { x: x - 1, y },
      { x, y: y + 1 }, { x, y: y - 1 }
    ];

    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (
        n.x >= 0 && n.x < GRID_SIZE && 
        n.y >= 0 && n.y < GRID_SIZE && 
        !grid[n.y][n.x].isObstacle && 
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  return false;
};

const generateSolvableLevel = (difficulty: Difficulty) => {
  let attempts = 0;
  while (attempts < 50) {
    const nodes = generatePositions(difficulty);
    const grid = createEmptyGrid(difficulty, nodes.start, nodes.end);
    if (checkSolvability(grid, nodes.start, nodes.end)) {
      return { nodes, grid };
    }
    attempts++;
  }
  // Fallback to minimal obstacles if we fail to find a solvable one (rare)
  const nodes = generatePositions(difficulty);
  const grid = createEmptyGrid('EASY', nodes.start, nodes.end);
  return { nodes, grid };
};

const generatePositions = (difficulty: Difficulty) => {
  const minDistance = DIFFICULTY_CONFIG[difficulty].minDistance;
  let start = { x: 0, y: 0 };
  let end = { x: 7, y: 7 };
  let dist = 0;

  while (dist < minDistance) {
    start = { x: Math.floor(Math.random() * 8), y: Math.floor(Math.random() * 8) };
    end = { x: Math.floor(Math.random() * 8), y: Math.floor(Math.random() * 8) };
    dist = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
  }

  return { start, end };
};

const createEmptyGrid = (difficulty: Difficulty = 'MEDIUM', start: { x: number, y: number }, end: { x: number, y: number }): Cell[][] => {
  const grid: Cell[][] = [];
  const density = DIFFICULTY_CONFIG[difficulty].density;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const isStart = x === start.x && y === start.y;
      const isEnd = x === end.x && y === end.y;
      const isObstacle = !isStart && !isEnd && Math.random() < density;

      row.push({
        direction: null,
        isStart,
        isEnd,
        isObstacle,
      });
    }
    grid.push(row);
  }
  return grid;
};

const calculatePath = (grid: Cell[][], start: { x: number, y: number }, end: { x: number, y: number }) => {
  let currentX = start.x;
  let currentY = start.y;
  const path: { x: number, y: number }[] = [{ x: currentX, y: currentY }];
  const visited = new Set<string>();
  
  while (true) {
    const key = `${currentX},${currentY}`;
    if (visited.has(key)) break; // Loop detected
    visited.add(key);

    const cell = grid[currentY][currentX];
    if (cell.isEnd) break;

    // Start node usually defaults to pointing towards the end or a specific direction
    // For simplicity, we'll assume start node has a direction if the user clicks it or just handle flow
    // But since start isn't clickable, we need a "default" flow or user must connect to it.
    // In our case, the start node needs an exit vector. Let's assume start node is UP if at bottom, etc.
    // Better: let's allow clicking Start to change its exit direction.
    let dir = cell.direction;
    if (cell.isStart && !dir) {
      // Determine initial direction based on where the end node is
      if (end.x > start.x) dir = 'RIGHT';
      else if (end.x < start.x) dir = 'LEFT';
      else if (end.y > start.y) dir = 'DOWN';
      else dir = 'UP';
    }

    if (!dir) break;

    let nextX = currentX;
    let nextY = currentY;
    switch (dir) {
      case 'UP': nextY--; break;
      case 'DOWN': nextY++; break;
      case 'LEFT': nextX--; break;
      case 'RIGHT': nextX++; break;
    }

    if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE || grid[nextY][nextX].isObstacle) break;

    path.push({ x: nextX, y: nextY });
    currentX = nextX;
    currentY = nextY;
    
    if (currentX === end.x && currentY === end.y) break;
  }
  
  return path;
};

// --- Components ---

const AmbientBackground = ({ color, secondary }: { color: string, secondary: string }) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary Glow */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          x: [0, 100, 0],
          y: [0, -50, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.03] blur-[120px]"
        style={{ backgroundColor: color }}
      />
      
      {/* Secondary Flare */}
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          x: [0, -150, 0],
          y: [0, 80, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] rounded-full opacity-[0.02] blur-[120px]"
        style={{ backgroundColor: secondary }}
      />

      {/* Floating Vertical Data Stream Lines */}
      <div className="absolute inset-0 opacity-[0.05]">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div 
            key={i}
            initial={{ y: -100, x: `${i * 15}%` }}
            animate={{ y: ['0%', '100%'] }}
            transition={{ 
              duration: 15 + i * 5, 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 2
            }}
            className="absolute top-0 w-[1px] h-20 bg-gradient-to-b from-transparent via-white to-transparent"
          />
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [nodes, setNodes] = useState(() => generatePositions('MEDIUM'));
  const [grid, setGrid] = useState<Cell[][]>(() => createEmptyGrid('MEDIUM', nodes.start, nodes.end));
  const [packetPos, setPacketPos] = useState<{ x: number, y: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [gameState, setGameState] = useState<'IDLE' | 'RUNNING' | 'WIN' | 'LOSS'>('IDLE');
  const [moveCount, setMoveCount] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
  const [score, setScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState({ base: 0, bonus: 0, time: 0, penalty: 0 });
  const [rank, setRank] = useState<string>('');
  const [inventory, setInventory] = useState<{ [key in 'UP' | 'DOWN' | 'LEFT' | 'RIGHT']: number }>(() => getInitialInventory('MEDIUM'));
  const [lastPlaced, setLastPlaced] = useState<{ x: number, y: number, time: number } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [hintCell, setHintCell] = useState<{ x: number, y: number } | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ x: number, y: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ x: number, y: number } | null>(null);
  const [visitedPath, setVisitedPath] = useState<{ x: number, y: number }[]>([]);
  const [previewPath, setPreviewPath] = useState<{ x: number, y: number }[]>([]);
  const [history, setHistory] = useState<Cell[][][]>([]);
  const [failurePoint, setFailurePoint] = useState<{ x: number, y: number } | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  
  const { start, end } = nodes || { start: { x: 0, y: 0 }, end: { x: 7, y: 7 } };

  // Save/Load Handlers
  const saveGameState = useCallback(() => {
    const stateToSave = {
      grid,
      nodes,
      difficulty,
      moveCount,
      score,
      timer,
      inventory
    };
    localStorage.setItem('neuro_route_save', JSON.stringify(stateToSave));
  }, [grid, nodes, difficulty, moveCount, score, timer, inventory]);

  const loadGameState = useCallback(() => {
    const saved = localStorage.getItem('neuro_route_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.grid) {
          setGrid(parsed.grid);
          setNodes(parsed.nodes);
          setDifficulty(parsed.difficulty || 'MEDIUM');
          setMoveCount(parsed.moveCount || 0);
          setScore(parsed.score || 0);
          setTimer(parsed.timer || 0);
          setInventory(parsed.inventory || { UP: 2, DOWN: 3, LEFT: 1, RIGHT: 4 });
          setGameState('IDLE');
          setPacketPos(null);
        }
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
  }, []);

  const traversalIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Handlers ---

  const handleDifficultyChange = (newDifficulty: Difficulty) => {
    const { nodes: newNodes, grid: newGrid } = generateSolvableLevel(newDifficulty);
    setDifficulty(newDifficulty);
    setNodes(newNodes);
    setGrid(newGrid);
    setInventory(getInitialInventory(newDifficulty));
    setMoveCount(0);
    setUndoCount(0);
    setGameState('IDLE');
    setPacketPos(null);
    setHistory([]);
    setFailurePoint(null);
    setTimer(0);
    setIsTimerActive(false);
    setHintCell(null);
  };

  const handleCellClick = (x: number, y: number) => {
    if (isRunning || grid[y][x].isObstacle || grid[y][x].isStart || grid[y][x].isEnd) {
      setSelectedCell(null);
      return;
    }

    const directions: Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT', null];
    const currentDir = grid[y][x].direction;
    let nextIdx = (directions.indexOf(currentDir) + 1) % directions.length;
    let nextDir = directions[nextIdx];

    // Check inventory if we are trying to place a direction
    if (nextDir !== null) {
      // If we don't have enough arrows of this type, keep cycling until we find one we have or hit null
      while (nextDir !== null && inventory[nextDir] <= 0) {
        nextIdx = (nextIdx + 1) % directions.length;
        nextDir = directions[nextIdx];
      }
    }

    // Update Inventory
    const newInventory = { ...inventory };
    if (currentDir) newInventory[currentDir] += 1;
    if (nextDir) newInventory[nextDir] -= 1;
    setInventory(newInventory);

    setLastPlaced({ x, y, time: Date.now() });

    // Save current state to history
    setHistory(prev => [...prev, grid.map(row => row.map(cell => ({ ...cell })))]);

    if (!isTimerActive) setIsTimerActive(true);

    setSelectedCell({ x, y });
    setHintCell(null);

    const newGrid = [...grid];
    newGrid[y][x] = { ...newGrid[y][x], direction: nextDir };
    setGrid(newGrid);

    // Update move count (only count non-null changes)
    const currentMoves = newGrid.flat().filter(c => !c.isStart && !c.isEnd && c.direction !== null).length;
    setMoveCount(currentMoves);
  };

  const undoMove = () => {
    if (history.length === 0 || gameState !== 'IDLE') return;
    
    const prevGrid = history[history.length - 1];
    
    // Find what changed to update inventory
    let changedCellLoc = { x: -1, y: -1 };
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x].direction !== prevGrid[y][x].direction) {
          changedCellLoc = { x, y };
          break;
        }
      }
      if (changedCellLoc.x !== -1) break;
    }

    if (changedCellLoc.x !== -1) {
      const currentDir = grid[changedCellLoc.y][changedCellLoc.x].direction;
      const prevDir = prevGrid[changedCellLoc.y][changedCellLoc.x].direction;
      const newInventory = { ...inventory };
      if (currentDir) newInventory[currentDir] += 1;
      if (prevDir) newInventory[prevDir] -= 1;
      setInventory(newInventory);
    }

    setGrid(prevGrid);
    setHistory(prev => prev.slice(0, -1));
    setUndoCount(prev => prev + 1);
    
    const currentMoves = prevGrid.flat().filter(c => !c.isStart && !c.isEnd && c.direction !== null).length;
    setMoveCount(currentMoves);
    if (currentMoves === 0) {
      setIsTimerActive(false);
      setTimer(0);
    }
  };

  const clearGrid = () => {
    setGrid(createEmptyGrid(difficulty, start, end));
    setInventory(getInitialInventory(difficulty));
    setMoveCount(0);
    setUndoCount(0);
    setGameState('IDLE');
    setPacketPos(null);
    setSelectedCell(null);
    setVisitedPath([]);
    setHistory([]);
    setFailurePoint(null);
    setTimer(0);
    setIsTimerActive(false);
    setHintCell(null);
  };

  const provideHint = () => {
    if (gameState !== 'IDLE') return;
    
    // 1. Trace the current path from start to find where it "breaks"
    let currentX = start.x;
    let currentY = start.y;
    const playerVisited = new Set<string>();
    
    while (true) {
      const key = `${currentX},${currentY}`;
      if (playerVisited.has(key)) break; // Loop
      playerVisited.add(key);
      
      const cell = grid[currentY][currentX];
      if (cell.isEnd) {
        // Path is already complete? Suggest a random empty cell or just return
        return;
      }

      let dir = cell.direction;
      if (cell.isStart && !dir) {
        if (end.x > start.x) dir = 'RIGHT';
        else if (end.x < start.x) dir = 'LEFT';
        else if (end.y > start.y) dir = 'DOWN';
        else dir = 'UP';
      }

      if (!dir) break;

      let nextX = currentX;
      let nextY = currentY;
      switch (dir) {
        case 'UP': nextY--; break;
        case 'DOWN': nextY++; break;
        case 'LEFT': nextX--; break;
        case 'RIGHT': nextX++; break;
      }

      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE || grid[nextY][nextX].isObstacle) break;
      
      currentX = nextX;
      currentY = nextY;
    }

    // 2. Perform BFS from the "currentX/currentY" break point to find the next move
    const queue: { x: number, y: number, path: {x: number, y: number}[] }[] = [{ x: currentX, y: currentY, path: [] }];
    const visited = new Set<string>();
    visited.add(`${currentX},${currentY}`);

    while (queue.length > 0) {
      const { x, y, path } = queue.shift()!;
      
      if (x === end.x && y === end.y) {
        if (path.length > 0) {
          // Highlight the cell that needs to be interacted with
          setHintCell(path[0]);
          setTimeout(() => setHintCell(null), 3000);
        } else {
          // If break point is the end (already handled) or stagnant
          // we might want to suggest the current cell if it's not start/end
          if (!grid[currentY][currentX].isStart && !grid[currentY][currentX].isEnd) {
            setHintCell({ x: currentX, y: currentY });
            setTimeout(() => setHintCell(null), 3000);
          }
        }
        return;
      }

      const neighbors = [
        { x: x + 1, y }, { x: x - 1, y },
        { x, y: y + 1 }, { x, y: y - 1 }
      ];

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (
          n.x >= 0 && n.x < GRID_SIZE && 
          n.y >= 0 && n.y < GRID_SIZE && 
          !grid[n.y][n.x].isObstacle && 
          !visited.has(key)
        ) {
          visited.add(key);
          queue.push({ ...n, path: [...path, n] });
        }
      }
    }
  };

  const startSequence = () => {
    if (gameState === 'RUNNING') return;
    
    setGameState('RUNNING');
    setIsTimerActive(false); 
    setFailurePoint(null);
    setVisitedPath([{ ...start }]);
    setPacketPos(start);
    let currentX = start.x;
    let currentY = start.y;
    const path: { x: number, y: number }[] = [{ x: currentX, y: currentY }];

    traversalIntervalRef.current = setInterval(() => {
      const currentCell = grid[currentY][currentX];
      let nextX = currentX;
      let nextY = currentY;

      // Use calculated logic (start node has default exit if not specified)
      let dir = currentCell.direction;
      if (currentCell.isStart && !dir) {
        if (end.x > start.x) dir = 'RIGHT';
        else if (end.x < start.x) dir = 'LEFT';
        else if (end.y > start.y) dir = 'DOWN';
        else dir = 'UP';
      }

      if (!dir && !currentCell.isStart && !currentCell.isEnd) {
        setGameState('LOSS');
        setFailurePoint({ x: currentX, y: currentY });
        clearInterval(traversalIntervalRef.current!);
        return;
      }

      switch (dir) {
        case 'UP': nextY--; break;
        case 'DOWN': nextY++; break;
        case 'LEFT': nextX--; break;
        case 'RIGHT': nextX++; break;
      }

      // Check bounds
      if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE || grid[nextY][nextX].isObstacle) {
        setGameState('LOSS');
        setFailurePoint({ x: currentX, y: currentY });
        clearInterval(traversalIntervalRef.current!);
        return;
      }

      // Move packet
      path.push({ x: nextX, y: nextY });
      setVisitedPath([...path]);
      setPacketPos({ x: nextX, y: nextY });
      currentX = nextX;
      currentY = nextY;

      // Check win condition
      if (grid[currentY][currentX].isEnd) {
        setGameState('WIN');
        const config = DIFFICULTY_CONFIG[difficulty];
        const minDist = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
        const baseScore = 1500 * config.multiplier;
        
        const efficiency = minDist / Math.max(minDist, moveCount);
        const efficiencyBonus = Math.floor(1000 * efficiency);
        
        const parTime = minDist * 4;
        const timeBonus = Math.max(0, (parTime - timer) * 15);
        const undoPenalty = undoCount * 50;
        
        const finalScore = Math.floor(Math.max(500, (baseScore + efficiencyBonus + timeBonus) - undoPenalty));
        
        setScoreBreakdown({
          base: baseScore,
          bonus: efficiencyBonus,
          time: timeBonus,
          penalty: undoPenalty
        });
        setScore(finalScore);

        // Rank Calculation
        const maxPossible = baseScore + 1000 + (parTime * 15);
        const ratio = finalScore / maxPossible;
        if (ratio > 0.85) setRank('S');
        else if (ratio > 0.70) setRank('A');
        else if (ratio > 0.50) setRank('B');
        else setRank('C');
        clearInterval(traversalIntervalRef.current!);
      }
    }, 400);
  };

  const resetSequence = () => {
    if (traversalIntervalRef.current) clearInterval(traversalIntervalRef.current);
    setPacketPos(null);
    setGameState('IDLE');
    setSelectedCell(null);
    setVisitedPath([]);
    setFailurePoint(null);
    if (moveCount > 0) setIsTimerActive(true);
  };

  const copyDiagnostics = () => {
    const text = `
NEUROROUTE TRANSMISSION DIAGNOSTICS
----------------------------------
Rank: ${rank}
Status: Optimal
Final Yield: ${score}
----------------------------------
Base Yield: ${scoreBreakdown.base}
Efficiency Bonus: +${scoreBreakdown.bonus}
Latency Bonus: +${scoreBreakdown.time}
Stability Penalty: -${scoreBreakdown.penalty}
----------------------------------
Node Count: ${moveCount}
Latency Check: ${timer}s
Uplink Verified // Signal Strength 100%
    `.trim();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Cleanup & Initial Load
  useEffect(() => {
    loadGameState();
    return () => {
      if (traversalIntervalRef.current) clearInterval(traversalIntervalRef.current);
    };
  }, [loadGameState]);

  // Timer & Path Preview Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    
    // Update path preview whenever grid or nodes change
    if (gameState === 'IDLE') {
      const path = calculatePath(grid, nodes.start, nodes.end);
      setPreviewPath(path);
    } else {
      setPreviewPath([]);
    }

    return () => clearInterval(interval);
  }, [isTimerActive, grid, nodes, gameState]);

  // Auto-Save Effect (Every 60 Seconds)
  useEffect(() => {
    let autoSaveInterval: NodeJS.Timeout;
    
    if (gameState === 'IDLE' && isTimerActive && timer > 0) {
      autoSaveInterval = setInterval(() => {
        saveGameState();
        setIsAutoSaving(true);
        setTimeout(() => setIsAutoSaving(false), 3000);
      }, 60000); // 60 seconds
    }

    return () => clearInterval(autoSaveInterval);
  }, [gameState, isTimerActive, timer, saveGameState]);

  return (
    <div className="min-h-screen bg-[#050508] text-slate-400 flex overflow-hidden font-sans selection:bg-cyan-500/30">
      <AmbientBackground 
        color={DIFFICULTY_CONFIG[difficulty].accent} 
        secondary={DIFFICULTY_CONFIG[difficulty].secondary} 
      />

      {/* Sidebar - Architectural Rail */}
      <aside 
        className="w-80 glass border-r flex flex-col z-10 transition-all duration-700"
        style={{ 
          borderColor: `${DIFFICULTY_CONFIG[difficulty].accent}22`,
          backgroundColor: DIFFICULTY_CONFIG[difficulty].glow 
        }}
      >
        <div className="p-10 border-b border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: parseFloat(DIFFICULTY_CONFIG[difficulty].pulse), repeat: Infinity }}
              className="w-2 h-8 transition-all duration-700" 
              style={{ 
                backgroundColor: DIFFICULTY_CONFIG[difficulty].accent,
                boxShadow: `0 0 20px ${DIFFICULTY_CONFIG[difficulty].accent}`
              }}
            />
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase font-sans">
              NEURO<span style={{ color: DIFFICULTY_CONFIG[difficulty].accent }}>ROUTE</span>
            </h1>
          </div>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.3em] leading-none ml-5">V.042 // SYSTEM.ACTIVE</p>
          <AnimatePresence>
            {isAutoSaving && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2"
              >
                <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-[8px] font-mono text-cyan-400/60 uppercase tracking-widest">Synchronizing_Cache...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-10 py-10 space-y-10 overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase text-slate-600 tracking-[0.3em] mb-4">Neural Complexity</h3>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleDifficultyChange(level)}
                    className={`py-2 px-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all ${
                      difficulty === level 
                        ? 'shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                        : 'bg-white/5 border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                    style={difficulty === level ? { 
                      backgroundColor: `${DIFFICULTY_CONFIG[level].accent}22`,
                      borderColor: DIFFICULTY_CONFIG[level].accent,
                      color: DIFFICULTY_CONFIG[level].accent
                    } : {}}
                  >
                    {DIFFICULTY_CONFIG[level].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-[0.2em]">
                <span>System Efficiency</span>
                <span className="font-mono text-sm" style={{ color: DIFFICULTY_CONFIG[difficulty].accent }}>{score.toString().padStart(4, '0')}</span>
              </div>
              <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((moveCount / 15) * 100, 100)}%` }}
                  className="h-full transition-all duration-700"
                  style={{ 
                    backgroundColor: DIFFICULTY_CONFIG[difficulty].accent,
                    boxShadow: `0 0 10px ${DIFFICULTY_CONFIG[difficulty].accent}`
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-[0.2em]">
              <span>Grid Saturation</span>
              <span className="text-white font-mono text-sm">{moveCount} <span className="opacity-30">/</span> 64</span>
            </div>

            <div className="flex justify-between text-xs font-bold uppercase text-slate-500 tracking-[0.2em]">
              <span>Uptime Duration</span>
              <span className="text-cyan-400 font-mono text-sm">
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </span>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-6">
              <div className="flex justify-between items-end">
                <h3 className="text-[13px] font-black uppercase text-slate-500 tracking-[0.4em]">Routing Assets</h3>
                <button 
                  onClick={provideHint}
                  className="text-[11px] font-bold uppercase tracking-widest text-cyan-400 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <Zap className="w-3.5 h-3.5 group-hover:animate-pulse" />
                  Neural Assist
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['UP', 'RIGHT', 'DOWN', 'LEFT'] as const).map(dir => (
                  <div key={dir} className={`glass p-5 rounded-2xl flex items-center justify-between border-white/5 transition-all ${inventory[dir] === 0 ? 'opacity-40' : 'hover:border-cyan-500/30'}`}>
                    <span className="text-lg font-black text-white">
                      {dir === 'UP' && '↑'}
                      {dir === 'DOWN' && '↓'}
                      {dir === 'LEFT' && '←'}
                      {dir === 'RIGHT' && '→'}
                    </span>
                    <span className={`font-mono text-2xl ${inventory[dir] === 0 ? 'text-red-400' : 'text-cyan-400 font-black'}`}>
                      {inventory[dir]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
              <h3 className="text-[10px] font-bold uppercase text-slate-600 tracking-[0.3em]">Persistent Storage</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={saveGameState}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all group"
                >
                  <Save className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-cyan-400">Save</span>
                </button>
                <button 
                  onClick={loadGameState}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all group"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-cyan-400">Load</span>
                </button>
              </div>
            </div>
            
            <div className="pt-6 border-t border-white/5 space-y-4">
              <h3 className="text-[10px] font-bold uppercase text-slate-600 tracking-[0.3em]">Neural Maintenance</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={undoMove}
                  disabled={history.length === 0 || gameState !== 'IDLE'}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-yellow-500/10 border border-white/5 hover:border-yellow-500/30 transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500 group-hover:text-yellow-400 transition-transform group-active:-rotate-90" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-yellow-400">Undo</span>
                </button>
                <button 
                  onClick={clearGrid}
                  className="glass py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/5 transition-colors border-white/5 group"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-red-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-red-400">Purge</span>
                </button>
              </div>
            </div>
            
            <div className="pt-4">
              <button 
                onClick={resetSequence}
                className="w-full glass p-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/5 transition-colors border-white/5 group"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600 group-hover:text-white" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-white">Reset Simulation</span>
              </button>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-12 z-10 relative">
        <AnimatePresence>
          {gameState === 'LOSS' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.2, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, times: [0, 0.5, 1] }}
              className="fixed inset-0 bg-red-600/20 pointer-events-none z-50 mix-blend-overlay"
            />
          )}
        </AnimatePresence>

        <motion.div 
          animate={gameState === 'LOSS' ? {
            x: [0, -10, 10, -10, 10, 0],
            transition: { duration: 0.4 }
          } : {}}
          className="relative"
        >
          {/* Architectural HUD Borders */}
          <div className="absolute -inset-10 border border-white/5 pointer-events-none" />
          <div className="absolute -top-10 -left-10 w-4 h-4 border-t-2 border-l-2 opacity-50" style={{ borderColor: DIFFICULTY_CONFIG[difficulty].accent }} />
          <div className="absolute -top-10 -right-10 w-4 h-4 border-t-2 border-r-2 opacity-50" style={{ borderColor: DIFFICULTY_CONFIG[difficulty].accent }} />
          <div className="absolute -bottom-10 -left-10 w-4 h-4 border-b-2 border-l-2 opacity-50" style={{ borderColor: DIFFICULTY_CONFIG[difficulty].accent }} />
          <div className="absolute -bottom-10 -right-10 w-4 h-4 border-b-2 border-r-2 opacity-50" style={{ borderColor: DIFFICULTY_CONFIG[difficulty].accent }} />

          {/* Win Celebration Particles */}
          <AnimatePresence>
            {gameState === 'WIN' && Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: (end.x - GRID_SIZE/2) * 64, 
                  y: (end.y - GRID_SIZE/2) * 64,
                  scale: 0,
                  opacity: 1
                }}
                animate={{ 
                  x: (end.x - GRID_SIZE/2) * 64 + (Math.random() - 0.5) * 400,
                  y: (end.y - GRID_SIZE/2) * 64 + (Math.random() - 0.5) * 400,
                  scale: [0, 1.5, 0],
                  opacity: 0
                }}
                transition={{ duration: 2, ease: "easeOut", delay: Math.random() * 0.5 }}
                className="absolute w-2 h-2 rounded-full blur-[2px] z-30"
                style={{ backgroundColor: DIFFICULTY_CONFIG[difficulty].accent }}
              />
            ))}
          </AnimatePresence>

          {/* Grid Container */}
          <div 
            className="glass p-1 rounded-[1.5rem] relative overflow-hidden bg-white/[0.02]"
            onClick={() => setSelectedCell(null)}
          >
            {/* Dynamic Path Connector SVG */}
            <svg 
              className="absolute inset-0 z-10 pointer-events-none p-1"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Actual Visited Path - Enhanced Glow */}
              {visitedPath.length > 1 && (
                <>
                  {/* Outer Glow */}
                  <motion.path
                    d={visitedPath.map((p, i) => 
                      `${i === 0 ? 'M' : 'L'} ${p.x * 64 + 32} ${p.y * 64 + 32}`
                    ).join(' ')}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.2 }}
                    className="blur-md"
                  />
                  {/* Core Line */}
                  <motion.path
                    d={visitedPath.map((p, i) => 
                      `${i === 0 ? 'M' : 'L'} ${p.x * 64 + 32} ${p.y * 64 + 32}`
                    ).join(' ')}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.8 }}
                    className="drop-shadow-[0_0_12px_#06b6d4]"
                  />
                </>
              )}
              {/* Path Preview */}
              {previewPath.length > 1 && gameState === 'IDLE' && (
                <motion.path
                  d={previewPath.map((p, i) => 
                    `${i === 0 ? 'M' : 'L'} ${p.x * 64 + 32} ${p.y * 64 + 32}`
                  ).join(' ')}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                />
              )}
            </svg>

            <div className="grid grid-cols-8 gap-[1px] bg-white/10 p-[1px] rounded-[1.2rem] overflow-hidden">
              {grid.map((row, y) => 
                row.map((cell, x) => (
                  <button
                    key={`${x}-${y}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCellClick(x, y);
                    }}
                    onMouseEnter={() => setHoveredCell({ x, y })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`
                      w-[64px] h-[64px] bg-[#08080c] flex items-center justify-center transition-all duration-300 relative
                      hover:bg-white/[0.07] active:bg-white/[0.1]
                      ${cell.isStart ? 'shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]' : ''}
                      ${cell.isEnd ? 'shadow-[inset_0_0_20px_rgba(255,0,255,0.1)]' : ''}
                      ${hoveredCell?.x === x && hoveredCell?.y === y ? 'z-10 ring-1 ring-white/10 bg-white/[0.05]' : ''}
                      ${selectedCell?.x === x && selectedCell?.y === y ? 'z-20 ring-4 ring-cyan-400 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.3)] scale-[1.02]' : ''}
                      ${hintCell?.x === x && hintCell?.y === y ? 'z-30 ring-2 ring-yellow-400/50 bg-yellow-400/10 shadow-[0_0_20px_rgba(250,204,21,0.3)] animate-pulse' : ''}
                    `}
                  >
                    {/* Selected Active Border Pulse */}
                    {selectedCell?.x === x && selectedCell?.y === y && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-cyan-400/10 pointer-events-none"
                      />
                    )}
                    {/* Failure Highlight */}
                    {failurePoint?.x === x && failurePoint?.y === y && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute inset-0 z-10 bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center"
                      >
                        <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
                      </motion.div>
                    )}

                    {/* Celebration Pulse Overlay */}
                    {gameState === 'WIN' && (
                      <motion.div 
                        key={`pulse-${x}-${y}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ 
                          opacity: [0, 1, 0],
                          scale: [0.8, 1.2, 1],
                        }}
                        transition={{ 
                          duration: 1, 
                          delay: (Math.abs(x - end.x) + Math.abs(y - end.y)) * 0.1,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                        className="absolute inset-0 bg-cyan-500/20 pointer-events-none blur-sm"
                      />
                    )}
                    
                    {/* Tooltip */}
                    <AnimatePresence>
                      {hoveredCell?.x === x && hoveredCell?.y === y && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                        >
                          <div className="bg-slate-900/90 backdrop-blur-xl px-3 py-2 rounded-lg border border-white/10 whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                            <p className="text-[8px] font-mono font-bold text-cyan-400 uppercase tracking-[0.2em] mb-1 leading-none">
                              {cell.isStart ? 'Uplink Node' : cell.isEnd ? 'Downlink Target' : cell.isObstacle ? 'Signal Jammer' : 'Flow Buffer'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium tracking-tight leading-none">
                              {cell.isStart ? 'Sequence initiation point' : 
                               cell.isEnd ? 'Data packet terminal' : 
                               cell.isObstacle ? 'Non-traversable sector' : 
                               'Click to configure vector'}
                            </p>
                            {/* Little arrow for tooltip */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-slate-900/90" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {cell.isStart && (
                      <div className="w-10 h-10 rounded-full border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono text-sm tracking-tighter bg-cyan-900/10">
                        IN
                      </div>
                    )}
                    {cell.isEnd && (
                      <div className="w-10 h-10 rounded-full border border-magenta-500/30 flex items-center justify-center text-magenta-400 font-mono text-sm tracking-tighter bg-magenta-900/10" style={{ color: '#ff00ff', borderColor: 'rgba(255,0,255,0.3)' }}>
                        OUT
                      </div>
                    )}
                    {cell.isObstacle && (
                      <div className="w-10 h-10 bg-slate-900 border border-slate-700/50 rounded-sm flex items-center justify-center relative overflow-hidden group/obs obstacle-glow shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                        <div className="absolute inset-0 bg-red-600/10 group-hover/obs:bg-red-600/20 transition-colors animate-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover/obs:opacity-50 transition-opacity">
                           <div className="w-full h-[1px] bg-red-500 rotate-45 absolute" />
                           <div className="w-full h-[1px] bg-red-500 -rotate-45 absolute" />
                        </div>
                        <AlertTriangle className="w-4 h-4 text-red-900/50 group-hover/obs:text-red-500 transition-colors z-10" />
                      </div>
                    )}
                    
                    {cell.direction && (
                      <>
                        <AnimatePresence>
                          {lastPlaced?.x === x && lastPlaced?.y === y && (
                            <motion.div
                              key={`ping-${lastPlaced.time}`}
                              initial={{ scale: 0.5, opacity: 0.8 }}
                              animate={{ scale: 2.5, opacity: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className="absolute inset-0 rounded-xl border-2 border-cyan-400 z-30 pointer-events-none"
                            />
                          )}
                        </AnimatePresence>
                        <motion.span 
                          key={`${cell.direction}-${moveCount}`}
                          initial={{ scale: 1.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 0.8 }}
                          className="text-cyan-400 font-mono text-2xl leading-none"
                        >
                          {cell.direction === 'UP' && '↑'}
                          {cell.direction === 'DOWN' && '↓'}
                          {cell.direction === 'LEFT' && '←'}
                          {cell.direction === 'RIGHT' && '→'}
                        </motion.span>
                      </>
                    )}
                    
                    {/* Data Packet Overlay */}
                    <AnimatePresence>
                      {packetPos?.x === x && packetPos?.y === y && (
                        <motion.div 
                          layoutId="packet"
                          initial={{ scale: 0.8, rotate: 0 }}
                          animate={{ 
                            scale: [1, 1.1, 0.9, 1],
                            rotate: [0, 5, -5, 0],
                            transition: { 
                              duration: 0.4, 
                              ease: "easeInOut"
                            } 
                          }}
                          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                        >
                          {/* Packet Glow Flare */}
                          <motion.div 
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="absolute w-16 h-16 rounded-full blur-2xl"
                            style={{ backgroundColor: DIFFICULTY_CONFIG[difficulty].accent }}
                          />
                          <motion.div 
                            animate={{ 
                              scaleY: [1, 1.2, 0.8, 1],
                              scaleX: [1, 0.8, 1.2, 1]
                            }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                            className="w-12 h-12 border border-white rounded-lg flex items-center justify-center bg-white shadow-[0_0_40px_#ffffff] relative z-10"
                            style={{ boxShadow: `0 0 40px ${DIFFICULTY_CONFIG[difficulty].accent}` }}
                          >
                            <div className="w-5 h-5 rounded-sm animate-pulse" style={{ backgroundColor: DIFFICULTY_CONFIG[difficulty].accent }} />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* HUD Controls */}
        <div className="mt-20 w-full max-w-lg">
          <div className="flex items-end justify-between gap-12">
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                {['↑', '↓', '←', '→'].map((arrow) => (
                  <div key={arrow} className="w-10 h-10 glass rounded-lg flex items-center justify-center text-[10px] font-mono text-slate-600 border-white/5">
                    {arrow}
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em]">
                Static Module Integration // Ready
              </div>
            </div>

            <AnimatePresence mode="wait">
              {gameState === 'IDLE' ? (
                <motion.button
                  key="run-idx"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={startSequence}
                  className="px-10 py-5 bg-cyan-500 text-black font-black uppercase tracking-[0.3em] text-[11px] transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
                >
                  Initiate Sequence
                </motion.button>
              ) : (
                <motion.button
                  key="reset-idx"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={resetSequence}
                  className={`px-10 py-5 border font-black uppercase tracking-[0.3em] text-[11px] transition-all active:scale-95 ${gameState === 'LOSS' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-cyan-500/50 text-cyan-400 bg-cyan-500/5'}`}
                >
                  {gameState === 'RUNNING' ? 'Interrupt' : 'Reroute Cycle'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Final Status */}
        <div className="absolute bottom-12 right-12 text-right">
          <AnimatePresence>
            {gameState === 'WIN' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                className="flex flex-col items-end gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-cyan-500 shadow-[0_0_15px_#06b6d4]" />
                  <div>
                    <p className="text-cyan-400 font-mono text-2xl font-black uppercase tracking-[0.4em] leading-none">
                      Success
                    </p>
                    <p className="text-cyan-500/60 font-mono text-[10px] uppercase tracking-[0.2em] mt-1">
                      Final Transmission Optimal
                    </p>
                  </div>
                </div>

                <div className="glass p-6 rounded-2xl border-white/10 space-y-3 min-w-[280px] relative overflow-hidden group/result">
                  {/* Scanning Line Animation */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div 
                      animate={{ top: ['-10%', '110%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-[2px] bg-cyan-500/20 shadow-[0_0_15px_#06b6d4]"
                    />
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Neural Performance</h4>
                      <p className="text-[9px] text-cyan-500/40 uppercase font-mono mt-0.5 tracking-tight">Diagnostics: Stable</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] text-slate-600 uppercase font-bold">Rank</span>
                      <motion.span 
                        initial={{ scale: 2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-3xl font-black font-mono leading-none ${
                          rank === 'S' ? 'text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]' :
                          rank === 'A' ? 'text-cyan-400' :
                          rank === 'B' ? 'text-cyan-400' : 'text-slate-400'
                        }`}
                      >
                        {rank}
                      </motion.span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-[0.2em]">
                      <span className="text-slate-500">Node Efficiency</span>
                      <span className="text-cyan-400 font-mono">+{scoreBreakdown.bonus}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-[0.2em]">
                      <span className="text-slate-500">Latency Bonus</span>
                      <span className="text-cyan-400 font-mono">+{scoreBreakdown.time}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-[0.2em]">
                      <span className="text-slate-500">Stability Re-pings</span>
                      <span className="text-red-500/60 font-mono">-{scoreBreakdown.penalty}</span>
                    </div>
                    <div className="h-[1px] bg-white/5 my-3" />
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] uppercase font-black tracking-[0.3em] text-cyan-400 mb-1">Yield Score</span>
                      <motion.div className="flex flex-col items-end">
                        <motion.span 
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="text-3xl font-mono text-white font-black leading-none"
                        >
                          {score.toString().padStart(4, '0')}
                        </motion.span>
                        <span className="text-[8px] text-cyan-500/40 uppercase font-mono mt-1 tracking-widest">Base_Yield_{DIFFICULTY_CONFIG[difficulty].multiplier}X</span>
                      </motion.div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button 
                    onClick={copyDiagnostics}
                    className="flex-1 glass py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] text-cyan-400 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <AnimatePresence mode="wait">
                      {isCopied ? (
                        <motion.span 
                          key="copied"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-white"
                        >
                          Diagnostics Copied
                        </motion.span>
                      ) : (
                        <motion.div 
                          key="copy"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2"
                        >
                          <Zap className="w-3 h-3" />
                          Share Diagnostics
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  <button 
                    onClick={handleDifficultyChange.bind(null, difficulty)}
                    className="flex-1 glass py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 group"
                  >
                    <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                    New Vector
                  </button>
                </div>
              </motion.div>
            )}
            {gameState === 'LOSS' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-3 text-red-500">
                   <div className="w-1 h-6 bg-red-500 shadow-[0_0_15px_#ef4444]" />
                   <p className="font-mono text-xl font-black uppercase tracking-[0.4em]">Failure</p>
                </div>
                <p className="text-red-500/60 font-mono text-[10px] uppercase tracking-[0.2em]">
                   Protocol Error // Connection Reset
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .glass { 
          background: rgba(255, 255, 255, 0.02); 
          backdrop-filter: blur(24px); 
          border: 1px solid rgba(255, 255, 255, 0.05); 
        }
        .node-pulse { 
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; 
        }
        .obstacle-glow {
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
          animation: danger-pulse 3s ease-in-out infinite;
        }
        @keyframes danger-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.1); border-color: rgba(239,68,68,0.2); }
          50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.2); border-color: rgba(239,68,68,0.4); }
        }
        @keyframes pulse { 
          0%, 100% { opacity: 1; transform: scale(1); } 
          50% { opacity: 0.5; transform: scale(1.05); } 
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}

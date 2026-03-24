/**
 * Game State Manager Type Definitions
 * 类型定义文件
 */

// ==================== 核心类型 ====================

/** 游戏状态基础接口 */
export interface GameState {
  gameId: string;
  turnNumber: number;
  currentPlayer?: string;
  gameOver?: boolean;
  winner?: string | null;
  players: Record<string, PlayerState>;
  board?: BoardState;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 玩家状态 */
export interface PlayerState {
  id: string;
  resources?: Record<string, number>;
  devCards?: DevCard[];
  victoryPoints?: number;
  [key: string]: unknown;
}

/** 开发卡 */
export interface DevCard {
  type: DevCardType;
  used: boolean;
}

export type DevCardType = 
  | 'knight'
  | 'vp'
  | 'roadBuilding'
  | 'yearOfPlenty'
  | 'monopoly';

/** 面板状态 */
export interface BoardState {
  hexes?: Hex[];
  robberPosition?: string | null;
  [key: string]: unknown;
}

/** 六边形地块 */
export interface Hex {
  id: string;
  terrain: TerrainType;
  number?: number;
  position: { q: number; r: number };
}

export type TerrainType = 
  | 'field' 
  | 'hill' 
  | 'mountain' 
  | 'forest' 
  | 'pasture' 
  | 'desert';

// ==================== 序列化类型 ====================

/** 序列化状态 */
export interface SerializedState {
  version: string;
  timestamp: number;
  checksum: string;
  data: string;
}

/** 版本迁移器 */
export interface Migrator {
  fromVersion: string;
  toVersion: string;
  upgrade: (data: SerializedState) => SerializedState;
}

// ==================== 快照类型 ====================

/** 快照 */
export interface Snapshot {
  id: string;
  label: string;
  timestamp: number;
  state: SerializedState;
  size: SizeInfo;
  parentId: string | null;
  metadata: Record<string, unknown>;
}

/** 大小信息 */
export interface SizeInfo {
  bytes: number;
  kb: string;
}

// ==================== 差异同步类型 ====================

/** 差异 */
export interface Delta {
  id: string;
  timestamp: number;
  changes: Change[];
  fullState: boolean;
  reversed?: boolean;
  compressed?: boolean;
}

/** 变更 */
export interface Change {
  type: ChangeType;
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

export type ChangeType = 'add' | 'remove' | 'change' | 'array_change' | 'full_state';

// ==================== 验证类型 ====================

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/** 验证错误 */
export interface ValidationError {
  type: string;
  field?: string;
  playerId?: string;
  resource?: string;
  amount?: number;
  max?: number;
  message: string;
  severity: 'critical' | 'error';
}

/** 验证警告 */
export interface ValidationWarning {
  type: string;
  message: string;
  severity: 'warning';
}

// ==================== 管理器配置 ====================

/** 游戏状态管理器选项 */
export interface GameStateManagerOptions {
  version?: string;
  migrators?: Migrator[];
  compression?: boolean;
  maxSnapshots?: number;
  autoCleanup?: boolean;
  enableLogging?: boolean;
  ignoreKeys?: string[];
  maxDeltaSize?: number;
}

// ==================== 事件类型 ====================

/** 状态变化事件 */
export interface StateChangeEvent {
  type: 'stateChanged' | 'snapshotCreated' | 'snapshotRestored' | 'deltaApplied';
  timestamp: number;
  data: unknown;
  metadata?: Record<string, unknown>;
}

// ==================== 异常类型 ====================

/** 游戏状态异常 */
export class GameStateError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>);
}

/** 序列化异常 */
export class SerializationError extends GameStateError {
  constructor(message: string, details?: Record<string, unknown>);
}

/** 快照异常 */
export class SnapshotError extends GameStateError {
  constructor(message: string, details?: Record<string, unknown>);
}

/** 验证异常 */
export class ValidationError extends GameStateError {
  errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]);
}

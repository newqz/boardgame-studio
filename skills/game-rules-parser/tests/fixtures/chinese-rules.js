/**
 * Chinese Rules Fixture - 中文规则书测试数据
 * Test data for multilingual rule parsing
 */

'use strict';

const CHINESE_RULES = `
# 狼人杀

## 游戏配置

### 游戏人数
8-18名玩家

### 游戏时长
30-60分钟

### 适合年龄
12岁以上

## 游戏配件

游戏包含以下配件：
- 3张狼人牌
- 4张村民牌
- 1张预言家牌
- 1张女巫牌
- 1张猎人牌
- 1张丘比特牌
- 1张守卫牌
- 若干投票指示物
- 1本游戏说明书

## 游戏阶段

### 夜晚阶段

1. 狼人醒来，互相确认身份
2. 预言家验人（可选）
3. 女巫用药（可选）
4. 守卫守护（可选）
5. 猎人确认（死亡时）

### 白天阶段

1. 天亮了，所有人睁眼
2. 昨夜死亡玩家遗言
3. 自由发言时间（5分钟）
4. 投票淘汰
5. 遗言（1分钟）
6. 夜晚来临

### 特殊规则

- 第一晚狼人不能杀人（平安夜）
- 女巫解药和毒药不能同一晚使用
- 预言家每晚只能验一人

## 胜利条件

### 狼人阵营胜利条件
消灭所有村民阵营玩家

### 村民阵营胜利条件
消灭所有狼人

### 情侣胜利条件
如果丘比特连了情侣，且情侣存活到游戏结束，情侣单独获胜

## 常见问题

Q: 如果情侣是狼人和村民怎么办？
A: 他们成为第三方阵营，需要消灭所有其他玩家才能获胜。

Q: 守卫能连续守同一个人吗？
A: 不能，守卫不能连续两晚守同一个人。

Q: 女巫可以自救吗？
A: 可以，女巫可以使用解药救自己。
`;

const SPANISH_RULES = `
# UNO - Reglas del Juego

## Información del Juego

- 2-10 jugadores
- Edades: 7+
- Duración: 30 minutos

## Componentes

El juego incluye:
- 108 cartas UNO
- Mazo de cartas de colores (rojo, azul, verde, amarillo)
- Cartas especiales (Skip, Reverse, Draw Two, Wild, Wild Draw Four)

## Flujo del Juego

1. Barajar el mazo
2. Repartir 7 cartas a cada jugador
3. Colocar una carta boca arriba
4. El primer jugador descarta una carta que coincida en color o número
5. Si no puede jugar, roba una carta

### Fases

1. Giro de cartas
2. Selección de carta
3. Descarte

## Cartas Especiales

- Salto (Skip): El siguiente jugador pierde su turno
- Reversa (Reverse): Cambia la dirección del juego
- Roba Dos (Draw Two): El siguiente jugador roba 2 cartas
- Comodín (Wild): Puede jugarse en cualquier momento
- Comodín Roba Cuatro (Wild Draw Four): Carta más poderosa

## Victoria

El primer jugador que se deshaga de todas sus cartas gana la partida.

Puntos:
- Cada carta en mano: 10 puntos
- Cada carta especial: 20 puntos
`;

const JAPANESE_RULES = `
# キャンバス (Canvas)

## ゲーム情報

- プレイヤー数：2-4人
- 対象年齢：8歳以上
- プレイ時間：30-45分

## ゲーム内容物

- キャンバ斯卡ード（35枚）
- 透明カード（35枚）
- 得点トラック
- ルールシート

## ゲームの流れ

### 準備

1. 各プレイヤーに透明カードを5枚配る
2. キャンバスカードを裏向きで積む
3. 得点トラックを準備する

### 手番

1. キャンバスカードを1枚引く
2. 自分の透明カードのうち1枚を選ぶ
3. キャンバスに描画する
4. 得点を計算する

## 得点方法

- 各色は5点
- 虹色は何色でもOK（3点）
- エラー時は0点

## 勝利条件

最も多くのポイントを獲得したプレイヤーが勝利！
`;

module.exports = { CHINESE_RULES, SPANISH_RULES, JAPANESE_RULES };

/**
 * Catan Rules Fixture - Real-world test data
 * Source: Catan Base Game Rules (simplified)
 */

'use strict';

const CATAN_RULES = `
# CATAN

## Contents

The Catan board game box includes the following components:

- 19 hexagonal terrain tiles
- 6 sea frames
- 18 number tokens
- 84 resource cards (21 of each resource: brick, ore, sheep, wheat, wood)
- 25 development cards
- 4 building costs cards
- 2 special cards (Longest Road and Largest Army)
- 16 cities (settlements to be upgraded)
- 20 settlements
- 54 roads
- 8 dice (4 white, 4 red)
- 1 building costs reference card
- 1 almanac rulebook

## Setup

### 1. Place the Frame Tiles

Place the six sea frame tiles so that the Catan logo is right-side up. They form a sortable frame that holds the island in place.

### 2. Arrange the Terrain Tiles

Construct the island by placing the 19 terrain hexes as shown in the illustration. First, shuffle all 19 hexes thoroughly in the expandable bag. Then, place them one-by-one in the positions shown in the diagram.

Important: The Desert hex is placed last!

### 3. Place the Number Tokens

Place the number tokens on each terrain hex as shown in the diagram.

### 4. Place the Settlements

Each player places his or her starting settlements:
1. The players roll dice to see who goes first.
2. In player order, each player places one settlement on an intersection of his or her choice.
3. Then, in reverse order, each player places his or her second settlement on the board.

Each settlement must be placed on an intersection where 3 hexes meet. You cannot place a settlement on an intersection that is already occupied.

When you place a settlement, you also receive 1 resource card from the hexes bordering that intersection for each hex type.

### 5. Deal Starting Resources

After all settlements are placed, each player receives resources based on the hexes bordering their first settlement. If a hex bordering a settlement produces resources (dice roll of the hex's number), the player receives 1 resource card of that hex's type.

## Players

2-4 players, ages 10+

Playing time: 60-120 minutes

Catan is a strategy game where players compete to build settlements and cities on the fictional island of Catan.

## Game Flow

### 1. Roll Dice

The active player rolls the dice. The total of the dice determines which terrain hexes produce resources.

All players whose settlements border a terrain hex with the rolled number receive 1 resource card of that hex's type for each settlement, and 2 resource cards for each city, bordering that hex.

If the dice show a "7," no resources are produced. See the "Rolling a 7" section for details.

### 2. Distribute Resources

After rolling, the active player distributes resources to each player who has settlements or cities bordering the hexes that match the rolled number.

### 3. Trade

After resource distribution, the active player may trade with other players and/or with the harbor towns.

### 4. Build & Buy

After trading, the active player may build roads, settlements, and cities, and/or buy development cards.

#### Building Costs

- Road: 1 Brick, 1 Wood
- Settlement: 1 Brick, 1 Wood, 1 Sheep, 1 Wheat
- City: 2 Wheat, 3 Ore
- Development Card: 1 Sheep, 1 Wheat, 1 Ore

### 5. End Turn

The active player ends the turn by saying "Done" or "End Turn." The turn then passes to the player on the left.

## Actions

### Playing a Development Card

When you buy a development card, you may immediately play 1 development card from your hand before building.

You may play only 1 development card per turn, but it can be played at any time during your turn.

### Maritime Trade

You may trade with other players or use maritime trade (harbor exchange).

#### Standard Harbor Exchange

You may trade with any player. The player does not have to have a settlement or city on the harbor.

#### Maritime Trade at Harbors

You can exchange 3 identical resource cards for any 1 resource card you need.

At a special harbor, you can exchange 2 identical resource cards for any 1 resource card you need.

### Knight Cards

When you play a knight card, move the robber immediately as described in the "Rolling a 7" section.

### Year of Plenty

Take any 2 resource cards from the bank.

### Road Building

Place 2 new roads on the board.

### Monopoly

Name a resource. All other players must give you all resource cards of that type from their hands.

## Rolling a 7

When a player rolls a 7, the following happens:

1. Any player with 8 or more resource cards must select and discard half of them.
2. The active player moves the robber to any other terrain hex.
3. The active player steals 1 resource card from another player who has a settlement or city adjacent to the new hex.

## Victory Conditions

The first player to reach 10 victory points wins!

### Victory Points

You receive victory points for:

- Each settlement: 1 victory point
- Each city: 2 victory points
- Each Longest Road: 2 victory points
- Each Largest Army: 2 victory points
- Each Veterans Development Card: 1 victory point

### Special Victory Point Cards

The following development cards are worth 1 victory point each:
- Governor (2 copies)
- Warehouse Man (2 copies)
- Commercial Harbor (2 copies)
- Road Builder (2 copies)
- Inventions (2 copies)
- Gold Discovery (2 copies)

### Longest Road

The player who has the longest road receives the "Longest Road" special card and 2 victory points.

A road segment is a string of 5 or more individual roads connecting 2 intersections.

### Largest Army

The player who has the largest army receives the "Largest Army" special card and 2 victory points.

You need 3 knight cards to have the "largest army."

## Important Rules

### Roads and Settlements

Once placed, roads and settlements cannot be moved.

### You Cannot Build on Robber Hexes

You cannot build a road or settlement on a terrain hex that contains the robber.

### Hand Limit

If you have more than 7 resource cards at the end of your turn, you must select and discard down to 7 cards.

### Robber Blocks Production

A hex containing the robber does not produce resources, even if the dice roll matches that hex's number.

## Two-Player Variant

In the two-player game, the following changes apply:
- Use only the 2 interior frame tiles marked "A" and "B."
- Build 2 roads with each starting settlement.
- You may only place your second settlement after the first player places their second settlement.
- The starting player receives only 1 resource card for each surrounding terrain hex.
`;

module.exports = { CATAN_RULES };

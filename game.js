const EMPTY = "empty";
const WALL = "wall";
const HUMAN = "player";
const BOT = "bot";
const PLACEMENTS_PER_TURN = 5;
const MIN_CAMERA_SIZE = 7;
const MAX_CAMERA_SIZE = 50;
const SCROLL_SPEED = 0.008;
const BASE_BUFFER = 5;
const BASE_OFFSET = 4;
const WALL_GAP = 3;
const LEARNING_KEY = "xwars-player-profile-v1";
const ACCOUNT_KEY = "xwars-account-v1";
const ONLINE_SERVER_KEY = "xwars-online-server-v1";
const BOT_CANDIDATE_LIMIT = 40;
const THREAT_SAMPLE_LIMIT = 8;
const BOT_BRANCH_AFTER = 6;
const BOT_BRANCH_UNTIL = 14;
const MULTI_ROUTE_TURN_LIMIT = 3;
const DEFAULT_PROFILE = {
  samples: 0,
  trap: 0,
  finish: 0,
  capture: 0,
  pressure: 0,
  support: 0,
  reconnect: 0,
  attackSpread: 0,
  botSamples: 0,
  botTrap: 0,
  botFinish: 0,
  botCapture: 0,
  botPressure: 0,
  botSupport: 0,
  botReconnect: 0,
  botAttackSpread: 0,
  botMobility: 0,
  botHomeDistance: 0,
};
const MODES = {
  classic: {
    name: "Classic",
    size: 25,
    walls: 0,
    rules: "Classic 25x25. Place 5 Xs next to your connected network, including diagonals. Titans work like cable back to your base.",
  },
  large: {
    name: "Extra Large",
    size: 50,
    walls: 0,
    rules: "Extra Large 50x50. Same rules, more room to build and trap.",
  },
  walls: {
    name: "Walls",
    size: 25,
    walls: 25,
    rules: "Walls 25x25. Wall blocks are at least 5 squares from any base and at least 3 squares apart.",
  },
};

const boardViewport = document.querySelector("#boardViewport");
const boardEl = document.querySelector("#board");
const statusText = document.querySelector("#statusText");
const playerCount = document.querySelector("#playerCount");
const botCount = document.querySelector("#botCount");
const moveLog = document.querySelector("#moveLog");
const newGameBtn = document.querySelector("#newGameBtn");
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const panelTabButtons = [...document.querySelectorAll(".panel-tab-btn")];
const panelPages = [...document.querySelectorAll(".panel-page")];
const panelTitle = document.querySelector("#panelTitle");
const cameraButtons = [...document.querySelectorAll(".camera-btn")];
const cameraLabel = document.querySelector("#cameraLabel");
const rulesText = document.querySelector("#rulesText");
const victoryOverlay = document.querySelector("#victoryOverlay");
const victoryKicker = document.querySelector("#victoryKicker");
const victoryTitle = document.querySelector("#victoryTitle");
const victoryReason = document.querySelector("#victoryReason");
const victoryBurst = document.querySelector("#victoryBurst");
const playAgainBtn = document.querySelector("#playAgainBtn");
const minimap = document.querySelector("#minimap");
const minimapContext = minimap.getContext("2d");
const profileName = document.querySelector("#profileName");
const profileRating = document.querySelector("#profileRating");
const statsName = document.querySelector("#statsName");
const statsRating = document.querySelector("#statsRating");
const profileNameInput = document.querySelector("#profileNameInput");
const profileEmailInput = document.querySelector("#profileEmailInput");
const profilePasswordInput = document.querySelector("#profilePasswordInput");
const saveProfileBtn = document.querySelector("#saveProfileBtn");
const googleProfileBtn = document.querySelector("#googleProfileBtn");
const profileWins = document.querySelector("#profileWins");
const profileLosses = document.querySelector("#profileLosses");
const profileDelta = document.querySelector("#profileDelta");
const statsGames = document.querySelector("#statsGames");
const statsWinRate = document.querySelector("#statsWinRate");
const statsBotRating = document.querySelector("#statsBotRating");
const screenSizeInput = document.querySelector("#screenSizeInput");
const screenSizeValue = document.querySelector("#screenSizeValue");
const themeSelect = document.querySelector("#themeSelect");
const onlineServerInput = document.querySelector("#onlineServerInput");
const roomInput = document.querySelector("#roomInput");
const onlineBtn = document.querySelector("#onlineBtn");
const onlineStatus = document.querySelector("#onlineStatus");
const roomsList = document.querySelector("#roomsList");
const refreshRoomsBtn = document.querySelector("#refreshRoomsBtn");
const youName = document.querySelector("#youName");
const youRating = document.querySelector("#youRating");
const opponentName = document.querySelector("#opponentName");
const opponentRating = document.querySelector("#opponentRating");
const youSwatch = document.querySelector("#youSwatch");
const opponentSwatch = document.querySelector("#opponentSwatch");

let board = [];
let size = MODES.classic.size;
let mode = "classic";
let cameraSize = 9;
let cameraRow = 0;
let cameraCol = 0;
let cameraRowExact = 0;
let cameraColExact = 0;
let cameraFocus = "your side";
let current = HUMAN;
let localOwner = HUMAN;
let opponentOwner = BOT;
let onlineEnabled = false;
let socket = null;
let roomsRefreshTimer = null;
let onlineServer = loadOnlineServer();
let gameOver = false;
let moveNumber = 1;
let placementsLeft = PLACEMENTS_PER_TURN;
let turnCameraJumpUsed = false;
let playerProfile = loadPlayerProfile();
let account = loadAccount();
let lastFocus = {
  [HUMAN]: { row: 1, col: 1 },
  [BOT]: { row: 1, col: 1 },
};
let moveHistory = {
  [HUMAN]: [],
  [BOT]: [],
};

function newCell() {
  return { kind: EMPTY, owner: null };
}

function resetGame() {
  const config = MODES[mode];
  size = config.size;
  cameraSize = clampCameraSize(account.screenSize);
  updateScreenSizeControl();
  updateCameraCss();
  board = Array.from({ length: size }, () => Array.from({ length: size }, newCell));
  const humanBase = basePosition(HUMAN);
  const botBase = basePosition(BOT);
  board[humanBase.row][humanBase.col] = { kind: "base", owner: HUMAN };
  board[botBase.row][botBase.col] = { kind: "base", owner: BOT };
  lastFocus = {
    [HUMAN]: humanBase,
    [BOT]: botBase,
  };
  moveHistory = {
    [HUMAN]: [],
    [BOT]: [],
  };
  turnCameraJumpUsed = false;
  if (config.walls > 0) spawnWalls(config.walls);
  current = HUMAN;
  localOwner = onlineEnabled ? localOwner : HUMAN;
  opponentOwner = localOwner === HUMAN ? BOT : HUMAN;
  gameOver = false;
  moveNumber = 1;
  placementsLeft = PLACEMENTS_PER_TURN;
  moveLog.innerHTML = "";
  rulesText.textContent = `${config.rules} No legal move means defeat.`;
  updateModeButtons();
  focusOwnerCamera(HUMAN);
  hideVictory();
  render();
  updateTurnStatus();
  if (onlineEnabled && localOwner === HUMAN) sendState("new-game");
}

function basePosition(owner) {
  const edge = owner === HUMAN ? BASE_OFFSET : size - 1 - BASE_OFFSET;
  return { row: edge, col: edge };
}

function inBounds(row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function neighbors(row, col) {
  const cells = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (inBounds(nextRow, nextCol)) cells.push([nextRow, nextCol]);
    }
  }
  return cells;
}

function hasPlacementSource(row, col, owner) {
  return neighbors(row, col).some(([r, c]) => {
    const cell = board[r][c];
    return cell.owner === owner && (cell.kind === "base" || cell.kind === "x" || cell.kind === "titan");
  });
}

function isLegalMove(row, col, owner) {
  const cell = board[row][col];
  if (cell.kind === "base" || cell.kind === "titan" || cell.kind === WALL) return false;
  if (cell.kind === "x" && cell.owner === owner) return false;
  if (!hasPlacementSource(row, col, owner)) return false;
  const placedKind = cell.kind === "x" ? "titan" : "x";
  return connectsToBaseAfterMove(row, col, owner, placedKind);
}

function legalMoves(owner) {
  const moves = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (isLegalMove(row, col, owner)) moves.push({ row, col });
    }
  }
  return moves;
}

function makeMove(row, col, owner, shouldSend = true) {
  if (gameOver || owner !== current || !isLegalMove(row, col, owner)) return false;

  const cell = board[row][col];
  const capture = cell.kind === "x" && cell.owner !== owner;
  const features = moveFeatures(owner, row, col);
  if (owner === localOwner) learnFromHumanMove(row, col, capture, features);
  board[row][col] = { kind: capture ? "titan" : "x", owner };
  lastFocus[owner] = { row, col };
  moveHistory[owner].push({ row, col, capture, features, ...moveRouteInfo(owner, row, col) });
  if (owner === localOwner) {
    cameraFocus = owner === localOwner ? "your side" : "opponent side";
    setCameraCenter(row, col);
  } else if (!turnCameraJumpUsed) {
    cameraFocus = "opponent side";
    setCameraCenter(row, col);
    turnCameraJumpUsed = true;
  }
  logMove(owner, row, col, capture, features);
  placementsLeft -= 1;
  if (onlineEnabled && shouldSend) sendMove(row, col, owner);

  const other = owner === HUMAN ? BOT : HUMAN;
  const currentMoves = legalMoves(owner);

  if (placementsLeft > 0 && currentMoves.length === 0) {
    endGame(other, `${owner === HUMAN ? "You" : "Bot"} cannot place all 5.`);
    render();
    return true;
  }

  if (placementsLeft > 0) {
    render();
    updateTurnStatus();
    if (!onlineEnabled && owner === BOT) {
      window.setTimeout(botMove, 260);
    }
    return true;
  }

  current = other;
  placementsLeft = PLACEMENTS_PER_TURN;
  turnCameraJumpUsed = false;
  if (current === localOwner) {
    focusOwnerCamera(current);
  }

  if (legalMoves(current).length === 0) {
    endGame(owner, `${current === HUMAN ? "You have" : "Bot has"} no legal move.`);
    render();
    return true;
  }

  render();
  updateTurnStatus();

  if (!onlineEnabled && current === BOT) {
    setStatus("Opponent thinking...");
    window.setTimeout(botMove, 420);
  }

  return true;
}

function botMove() {
  if (gameOver || current !== BOT) return;
  setStatus(`Bot move - ${placementsLeft} ${placementsLeft === 1 ? "placement" : "placements"} left`);
  const moves = legalMoves(BOT);
  if (moves.length === 0) {
    endGame(HUMAN, "Bot has no legal move.");
    render();
    return;
  }

  const botContext = createBotContext();
  const rankedMoves = moves
    .map((move) => ({
      ...move,
      roughScore: roughBotMoveScore(move, botContext),
    }))
    .sort((a, b) => b.roughScore - a.roughScore);
  const candidates = botContext.underAttack ? rankedMoves : rankedMoves.slice(0, BOT_CANDIDATE_LIMIT);

  const scored = candidates.map((move) => ({
    ...move,
    score: scoreBotMove(move, botContext),
  }));
  scored.sort((a, b) => b.score - a.score);
  const bestScore = scored[0].score;
  const bestMoves = scored.filter((move) => move.score === bestScore);
  const choice = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  makeMove(choice.row, choice.col, BOT);
}

function createBotContext() {
  const humanMoves = legalMoves(HUMAN);
  const botMoves = legalMoves(BOT);
  const botConnectedCount = connectedNetwork(BOT).size;
  const humanConnectedCount = connectedNetwork(HUMAN).size;
  const humanNetworkCells = collectNetworkCells(HUMAN);
  const humanTitanCells = collectPieceKindCells(HUMAN, "titan");
  const botBase = findBase(BOT);
  const botNetworkCells = collectNetworkCells(BOT);
  const humanPieceCount = countNetworkPieces(HUMAN);
  const humanWeakCells = analyzeHumanWeakCells(humanNetworkCells, botNetworkCells, humanMoves);
  return {
    humanBase: findBase(HUMAN),
    botBase,
    beforeHumanMoves: humanMoves,
    beforeHumanMoveCount: humanMoves.length,
    beforeHumanConnectedCount: humanConnectedCount,
    beforeHumanStrandedCount: humanPieceCount - humanConnectedCount,
    beforeBotMoveCount: botMoves.length,
    beforeBotConnectedCount: botConnectedCount,
    botStrandedCount: countNetworkPieces(BOT) - botConnectedCount,
    beforeHumanThreat: bestOpponentThreat(HUMAN, humanMoves),
    humanNetworkCells,
    humanTitanCells,
    humanWeakCells,
    humanPieceCount,
    titanPressureAtBotBase: botBase ? distanceToCells(botBase.row, botBase.col, humanTitanCells) <= 5 : false,
    recentStructureHit: recentStructureHit(),
    underAttack: botUnderAttack({ botConnectedCount, humanMoves, humanTitanCells, botBase }),
    humanFrontCount: attackFrontCount(HUMAN, humanNetworkCells),
    beforeBotFrontCount: attackFrontCount(BOT, botNetworkCells),
    botPieceCount: countNetworkPieces(BOT),
  };
}

function botUnderAttack({ botConnectedCount, humanMoves, humanTitanCells, botBase }) {
  const stranded = countNetworkPieces(BOT) - botConnectedCount;
  if (stranded > 0) return true;
  if (recentStructureHit()) return true;
  if (botBase && distanceToCells(botBase.row, botBase.col, humanTitanCells) <= 5) return true;
  return bestOpponentThreat(HUMAN, humanMoves) >= 520;
}

function roughBotMoveScore({ row, col }, context) {
  const cell = board[row][col];
  const capture = cell.kind === "x" && cell.owner === HUMAN;
  const support = neighbors(row, col).filter(([r, c]) => isNetworkCell(board[r][c], BOT)).length;
  const humanDistance = distanceToCells(row, col, context.humanNetworkCells);
  const titanDistance = distanceToCells(row, col, context.humanTitanCells);
  const pressure = context.humanBase ? Math.max(0, size - distance(row, col, context.humanBase.row, context.humanBase.col)) : 0;
  const lineStrength = botLineStrength(row, col);
  const humanFrontierPressure = countAdjacentHumanLegalMoves(row, col, context.beforeHumanMoves);
  let score = support * 20 + lineStrength * 24 + pressure * 1.6;
  score += singleStemScore(row, col, support, context) * 0.75;
  score += openingBranchScore(row, col, support, context) * 0.6;
  score += multiRouteScore(row, col, support, context) * 0.7;
  score += attackEverywhereRoughScore({ humanDistance, humanFrontierPressure, support, context });
  score += homeBaseTrapRoughScore({ row, col, humanTitanDistance: titanDistance, humanMoveReduction: humanFrontierPressure, capture, context });
  score += structureHitResponseRoughScore({ row, col, humanDistance, humanMoveReduction: humanFrontierPressure, capture, context });
  score += weakHumanStrikeRoughScore({ row, col, capture, humanDistance, humanMoveReduction: humanFrontierPressure, context });
  score += titanAvoidanceScore({
    humanTitanDistance: titanDistance,
    humanMoveReduction: humanFrontierPressure,
    threatChange: 0,
    reconnectGain: 0,
    botNetworkSupport: support,
    lineStrength,
    capture,
  }) * 0.7;
  if (capture) score += 70;
  score += closeRangeAttackScore({
    capture,
    humanDistance,
    humanTitanDistance: titanDistance,
    humanMoveReduction: humanFrontierPressure,
    afterHumanMoveCount: context.beforeHumanMoveCount,
    botNetworkSupport: support,
    lineStrength,
    threatChange: 0,
  }) * 0.55;
  return score;
}

function scoreBotMove({ row, col }, context) {
  const cell = board[row][col];
  const learnedFeatures = moveFeatures(BOT, row, col);
  const capture = cell.kind === "x" && cell.owner === HUMAN;

  const original = board[row][col];
  board[row][col] = { kind: original.kind === "x" ? "titan" : "x", owner: BOT };
  const afterHumanMoves = legalMoves(HUMAN);
  const afterHumanMoveCount = afterHumanMoves.length;
  const afterHumanConnectedCount = connectedNetwork(HUMAN).size;
  const afterHumanStrandedCount = countNetworkPieces(HUMAN) - afterHumanConnectedCount;
  const afterBotMoveCount = legalMoves(BOT).length;
  const afterBotConnectedCount = connectedNetwork(BOT).size;
  const vulnerableBait = !capture && isLegalMove(row, col, HUMAN);
  const afterHumanThreat = bestOpponentThreat(HUMAN, afterHumanMoves);
  const afterBotFrontCount = attackFrontCount(BOT);
  board[row][col] = original;

  const humanMoveReduction = context.beforeHumanMoveCount - afterHumanMoveCount;
  const humanStrandedGain = Math.max(0, afterHumanStrandedCount - context.beforeHumanStrandedCount);
  const ownMobilityChange = afterBotMoveCount - context.beforeBotMoveCount;
  const reconnectGain = Math.max(0, afterBotConnectedCount - context.beforeBotConnectedCount - 1);
  const frontGain = afterBotFrontCount - context.beforeBotFrontCount;
  const threatChange = context.beforeHumanThreat - afterHumanThreat;
  const humanNetworkDistance = distanceToCells(row, col, context.humanNetworkCells);
  const humanTitanDistance = distanceToCells(row, col, context.humanTitanCells);
  const basePressure = context.humanBase ? (size * 2) - distance(row, col, context.humanBase.row, context.humanBase.col) : 0;
  const hitDistance = context.recentStructureHit
    ? chebyshevDistance(row, col, context.recentStructureHit.row, context.recentStructureHit.col)
    : Infinity;
  const botNetworkSupport = neighbors(row, col).filter(([r, c]) => {
    const neighbor = board[r][c];
    return neighbor.owner === BOT && (neighbor.kind === "base" || neighbor.kind === "x" || neighbor.kind === "titan");
  }).length;
  const lineStrength = botLineStrength(row, col);
  const singleStem = singleStemScore(row, col, botNetworkSupport, context);
  const openingBranch = openingBranchScore(row, col, botNetworkSupport, context);
  const multiRoute = multiRouteScore(row, col, botNetworkSupport, context);
  const humanFrontierPressure = countAdjacentHumanLegalMoves(row, col, context.beforeHumanMoves);

  let score = 0;
  if (afterHumanMoveCount === 0) score += 10000;
  if (afterHumanMoveCount < PLACEMENTS_PER_TURN) score += 650;
  if (context.botStrandedCount > 0) score += reconnectGain * 120;
  if (reconnectGain >= PLACEMENTS_PER_TURN) score += 280;
  score += humanMoveReduction * 55;
  score += humanFrontierPressure * 16;
  score += basePressure * (context.underAttack ? 1.2 : 4);
  score += botNetworkSupport * 7;
  score += ownMobilityChange * 2;
  score += threatChange * 0.65;
  score += attackEverywhereScore({
    frontGain,
    humanFrontierPressure,
    humanNetworkDistance,
    humanMoveReduction,
    botNetworkSupport,
    context,
  });
  score += homeBaseTrapScore({
    row,
    col,
    humanTitanDistance,
    humanMoveReduction,
    threatChange,
    capture,
    context,
  });
  score += structureHitResponseScore({
    row,
    col,
    humanNetworkDistance,
    humanMoveReduction,
    reconnectGain,
    threatChange,
    botNetworkSupport,
    lineStrength,
    capture,
    context,
  });
  score += urgentReconnectScore({
    reconnectGain,
    humanMoveReduction,
    threatChange,
    capture,
    hitDistance,
    humanNetworkDistance,
    botNetworkSupport,
    lineStrength,
    context,
  });
  score += attackedAdvanceScore({
    row,
    col,
    capture,
    humanMoveReduction,
    reconnectGain,
    threatChange,
    humanNetworkDistance,
    botNetworkSupport,
    lineStrength,
    context,
  });
  score += weakHumanStrikeScore({
    row,
    col,
    capture,
    humanMoveReduction,
    humanStrandedGain,
    humanNetworkDistance,
    humanTitanDistance,
    botNetworkSupport,
    lineStrength,
    afterHumanMoveCount,
    context,
  });
  score += learnedMoveBonus(learnedFeatures);
  score += botOutcomeBonus(learnedFeatures);
  score += lineStrength * 30;
  score += singleStem;
  score += openingBranch;
  score += multiRoute;
  score += titanAvoidanceScore({
    humanTitanDistance,
    humanMoveReduction,
    threatChange,
    reconnectGain,
    botNetworkSupport,
    lineStrength,
    capture,
  });
  if (context.botBase) score -= distance(row, col, context.botBase.row, context.botBase.col) * 0.4;

  score += closeRangeAttackScore({
    capture,
    humanDistance: humanNetworkDistance,
    humanTitanDistance,
    humanMoveReduction,
    afterHumanMoveCount,
    botNetworkSupport,
    lineStrength,
    threatChange,
  });

  if (capture) {
    score += humanMoveReduction > 0 ? 18 + humanMoveReduction * 24 : -45;
  }

  if (vulnerableBait) {
    const baseDanger = context.humanBase ? Math.max(0, 8 - distance(row, col, context.humanBase.row, context.humanBase.col)) : 0;
    const supportDiscount = botNetworkSupport * 20 + lineStrength * 30;
    score -= Math.max(45, 120 + baseDanger * 35 - supportDiscount);
  }

  return score;
}

function urgentReconnectScore({
  reconnectGain,
  humanMoveReduction,
  threatChange,
  capture,
  hitDistance,
  humanNetworkDistance,
  botNetworkSupport,
  lineStrength,
  context,
}) {
  if (!context.underAttack) return 0;

  const counterCut = capture || humanMoveReduction > 0 || threatChange > 60;
  let score = 0;

  if (context.botStrandedCount > 0) {
    if (reconnectGain > 0) score += 1600 + reconnectGain * 950;
    if (reconnectGain >= context.botStrandedCount) score += 3200;
    if (reconnectGain === 0 && !counterCut) score -= 4200;
    if (reconnectGain === 0 && counterCut) score -= 900;
  }

  if (context.recentStructureHit) {
    if (reconnectGain > 0) score += 850 + reconnectGain * 520;
    if (hitDistance <= 2 && (reconnectGain > 0 || counterCut)) score += 500;
    if (hitDistance > 4 && reconnectGain === 0 && !counterCut) score -= 1400;
  }

  if (counterCut) score += 750 + humanMoveReduction * 180 + Math.max(0, threatChange) * 1.4;
  if (humanNetworkDistance <= 3 && counterCut) score += 360;
  score += botNetworkSupport * 65 + lineStrength * 80;

  return score;
}

function attackedAdvanceScore({
  row,
  col,
  capture,
  humanMoveReduction,
  reconnectGain,
  threatChange,
  humanNetworkDistance,
  botNetworkSupport,
  lineStrength,
  context,
}) {
  if (!context.underAttack || context.botStrandedCount > 0) return 0;
  if (!context.botBase) return 0;

  const homeDistance = chebyshevDistance(row, col, context.botBase.row, context.botBase.col);
  const counterPush = capture || humanMoveReduction > 0 || threatChange > 40 || humanNetworkDistance <= 4;
  let score = 0;

  if (counterPush) {
    score += 520;
    score += humanMoveReduction * 150;
    score += Math.max(0, threatChange) * 1.25;
    score += Math.max(0, 5 - humanNetworkDistance) * 120;
    score += botNetworkSupport * 35 + lineStrength * 45;
    if (capture) score += 260;
  }

  if (homeDistance <= 2 && reconnectGain === 0 && !counterPush) score -= 1250;
  if (homeDistance <= 3 && reconnectGain === 0 && !counterPush) score -= 650;
  if (homeDistance <= 2 && counterPush && humanNetworkDistance > 4) score -= 420;
  if (homeDistance >= 4 && counterPush) score += 180;

  return score;
}

function analyzeHumanWeakCells(humanNetworkCells, botNetworkCells, humanMoves) {
  const weakCells = new Map();
  const base = findBase(HUMAN);
  for (const cell of humanNetworkCells) {
    const boardCell = board[cell.row][cell.col];
    if (boardCell.kind !== "x") continue;

    const support = neighbors(cell.row, cell.col).filter(([r, c]) => isNetworkCell(board[r][c], HUMAN)).length;
    const titanSupport = neighbors(cell.row, cell.col).filter(([r, c]) => board[r][c].owner === HUMAN && board[r][c].kind === "titan").length;
    const localMobility = countAdjacentHumanLegalMoves(cell.row, cell.col, humanMoves);
    const botDistance = distanceToCells(cell.row, cell.col, botNetworkCells);
    const baseDistance = base ? distance(cell.row, cell.col, base.row, base.col) : 0;

    let score = 0;
    if (support <= 1) score += 280;
    if (support === 2) score += 165;
    if (support === 3) score += 55;
    if (support >= 5) score -= 90;
    score += Math.max(0, baseDistance - 4) * 9;
    score += Math.max(0, 5 - localMobility) * 32;
    if (botDistance <= 1) score += 160;
    else if (botDistance <= 2) score += 120;
    else if (botDistance <= 4) score += 55;
    score -= titanSupport * 70;

    if (score > 80) weakCells.set(key(cell.row, cell.col), score);
  }
  return weakCells;
}

function weakHumanTargetScore(row, col, context) {
  let score = context.humanWeakCells.get(key(row, col)) || 0;
  for (const [nextRow, nextCol] of neighbors(row, col)) {
    score = Math.max(score, (context.humanWeakCells.get(key(nextRow, nextCol)) || 0) * 0.45);
  }
  return score;
}

function weakHumanStrikeRoughScore({ row, col, capture, humanDistance, humanMoveReduction, context }) {
  const weakness = weakHumanTargetScore(row, col, context);
  if (weakness <= 0 && humanDistance > 2) return 0;

  let score = weakness * (capture ? 1.55 : 0.55);
  score += humanMoveReduction * 80;
  if (capture) score += 165;
  if (humanDistance <= 2) score += 70;
  return score;
}

function weakHumanStrikeScore({
  row,
  col,
  capture,
  humanMoveReduction,
  humanStrandedGain,
  humanNetworkDistance,
  humanTitanDistance,
  botNetworkSupport,
  lineStrength,
  afterHumanMoveCount,
  context,
}) {
  const weakness = weakHumanTargetScore(row, col, context);
  if (weakness <= 0 && humanStrandedGain === 0 && humanMoveReduction <= 0) return 0;

  let score = 0;
  score += weakness * (capture ? 2.1 : 0.85);
  score += humanStrandedGain * 230;
  score += humanMoveReduction * 125;
  score += botNetworkSupport * 45;
  score += lineStrength * 55;
  if (capture) score += 240;
  if (afterHumanMoveCount < PLACEMENTS_PER_TURN) score += 520;
  if (humanNetworkDistance <= 2) score += 130;
  if (humanTitanDistance <= 2 && !capture && humanStrandedGain === 0) score -= 180;
  if (context.underAttack && (capture || humanStrandedGain > 0 || humanMoveReduction > 0)) score += 120;

  return score;
}

function titanAvoidanceScore({
  humanTitanDistance,
  humanMoveReduction,
  threatChange,
  reconnectGain,
  botNetworkSupport,
  lineStrength,
  capture,
}) {
  if (humanTitanDistance > 4) return 0;

  const danger = 5 - humanTitanDistance;
  let score = 0;
  score += humanMoveReduction * 115;
  score += Math.max(0, threatChange) * 1.15;
  score += reconnectGain * 170;
  score += lineStrength * 90;
  score += botNetworkSupport === 1 ? 95 : -(botNetworkSupport - 1) * 70;
  if (capture) score += 120;
  score -= danger * 105;

  return score;
}

function homeBaseTrapScore({ row, col, humanTitanDistance, humanMoveReduction, threatChange, capture, context }) {
  if (!context.botBase || !context.titanPressureAtBotBase) return 0;

  const homeDistance = chebyshevDistance(row, col, context.botBase.row, context.botBase.col);
  if (homeDistance > 4) return 0;

  let score = 0;
  const usefulDefense = humanMoveReduction > 0 || threatChange > 35 || capture || humanTitanDistance <= 2;
  if (homeDistance <= 2 && !usefulDefense) score -= 520;
  if (homeDistance <= 3 && !usefulDefense) score -= 260;
  if (homeDistance >= 3 && usefulDefense) score += 130;
  if (humanMoveReduction > 0) score += humanMoveReduction * 95;
  if (threatChange > 0) score += threatChange * 0.75;
  if (capture) score += 160;

  return score;
}

function homeBaseTrapRoughScore({ row, col, humanTitanDistance, humanMoveReduction, capture, context }) {
  if (!context.botBase || !context.titanPressureAtBotBase) return 0;

  const homeDistance = chebyshevDistance(row, col, context.botBase.row, context.botBase.col);
  if (homeDistance > 3) return 0;
  const usefulDefense = humanMoveReduction > 0 || capture || humanTitanDistance <= 2;
  return usefulDefense ? 70 : -260;
}

function structureHitResponseScore({
  row,
  col,
  humanNetworkDistance,
  humanMoveReduction,
  reconnectGain,
  threatChange,
  botNetworkSupport,
  lineStrength,
  capture,
  context,
}) {
  if (!context.recentStructureHit) return 0;

  const hitDistance = chebyshevDistance(row, col, context.recentStructureHit.row, context.recentStructureHit.col);
  const counterAttack = capture || humanMoveReduction > 0 || threatChange > 40 || humanNetworkDistance <= 4;
  let score = 0;

  score += reconnectGain * 260;
  score += humanMoveReduction * 95;
  score += Math.max(0, threatChange) * 1.1;
  score += lineStrength * 60;
  if (capture) score += 170;
  if (humanNetworkDistance <= 4) score += 130;
  if (botNetworkSupport === 1 && counterAttack) score += 80;
  if (hitDistance <= 2 && !counterAttack && reconnectGain === 0) score -= 360;
  if (hitDistance <= 3 && botNetworkSupport > 1 && reconnectGain === 0) score -= 140;

  return score;
}

function structureHitResponseRoughScore({ row, col, humanDistance, humanMoveReduction, capture, context }) {
  if (!context.recentStructureHit) return 0;

  const hitDistance = chebyshevDistance(row, col, context.recentStructureHit.row, context.recentStructureHit.col);
  if (capture || humanMoveReduction > 0 || humanDistance <= 4) return 130;
  if (hitDistance <= 2) return -180;
  return 0;
}

function attackEverywhereRoughScore({ humanDistance, humanFrontierPressure, support, context }) {
  if (context.underAttack) return 0;
  if (context.botPieceCount < 3) return 0;

  const frontGap = context.humanFrontCount - context.beforeBotFrontCount;
  let score = 0;
  if (frontGap > 0) score += frontGap * 80;
  if (context.humanFrontCount >= 3) {
    score += humanFrontierPressure * 28;
    if (humanDistance <= 4) score += 70;
  }
  if (support === 1 && context.beforeBotFrontCount < 4) score += 45;

  return score;
}

function attackEverywhereScore({
  frontGain,
  humanFrontierPressure,
  humanNetworkDistance,
  humanMoveReduction,
  botNetworkSupport,
  context,
}) {
  if (context.underAttack) return 0;
  if (context.botPieceCount < 3) return 0;

  const frontGap = context.humanFrontCount - context.beforeBotFrontCount;
  let score = 0;
  if (frontGain > 0) score += frontGain * (frontGap > 0 ? 210 : 120);
  if (context.humanFrontCount >= 3) {
    score += humanFrontierPressure * 36;
    score += humanMoveReduction * 62;
    if (humanNetworkDistance <= 4) score += 95;
  }
  if (frontGap > 1 && botNetworkSupport === 1) score += 90;
  if (context.beforeBotFrontCount >= 4 && frontGain > 0) score -= 80;

  return score;
}

function closeRangeAttackScore({
  capture,
  humanDistance,
  humanTitanDistance,
  humanMoveReduction,
  afterHumanMoveCount,
  botNetworkSupport,
  lineStrength,
  threatChange,
}) {
  if (humanDistance > 3 && humanTitanDistance > 3) return 0;

  const attackStrength =
    botNetworkSupport * 35 +
    lineStrength * 45 +
    humanMoveReduction * 60 +
    Math.max(0, threatChange) * 0.35 +
    (afterHumanMoveCount < PLACEMENTS_PER_TURN ? 180 : 0) +
    (capture ? 70 : 0);

  let score = 0;
  if (humanDistance <= 3) {
    score += attackStrength >= 190 ? attackStrength * 0.65 : -(4 - humanDistance) * (180 - attackStrength * 0.35);
  }

  if (humanTitanDistance <= 3) {
    score += attackStrength >= 240 ? attackStrength * 0.35 : -(4 - humanTitanDistance) * (130 - attackStrength * 0.25);
  }

  return score;
}

function singleStemScore(row, col, support, context) {
  if (context.underAttack) return 0;
  if (context.botPieceCount >= BOT_BRANCH_AFTER) return 0;
  const lastMove = moveHistory[BOT][moveHistory[BOT].length - 1];
  const base = context.botBase;
  if (!base) return 0;

  let score = 0;
  if (support === 1) score += 90;
  if (support > 1) score -= (support - 1) * 120;
  if (distance(row, col, base.row, base.col) <= 2 && context.botPieceCount > 3) score -= 160;
  score += diagonalRouteScore(row, col, context);

  if (lastMove) {
    const currentDistance = distance(row, col, base.row, base.col);
    const lastDistance = distance(lastMove.row, lastMove.col, base.row, base.col);
    if (currentDistance > lastDistance) score += 110;
    if (chebyshevDistance(row, col, lastMove.row, lastMove.col) === 1) score += 70;
    const sameDirection =
      Math.sign(row - lastMove.row) === Math.sign(lastMove.row - base.row) &&
      Math.sign(col - lastMove.col) === Math.sign(lastMove.col - base.col);
    if (sameDirection) score += 55;
    if (!isDiagonalDirection(directionBetween(lastMove, { row, col })) && sameDirection) score -= 150;
  }

  return score;
}

function openingBranchScore(row, col, support, context) {
  if (context.botPieceCount < BOT_BRANCH_AFTER || context.botPieceCount > BOT_BRANCH_UNTIL) return 0;
  if (context.underAttack) return 0;
  if (context.botStrandedCount > 0) return 0;
  if (distanceToCells(row, col, context.humanTitanCells) <= 4) return -140;

  const base = context.botBase;
  const lastMove = moveHistory[BOT][moveHistory[BOT].length - 1];
  const previousMove = moveHistory[BOT][moveHistory[BOT].length - 2];
  if (!base || !lastMove) return 0;

  const anchors = neighbors(row, col)
    .filter(([r, c]) => isNetworkCell(board[r][c], BOT))
    .map(([anchorRow, anchorCol]) => ({ row: anchorRow, col: anchorCol }));
  const olderAnchor = anchors.some((anchor) => anchor.row !== lastMove.row || anchor.col !== lastMove.col);
  const currentDistance = distance(row, col, base.row, base.col);
  const lastDistance = distance(lastMove.row, lastMove.col, base.row, base.col);
  const stemDirection = previousMove ? directionBetween(previousMove, lastMove) : directionBetween(base, lastMove);
  const candidateFromLast = directionBetween(lastMove, { row, col });
  const leavesLastMoveSideways = chebyshevDistance(row, col, lastMove.row, lastMove.col) === 1 && candidateFromLast !== stemDirection;

  let score = 0;
  if (support === 1) score += 120;
  if (support > 1) score -= (support - 1) * 35;
  score += diagonalRouteScore(row, col, context) * 1.25;
  if (currentDistance >= lastDistance - 1) score += 55;
  if (leavesLastMoveSideways) score += 170;
  if (olderAnchor) score += 75;
  if (context.botPieceCount <= 10 && olderAnchor) score += 180;
  if (context.botPieceCount >= BOT_BRANCH_AFTER + 1 && context.botPieceCount <= 10 && !olderAnchor) score -= 90;
  if (chebyshevDistance(row, col, lastMove.row, lastMove.col) === 1 && candidateFromLast === stemDirection) score -= 160;
  if (candidateFromLast === stemDirection && !isDiagonalDirection(candidateFromLast)) score -= 180;
  if (context.botPieceCount > 5 && distance(row, col, base.row, base.col) <= 2) score -= 180;

  return score;
}

function multiRouteScore(row, col, support, context) {
  if (context.botPieceCount < BOT_BRANCH_AFTER || context.botPieceCount > BOT_BRANCH_UNTIL) return 0;
  if (context.underAttack) return 0;
  if (context.botStrandedCount > 0) return 0;
  if (distanceToCells(row, col, context.humanTitanCells) <= 4) return 0;

  const routeIndex = routeIndexThisTurn();
  if (routeIndex >= MULTI_ROUTE_TURN_LIMIT) return 0;

  const anchors = botAnchorsFor(row, col);
  if (anchors.length === 0) return 0;

  const usedAnchors = anchorsUsedThisTurn();
  const freshAnchor = anchors.some((anchor) => !usedAnchors.has(key(anchor.row, anchor.col)));
  const routeDirection = routeDirectionFor(row, col, anchors);
  const usedDirections = directionsUsedThisTurn();
  const freshDirection = !usedDirections.has(routeDirection);

  let score = 0;
  if (support === 1) score += 150;
  if (support > 1) score -= (support - 1) * 45;
  score += diagonalRouteScore(row, col, context) * 1.1;
  if (freshAnchor) score += 190;
  if (freshDirection) score += 150;
  if (!freshAnchor && !freshDirection) score -= 210;
  if (routeIndex === 0) score += 80;
  if (routeIndex === 1 && freshDirection) score += 150;
  if (routeIndex === 2 && freshDirection) score += 120;

  return score;
}

function diagonalRouteScore(row, col, context) {
  if (context.underAttack) return 0;

  const anchors = botAnchorsFor(row, col);
  if (anchors.length === 0) return 0;
  const base = context.botBase;
  if (!base) return 0;

  const bestAnchor = anchors.reduce((best, current) =>
    distance(current.row, current.col, base.row, base.col) < distance(best.row, best.col, base.row, base.col) ? current : best,
  );
  const direction = directionBetween(bestAnchor, { row, col });
  const lastMove = moveHistory[BOT][moveHistory[BOT].length - 1];
  const previousDirection = lastMove?.routeDirection || directionBetween(base, lastMove || bestAnchor);
  const diagonal = isDiagonalDirection(direction);
  const straight = isStraightDirection(direction);
  const continuesStraightRow = straight && direction === previousDirection;

  let score = 0;
  if (diagonal) score += 180;
  if (straight) score -= 80;
  if (continuesStraightRow) score -= 220;
  if (lastMove && direction !== previousDirection) score += 90;
  if (lastMove && chebyshevDistance(row, col, lastMove.row, lastMove.col) === 1 && diagonal) score += 75;

  return score;
}

function isDiagonalDirection(direction) {
  const [rowStep, colStep] = direction.split(",").map(Number);
  return rowStep !== 0 && colStep !== 0;
}

function isStraightDirection(direction) {
  const [rowStep, colStep] = direction.split(",").map(Number);
  return (rowStep === 0 && colStep !== 0) || (rowStep !== 0 && colStep === 0);
}

function botAnchorsFor(row, col) {
  return neighbors(row, col)
    .filter(([r, c]) => isNetworkCell(board[r][c], BOT))
    .map(([anchorRow, anchorCol]) => ({ row: anchorRow, col: anchorCol }));
}

function moveRouteInfo(owner, row, col) {
  const anchors = neighbors(row, col)
    .filter(([r, c]) => isNetworkCell(board[r][c], owner))
    .map(([anchorRow, anchorCol]) => ({ row: anchorRow, col: anchorCol }));
  if (anchors.length === 0) return {};

  const base = findBase(owner);
  const anchor = base
    ? anchors.reduce((best, current) =>
        distance(current.row, current.col, base.row, base.col) < distance(best.row, best.col, base.row, base.col) ? current : best,
      )
    : anchors[0];

  return {
    anchorRow: anchor.row,
    anchorCol: anchor.col,
    routeDirection: directionBetween(anchor, { row, col }),
  };
}

function routeIndexThisTurn() {
  return (PLACEMENTS_PER_TURN - placementsLeft) % PLACEMENTS_PER_TURN;
}

function anchorsUsedThisTurn() {
  return new Set(moveHistory[BOT].slice(-routeIndexThisTurn()).map((move) => key(move.anchorRow ?? move.row, move.anchorCol ?? move.col)));
}

function directionsUsedThisTurn() {
  return new Set(moveHistory[BOT].slice(-routeIndexThisTurn()).map((move) => move.routeDirection).filter(Boolean));
}

function routeDirectionFor(row, col, anchors) {
  const base = findBase(BOT);
  if (!base) return "0,0";
  const anchor = anchors.reduce((best, current) => {
    if (!best) return current;
    return distance(current.row, current.col, base.row, base.col) < distance(best.row, best.col, base.row, base.col) ? current : best;
  }, null);
  return directionBetween(anchor || base, { row, col });
}

function directionBetween(from, to) {
  return `${Math.sign(to.row - from.row)},${Math.sign(to.col - from.col)}`;
}

function botLineStrength(row, col) {
  const directions = [
    [[-1, 0], [1, 0]],
    [[0, -1], [0, 1]],
    [[-1, -1], [1, 1]],
    [[-1, 1], [1, -1]],
  ];
  return directions.reduce((strength, [first, second]) => {
    const firstConnected = isBotNetworkAt(row + first[0], col + first[1]);
    const secondConnected = isBotNetworkAt(row + second[0], col + second[1]);
    if (firstConnected && secondConnected) return strength + 3;
    if (firstConnected || secondConnected) return strength + 1;
    return strength;
  }, 0);
}

function isBotNetworkAt(row, col) {
  return inBounds(row, col) && isNetworkCell(board[row][col], BOT);
}

function collectNetworkCells(owner) {
  const cells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (isNetworkCell(board[row][col], owner)) cells.push({ row, col });
    }
  }
  return cells;
}

function collectPieceKindCells(owner, kind) {
  const cells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = board[row][col];
      if (cell.owner === owner && cell.kind === kind) cells.push({ row, col });
    }
  }
  return cells;
}

function attackFrontCount(owner, cells = collectNetworkCells(owner)) {
  const base = findBase(owner);
  if (!base) return 0;
  const fronts = new Set();
  for (const cell of cells) {
    if (chebyshevDistance(cell.row, cell.col, base.row, base.col) < 3) continue;
    fronts.add(directionBetween(base, cell));
  }
  return fronts.size;
}

function recentStructureHit() {
  const recentHumanMoves = moveHistory[HUMAN].slice(-PLACEMENTS_PER_TURN);
  for (let index = recentHumanMoves.length - 1; index >= 0; index -= 1) {
    const move = recentHumanMoves[index];
    if (move.capture) return move;
  }
  return null;
}

function distanceToCells(row, col, cells) {
  let closest = Infinity;
  for (const cell of cells) {
    closest = Math.min(closest, chebyshevDistance(row, col, cell.row, cell.col));
    if (closest === 0) return 0;
  }
  return closest;
}

function bestOpponentThreat(owner, knownMoves = null) {
  const moves = knownMoves || legalMoves(owner);
  if (moves.length === 0) return 0;
  return moves
    .map((move) => quickThreatScore(owner, move))
    .sort((a, b) => b - a)
    .slice(0, THREAT_SAMPLE_LIMIT)
    .reduce((best, score) => Math.max(best, score), 0);
}

function quickThreatScore(owner, { row, col }) {
  const opponent = owner === HUMAN ? BOT : HUMAN;
  const cell = board[row][col];
  const capture = cell.kind === "x" && cell.owner === opponent;
  const opponentBase = findBase(opponent);
  const beforeOpponentMoves = legalMoves(opponent).length;
  const beforeConnected = connectedNetwork(owner).size;
  const original = board[row][col];

  board[row][col] = { kind: original.kind === "x" ? "titan" : "x", owner };
  const afterOpponentMoves = legalMoves(opponent).length;
  const afterConnected = connectedNetwork(owner).size;
  board[row][col] = original;

  let score = 0;
  if (afterOpponentMoves === 0) score += 1800;
  if (afterOpponentMoves < PLACEMENTS_PER_TURN) score += 360;
  score += Math.max(0, beforeOpponentMoves - afterOpponentMoves) * 45;
  score += Math.max(0, afterConnected - beforeConnected - 1) * 55;
  if (capture) score += 120;
  if (opponentBase) {
    score += Math.max(0, size - distance(row, col, opponentBase.row, opponentBase.col)) * 2;
  }
  return score;
}

function learnFromHumanMove(row, col, capture, features = moveFeatures(HUMAN, row, col)) {
  if (isIgnoredHumanLesson(row, col, capture)) return;
  const nextSamples = Math.min(playerProfile.samples + 1, 80);
  const rate = 1 / nextSamples;
  playerProfile = {
    ...playerProfile,
    samples: nextSamples,
    trap: blend(playerProfile.trap, features.trap, rate),
    finish: blend(playerProfile.finish, features.finish, rate),
    capture: blend(playerProfile.capture, features.capture, rate),
    pressure: blend(playerProfile.pressure, features.pressure, rate),
    support: blend(playerProfile.support, features.support, rate),
    reconnect: blend(playerProfile.reconnect, features.reconnect, rate),
    attackSpread: blend(playerProfile.attackSpread || 0, features.attackSpread, rate),
  };
  savePlayerProfile();
}

function learnFromBotOutcome(botWon) {
  if (onlineEnabled || moveHistory[BOT].length === 0) return;

  const signedResult = botWon ? 1 : -1;
  const moves = moveHistory[BOT].slice(-PLACEMENTS_PER_TURN * 3);
  let learned = { ...playerProfile };
  let samples = learned.botSamples || 0;

  for (let index = 0; index < moves.length; index += 1) {
    const lesson = moves[index].features;
    if (!lesson) continue;
    const recency = (index + 1) / moves.length;
    const rate = 1 / Math.min(samples + 6, 90);
    learned = blendBotLesson(learned, lesson, signedResult, recency, rate);
    samples = Math.min(samples + 1, 90);
    learned.botSamples = samples;
  }

  playerProfile = learned;
  savePlayerProfile();
}

function blendBotLesson(profile, lesson, signedResult, recency, rate) {
  const targetScale = signedResult * (0.45 + recency * 0.55);
  return {
    ...profile,
    botTrap: blend(profile.botTrap || 0, lesson.trap * targetScale, rate),
    botFinish: blend(profile.botFinish || 0, lesson.finish * targetScale, rate),
    botCapture: blend(profile.botCapture || 0, lesson.capture * targetScale, rate),
    botPressure: blend(profile.botPressure || 0, lesson.pressure * targetScale, rate),
    botSupport: blend(profile.botSupport || 0, lesson.support * targetScale, rate),
    botReconnect: blend(profile.botReconnect || 0, lesson.reconnect * targetScale, rate),
    botAttackSpread: blend(profile.botAttackSpread || 0, lesson.attackSpread * targetScale, rate),
    botMobility: blend(profile.botMobility || 0, lesson.mobility * targetScale, rate),
    botHomeDistance: blend(profile.botHomeDistance || 0, lesson.homeDistance * targetScale, rate),
  };
}

function isIgnoredHumanLesson(row, col, capture) {
  const base = findBase(HUMAN);
  if (!base) return true;
  return !capture && distance(row, col, base.row, base.col) <= 3;
}

function moveFeatures(owner, row, col) {
  const opponent = owner === HUMAN ? BOT : HUMAN;
  const original = board[row][col];
  const beforeOpponentMoves = legalMoves(opponent).length;
  const beforeConnected = connectedNetwork(owner).size;
  const beforeOwnerMoves = legalMoves(owner).length;
  const beforeFronts = attackFrontCount(owner);
  const ownerBase = findBase(owner);
  const opponentBase = findBase(opponent);

  board[row][col] = { kind: original.kind === "x" ? "titan" : "x", owner };
  const afterOpponentMoves = legalMoves(opponent).length;
  const afterConnected = connectedNetwork(owner).size;
  const afterOwnerMoves = legalMoves(owner).length;
  const afterFronts = attackFrontCount(owner);
  board[row][col] = original;

  return {
    trap: clampFeature((beforeOpponentMoves - afterOpponentMoves) / 8),
    finish: afterOpponentMoves < PLACEMENTS_PER_TURN ? 1 : 0,
    capture: original.kind === "x" && original.owner === opponent ? 1 : 0,
    pressure: opponentBase ? clampFeature(1 - distance(row, col, opponentBase.row, opponentBase.col) / (size * 2)) : 0,
    support: clampFeature(neighbors(row, col).filter(([r, c]) => isNetworkCell(board[r][c], owner)).length / 8),
    reconnect: clampFeature(Math.max(0, afterConnected - beforeConnected - 1) / 6),
    attackSpread: clampFeature((Math.max(0, afterFronts - beforeFronts) + afterFronts * 0.3) / 3),
    mobility: clampFeature((afterOwnerMoves - beforeOwnerMoves) / 8),
    homeDistance: ownerBase ? clampFeature(distance(row, col, ownerBase.row, ownerBase.col) / (size * 2)) : 0,
  };
}

function learnedMoveBonus(features) {
  if (playerProfile.samples < 4) return 0;
  return (
    playerProfile.trap * features.trap * 44 +
    playerProfile.finish * features.finish * 70 +
    playerProfile.capture * features.capture * 26 +
    playerProfile.pressure * features.pressure * 28 +
    playerProfile.support * features.support * 18 +
    playerProfile.reconnect * features.reconnect * 42 +
    (playerProfile.attackSpread || 0) * features.attackSpread * 75
  );
}

function botOutcomeBonus(features) {
  if ((playerProfile.botSamples || 0) < 2) return 0;
  return (
    (playerProfile.botTrap || 0) * features.trap * 85 +
    (playerProfile.botFinish || 0) * features.finish * 150 +
    (playerProfile.botCapture || 0) * features.capture * 70 +
    (playerProfile.botPressure || 0) * features.pressure * 60 +
    (playerProfile.botSupport || 0) * features.support * 80 +
    (playerProfile.botReconnect || 0) * features.reconnect * 120 +
    (playerProfile.botAttackSpread || 0) * features.attackSpread * 130 +
    (playerProfile.botMobility || 0) * features.mobility * 90 +
    (playerProfile.botHomeDistance || 0) * features.homeDistance * 55
  );
}

function blend(oldValue, newValue, rate) {
  return oldValue * (1 - rate) + newValue * rate;
}

function clampFeature(value) {
  return Math.max(0, Math.min(1, value));
}

function loadPlayerProfile() {
  try {
    const saved = window.localStorage.getItem(LEARNING_KEY);
    return saved ? { ...DEFAULT_PROFILE, ...JSON.parse(saved) } : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function savePlayerProfile() {
  try {
    window.localStorage.setItem(LEARNING_KEY, JSON.stringify(playerProfile));
  } catch {
    // Local storage can be unavailable in private or locked-down browser contexts.
  }
}

function countAdjacentHumanLegalMoves(row, col, humanMoves) {
  return humanMoves.filter((move) => distance(row, col, move.row, move.col) <= 2).length;
}

function distance(aRow, aCol, bRow, bCol) {
  return Math.abs(aRow - bRow) + Math.abs(aCol - bCol);
}

function connectsToBaseAfterMove(row, col, owner, placedKind) {
  return connectedNetwork(owner, { row, col, kind: placedKind, owner }).has(key(row, col));
}

function connectedNetwork(owner, virtualMove = null) {
  const base = findBase(owner);
  if (!base) return new Set();
  const visited = new Set([key(base.row, base.col)]);
  const queue = [base];

  while (queue.length > 0) {
    const currentCell = queue.shift();

    for (const [nextRow, nextCol] of neighbors(currentCell.row, currentCell.col)) {
      const nextKey = key(nextRow, nextCol);
      if (visited.has(nextKey)) continue;

      const cell = virtualCellAt(nextRow, nextCol, virtualMove);
      if (isNetworkCell(cell, owner)) {
        visited.add(nextKey);
        queue.push({ row: nextRow, col: nextCol });
      }
    }
  }

  return visited;
}

function virtualCellAt(row, col, virtualMove) {
  if (virtualMove && row === virtualMove.row && col === virtualMove.col) {
    return virtualMove;
  }
  return board[row][col];
}

function isNetworkCell(cell, owner) {
  return cell.owner === owner && (cell.kind === "base" || cell.kind === "x" || cell.kind === "titan");
}

function countNetworkPieces(owner) {
  return board.flat().filter((cell) => isNetworkCell(cell, owner)).length;
}

function findBase(owner) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = board[row][col];
      if (cell.owner === owner && cell.kind === "base") {
        return { row, col };
      }
    }
  }
  return null;
}

function render() {
  const legal = new Set(legalMoves(current).map(({ row, col }) => key(row, col)));
  const renderSize = cameraRenderSize();
  const startRow = clamp(Math.floor(cameraRowExact), 0, size - renderSize);
  const startCol = clamp(Math.floor(cameraColExact), 0, size - renderSize);
  const offsetRow = cameraRowExact - startRow;
  const offsetCol = cameraColExact - startCol;
  boardEl.innerHTML = "";
  boardEl.style.transform = `translate(${-offsetCol * (100 / renderSize)}%, ${-offsetRow * (100 / renderSize)}%)`;
  updateCameraLabel();

  for (let row = startRow; row < startRow + renderSize; row += 1) {
    for (let col = startCol; col < startCol + renderSize; col += 1) {
      const cell = board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = classForCell(cell, legal.has(key(row, col)));
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", labelForCell(cell, row, col));
      button.dataset.row = row;
      button.dataset.col = col;
      button.textContent = textForCell(cell);
      button.disabled = gameOver || current !== localOwner || !legal.has(key(row, col));
      boardEl.append(button);
    }
  }

  const counts = countPieces();
  playerCount.textContent = counts.player;
  botCount.textContent = counts.bot;
  renderMinimap();
}

function classForCell(cell, legal) {
  const classes = ["cell"];
  if (legal && current === localOwner && !gameOver) classes.push("legal");
  if (cell.kind === "base") classes.push(`base-${cell.owner}`);
  if (cell.kind === "x") classes.push(`x-${cell.owner}`);
  if (cell.kind === "titan") classes.push(`titan-${cell.owner}`);
  if (cell.kind === WALL) classes.push("wall");
  return classes.join(" ");
}

function textForCell(cell) {
  if (cell.kind === "base") return cameraSize >= 20 ? "B" : "BASE";
  if (cell.kind === "x") return "";
  if (cell.kind === "titan") return "";
  if (cell.kind === WALL) return "";
  return "";
}

function labelForCell(cell, row, col) {
  const position = `row ${row + 1}, column ${col + 1}`;
  if (cell.kind === EMPTY) return `Empty ${position}`;
  if (cell.kind === WALL) return `Wall at ${position}`;
  return `${cell.owner} ${cell.kind} at ${position}`;
}

function countPieces() {
  return board.flat().reduce(
    (counts, cell) => {
      if (cell.owner === HUMAN && cell.kind !== "base") counts.player += 1;
      if (cell.owner === BOT && cell.kind !== "base") counts.bot += 1;
      return counts;
    },
    { player: 0, bot: 0 },
  );
}

function logMove(owner, row, col, capture, features) {
  const item = document.createElement("li");
  const name = owner === HUMAN ? "You" : "Bot";
  const summary = document.createElement("strong");
  summary.textContent = `${moveNumber}. ${name} ${capture ? "made a titan at" : "placed X at"} ${row + 1}, ${col + 1}`;
  const analysis = document.createElement("span");
  analysis.className = "move-analysis";
  analysis.textContent = analyzeMove(owner, row, col, capture, features);
  item.append(summary, analysis);
  moveLog.prepend(item);
  moveNumber += 1;
}

function analyzeMove(owner, row, col, capture, features) {
  const opponent = owner === HUMAN ? BOT : HUMAN;
  const ownerBase = findBase(owner);
  const opponentNetwork = collectNetworkCells(opponent);
  const opponentDistance = distanceToCells(row, col, opponentNetwork);
  const homeDistance = ownerBase ? chebyshevDistance(row, col, ownerBase.row, ownerBase.col) : Infinity;
  const notes = [];

  if (capture) notes.push("creates a titan and removes a normal enemy X");
  if (features.finish > 0) notes.push("dangerous: can leave opponent below 5 moves");
  if (features.trap >= 0.35) notes.push("cuts down opponent options");
  if (features.reconnect >= 0.2) notes.push("reconnects loose structure");
  if (features.attackSpread >= 0.45) notes.push("opens another attack route");
  if (features.mobility >= 0.35) notes.push("keeps future moves open");
  if (opponentDistance <= 2 && !capture) notes.push("pressures the enemy line");

  if (owner === BOT && homeDistance <= 2 && features.reconnect < 0.2 && features.trap < 0.25 && !capture) {
    notes.push("warning: too close to its own base without a real counter");
  }

  if (owner === HUMAN && opponentDistance <= 3 && (capture || features.trap >= 0.25 || features.attackSpread >= 0.35)) {
    notes.push("your style: active cut-and-spread pressure");
  }

  if (notes.length === 0) {
    if (homeDistance <= 3) return "Analysis: quiet support move near home; watch that it does not become wasted base-covering.";
    return "Analysis: builds position, but no immediate cut or capture.";
  }

  return `Analysis: ${notes.slice(0, 3).join("; ")}.`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateTurnStatus() {
  const placementWord = placementsLeft === 1 ? "placement" : "placements";
  if (current === HUMAN) {
    setStatus(`${current === localOwner ? "Your move" : "Opponent move"} - ${placementsLeft} ${placementWord} left`);
    return;
  }
  setStatus(`${current === localOwner ? "Your move" : "Opponent thinking"} - ${placementsLeft} ${placementWord} left`);
}

function endGame(winner, reason) {
  gameOver = true;
  learnFromBotOutcome(winner === BOT);
  updateRating(winner === localOwner);
  setStatus(`${winner === localOwner ? "You win" : "Opponent wins"} - ${reason}`);
  showVictory(winner, reason);
}

function showVictory(winner, reason) {
  const humanWon = winner === localOwner;
  victoryKicker.textContent = humanWon ? "Victory" : "Defeat";
  victoryTitle.textContent = humanWon ? "You trapped the opponent" : "Opponent trapped you";
  victoryReason.textContent = reason;
  victoryOverlay.classList.toggle("player-win", humanWon);
  victoryOverlay.classList.toggle("bot-win", !humanWon);
  victoryOverlay.setAttribute("aria-hidden", "false");
  victoryOverlay.classList.add("show");
  renderVictoryBurst(humanWon ? HUMAN : BOT);
}

function hideVictory() {
  victoryOverlay.classList.remove("show", "player-win", "bot-win");
  victoryOverlay.setAttribute("aria-hidden", "true");
  victoryBurst.innerHTML = "";
}

function renderVictoryBurst(owner) {
  victoryBurst.innerHTML = "";
  const colorClass = owner === HUMAN ? "player-strip" : "bot-strip";
  for (let index = 0; index < 34; index += 1) {
    const strip = document.createElement("span");
    strip.className = colorClass;
    strip.style.setProperty("--x", `${Math.random() * 100}%`);
    strip.style.setProperty("--delay", `${Math.random() * 0.45}s`);
    strip.style.setProperty("--spin", `${Math.random() * 520 - 260}deg`);
    strip.style.setProperty("--fall", `${60 + Math.random() * 30}vh`);
    victoryBurst.append(strip);
  }
}

function spawnWalls(targetCount) {
  const walls = [];
  const bases = [basePosition(HUMAN), basePosition(BOT)];
  let attempts = 0;

  while (walls.length < targetCount && attempts < targetCount * 220) {
    attempts += 1;
    const row = randomInt(0, size - 1);
    const col = randomInt(0, size - 1);
    if (board[row][col].kind !== EMPTY) continue;
    if (bases.some((base) => chebyshevDistance(row, col, base.row, base.col) < BASE_BUFFER)) continue;
    if (walls.some((wall) => chebyshevDistance(row, col, wall.row, wall.col) <= WALL_GAP)) continue;
    board[row][col] = { kind: WALL, owner: null };
    walls.push({ row, col });
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chebyshevDistance(aRow, aCol, bRow, bCol) {
  return Math.max(Math.abs(aRow - bRow), Math.abs(aCol - bCol));
}

function updateModeButtons() {
  for (const button of modeButtons) {
    button.classList.toggle("active", button.dataset.mode === mode);
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  }
}

function activatePanel(name) {
  const selectedButton = panelTabButtons.find((button) => button.dataset.panel === name);
  panelTitle.textContent = selectedButton?.textContent || "Lobby";
  for (const button of panelTabButtons) {
    const isActive = button.dataset.panel === name;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const page of panelPages) {
    const isActive = page.id === `${name}Panel`;
    page.classList.toggle("active", isActive);
    page.hidden = !isActive;
  }
}

function focusOwnerCamera(owner) {
  cameraSize = clampCameraSize(account.screenSize);
  updateCameraCss();
  const focus = lastFocus[owner] || findBase(owner);
  if (!focus) return;
  cameraFocus = owner === localOwner ? "your side" : "opponent side";
  setCameraCenter(focus.row, focus.col);
}

function focusAllCamera() {
  cameraFocus = "full board";
  cameraSize = size;
  cameraRowExact = 0;
  cameraColExact = 0;
  syncCameraGridPosition();
  updateCameraCss();
}

function setCameraCenter(row, col) {
  cameraRowExact = clamp(row - Math.floor(cameraSize / 2), 0, size - cameraSize);
  cameraColExact = clamp(col - Math.floor(cameraSize / 2), 0, size - cameraSize);
  syncCameraGridPosition();
}

function moveCamera(rowDelta, colDelta) {
  cameraFocus = "free look";
  cameraSize = clampCameraSize(cameraSize);
  updateCameraCss();
  cameraRowExact = clamp(cameraRowExact + rowDelta, 0, size - cameraSize);
  cameraColExact = clamp(cameraColExact + colDelta, 0, size - cameraSize);
  syncCameraGridPosition();
  render();
}

function scrollCamera(event) {
  event.preventDefault();
  const horizontal = event.shiftKey ? event.deltaY : event.deltaX;
  const vertical = event.shiftKey ? 0 : event.deltaY;
  if (vertical !== 0 || horizontal !== 0) {
    moveCamera(vertical * SCROLL_SPEED, horizontal * SCROLL_SPEED);
  }
}

function syncCameraGridPosition() {
  cameraRow = Math.floor(cameraRowExact);
  cameraCol = Math.floor(cameraColExact);
}

function updateCameraLabel() {
  const displayRow = Math.floor(cameraRowExact);
  const displayCol = Math.floor(cameraColExact);
  const rowEnd = Math.min(size, displayRow + cameraSize);
  const colEnd = Math.min(size, displayCol + cameraSize);
  cameraLabel.textContent = `Camera: ${cameraFocus} rows ${displayRow + 1}-${rowEnd}, cols ${displayCol + 1}-${colEnd}`;
}

function cameraRenderSize() {
  return Math.min(size, cameraSize);
}

function clampCameraSize(value) {
  return clamp(Number(value) || 9, MIN_CAMERA_SIZE, Math.min(MAX_CAMERA_SIZE, size));
}

function updateScreenSizeControl() {
  const maxSize = Math.min(MAX_CAMERA_SIZE, size);
  screenSizeInput.max = String(maxSize);
  screenSizeInput.value = String(clampCameraSize(account.screenSize));
  screenSizeValue.textContent = String(clampCameraSize(account.screenSize));
}

function updateCameraCss() {
  boardEl.style.setProperty("--camera-render-size", cameraRenderSize());
  boardEl.style.setProperty("--camera-size", cameraSize);
}

function renderMinimap() {
  const width = minimap.width;
  const height = minimap.height;
  const scale = width / size;
  const colors = themeColors();
  minimapContext.clearRect(0, 0, width, height);
  minimapContext.fillStyle = colors.paper;
  minimapContext.fillRect(0, 0, width, height);

  drawMinimapWalls(scale);
  drawMinimapNetwork(HUMAN, "#166fb7", scale);
  drawMinimapNetwork(BOT, "#c44437", scale);
  drawMinimapBases(scale);
  drawMinimapCamera(scale);
}

function themeColors() {
  if (document.body.classList.contains("theme-dark")) {
    return {
      paper: "#101821",
      camera: "#e7edf5",
    };
  }
  if (document.body.classList.contains("theme-paper")) {
    return {
      paper: "#f4ecd8",
      camera: "#2d2418",
    };
  }
  return {
    paper: "#f8f5ee",
    camera: "#1f2933",
  };
}

function drawMinimapWalls(scale) {
  minimapContext.fillStyle = "#3e4751";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col].kind === WALL) {
        minimapContext.fillRect(col * scale, row * scale, Math.max(1, scale), Math.max(1, scale));
      }
    }
  }
}

function drawMinimapNetwork(owner, color, scale) {
  minimapContext.strokeStyle = color;
  minimapContext.lineWidth = Math.max(1.5, scale * 0.38);
  minimapContext.lineCap = "round";
  minimapContext.globalAlpha = 0.72;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = board[row][col];
      if (!isNetworkCell(cell, owner)) continue;
      for (const [nextRow, nextCol] of neighbors(row, col)) {
        if (nextRow < row || (nextRow === row && nextCol <= col)) continue;
        if (!isNetworkCell(board[nextRow][nextCol], owner)) continue;
        minimapContext.beginPath();
        minimapContext.moveTo((col + 0.5) * scale, (row + 0.5) * scale);
        minimapContext.lineTo((nextCol + 0.5) * scale, (nextRow + 0.5) * scale);
        minimapContext.stroke();
      }
    }
  }

  minimapContext.globalAlpha = 1;
  minimapContext.fillStyle = color;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = board[row][col];
      if (cell.owner !== owner || (cell.kind !== "x" && cell.kind !== "titan")) continue;
      const radius = cell.kind === "titan" ? Math.max(2, scale * 0.44) : Math.max(1.5, scale * 0.3);
      minimapContext.beginPath();
      minimapContext.arc((col + 0.5) * scale, (row + 0.5) * scale, radius, 0, Math.PI * 2);
      minimapContext.fill();
    }
  }
}

function drawMinimapBases(scale) {
  for (const owner of [HUMAN, BOT]) {
    const base = findBase(owner);
    if (!base) continue;
    minimapContext.fillStyle = owner === HUMAN ? "#166fb7" : "#c44437";
    minimapContext.fillRect(base.col * scale, base.row * scale, scale, scale);
    minimapContext.strokeStyle = "#ffffff";
    minimapContext.lineWidth = 2;
    minimapContext.strokeRect(base.col * scale, base.row * scale, scale, scale);
  }
}

function drawMinimapCamera(scale) {
  minimapContext.strokeStyle = themeColors().camera;
  minimapContext.lineWidth = 2;
  minimapContext.strokeRect(cameraColExact * scale, cameraRowExact * scale, cameraSize * scale, cameraSize * scale);
}

function loadAccount() {
  try {
    const saved = window.localStorage.getItem(ACCOUNT_KEY);
    return saved ? { ...defaultAccount(), ...JSON.parse(saved) } : defaultAccount();
  } catch {
    return defaultAccount();
  }
}

function defaultAccount() {
  return {
    name: "Guest",
    email: "",
    rating: 1000,
    botRating: 1000,
    wins: 0,
    losses: 0,
    lastDelta: 0,
    provider: "local",
    screenSize: 9,
    theme: "light",
    passwordHash: "",
  };
}

function saveAccount() {
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    // Local storage may be unavailable in private or locked-down browser contexts.
  }
}

function loadOnlineServer() {
  const configured = normalizeOnlineServer(window.XWARS_ONLINE_SERVER || "");
  try {
    return normalizeOnlineServer(window.localStorage.getItem(ONLINE_SERVER_KEY) || configured);
  } catch {
    return configured;
  }
}

function saveOnlineServer(value) {
  onlineServer = normalizeOnlineServer(value);
  onlineServerInput.value = onlineServer;
  try {
    if (onlineServer) {
      window.localStorage.setItem(ONLINE_SERVER_KEY, onlineServer);
    } else {
      window.localStorage.removeItem(ONLINE_SERVER_KEY);
    }
  } catch {
    // Local storage may be unavailable in private or locked-down browser contexts.
  }
  refreshRooms(true);
}

function normalizeOnlineServer(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function onlineHttpUrl(pathname) {
  if (!onlineServer) return pathname;
  return `${onlineServer}${pathname}`;
}

function onlineWebSocketUrl(pathname) {
  if (!onlineServer) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}${pathname}`;
  }
  const url = new URL(pathname, onlineServer);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function updateProfileUI() {
  applyTheme(account.theme);
  profileName.textContent = account.name || "Guest";
  profileRating.textContent = String(account.rating);
  statsName.textContent = account.name || "Guest";
  statsRating.textContent = String(account.rating);
  youName.textContent = account.name || "Guest";
  youRating.textContent = String(account.rating);
  profileNameInput.value = account.name === "Guest" ? "" : account.name;
  profileEmailInput.value = account.email || "";
  profilePasswordInput.value = "";
  profilePasswordInput.placeholder = account.passwordHash ? "Change profile password" : "Set profile password";
  const gamesPlayed = account.wins + account.losses;
  const winRate = gamesPlayed ? Math.round((account.wins / gamesPlayed) * 100) : 0;
  profileWins.textContent = String(account.wins);
  profileLosses.textContent = String(account.losses);
  profileDelta.textContent = `${account.lastDelta >= 0 ? "+" : ""}${account.lastDelta}`;
  profileDelta.classList.toggle("positive", account.lastDelta > 0);
  profileDelta.classList.toggle("negative", account.lastDelta < 0);
  statsGames.textContent = String(gamesPlayed);
  statsWinRate.textContent = `${winRate}%`;
  statsBotRating.textContent = String(account.botRating);
  updateScreenSizeControl();
  themeSelect.value = ["dark", "paper"].includes(account.theme) ? account.theme : "light";
  onlineServerInput.value = onlineServer;
  if (!onlineEnabled) {
    opponentName.textContent = "Bot";
    opponentRating.textContent = String(account.botRating);
  }
  document.body.classList.toggle("profile-saved", account.name !== "Guest" || Boolean(account.email));
  updatePlayerStrips();
}

async function saveProfileFromInputs(provider = "local") {
  const name = profileNameInput.value.trim() || "Guest";
  const email = profileEmailInput.value.trim();
  const password = profilePasswordInput.value;
  account = {
    ...account,
    name,
    email,
    provider,
    passwordHash: password ? await hashPassword(password) : account.passwordHash,
  };
  saveAccount();
  updateProfileUI();
  document.body.classList.add("profile-saved");
  activatePanel("lobby");
  sendOnline({ type: "profile", owner: localOwner, profile: publicProfile() });
}

function updateScreenSize(value) {
  account = {
    ...account,
    screenSize: clampCameraSize(value),
  };
  cameraSize = account.screenSize;
  updateCameraCss();
  cameraRowExact = clamp(cameraRowExact, 0, size - cameraSize);
  cameraColExact = clamp(cameraColExact, 0, size - cameraSize);
  syncCameraGridPosition();
  saveAccount();
  updateProfileUI();
  render();
}

function updateTheme(value) {
  const theme = ["dark", "paper"].includes(value) ? value : "light";
  account = {
    ...account,
    theme,
  };
  applyTheme(theme);
  themeSelect.value = theme;
  saveAccount();
  renderMinimap();
}

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
  document.body.classList.toggle("theme-paper", theme === "paper");
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function updateRating(didWin) {
  const expected = expectedScore(account.rating, account.botRating);
  const actual = didWin ? 1 : 0;
  const delta = Math.round(32 * (actual - expected));
  account = {
    ...account,
    rating: Math.max(100, account.rating + delta),
    botRating: Math.max(100, account.botRating - delta),
    wins: account.wins + (didWin ? 1 : 0),
    losses: account.losses + (didWin ? 0 : 1),
    lastDelta: delta,
  };
  saveAccount();
  updateProfileUI();
}

function expectedScore(playerRating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

function connectOnline() {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
    window.setTimeout(connectOnline, 160);
    socket = null;
    return;
  }
  socket = new WebSocket(onlineWebSocketUrl("/ws"));
  onlineStatus.textContent = "Connecting...";
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "join", room: roomInput.value.trim() || "xwars", profile: publicProfile() }));
  });
  socket.addEventListener("message", (event) => handleOnlineMessage(JSON.parse(event.data)));
  socket.addEventListener("close", () => {
    onlineEnabled = false;
    localOwner = HUMAN;
    opponentOwner = BOT;
    opponentName.textContent = "Bot";
    opponentRating.textContent = String(account.botRating);
    onlineStatus.textContent = "Offline bot match";
    refreshRooms();
    updateTurnStatus();
  });
}

function handleOnlineMessage(message) {
  if (message.type === "full") {
    onlineStatus.textContent = "Room is full";
    refreshRooms();
    return;
  }
  if (message.type === "assigned") {
    onlineEnabled = true;
    localOwner = message.owner;
    opponentOwner = localOwner === HUMAN ? BOT : HUMAN;
    onlineStatus.textContent = localOwner === HUMAN ? "Online: blue side" : "Online: red side";
    refreshRooms();
    applyProfiles(message.profiles || []);
    if (message.state) {
      loadState(message.state);
    } else if (localOwner === HUMAN) {
      resetGame();
    } else {
      statusText.textContent = "Waiting for host...";
    }
    return;
  }
  if (message.type === "peer") {
    applyProfiles([{ owner: message.owner, profile: message.profile }]);
    onlineStatus.textContent = "Opponent connected";
    refreshRooms();
    if (localOwner === HUMAN) sendState("state");
    return;
  }
  if (message.type === "peer-left") {
    onlineStatus.textContent = "Opponent left";
    refreshRooms();
    return;
  }
  if (message.type === "state" || message.type === "new-game") {
    loadState(message.state);
    return;
  }
  if (message.type === "move") {
    makeMove(message.row, message.col, message.owner, false);
  }
  if (message.type === "profile") {
    applyProfiles([{ owner: message.owner, profile: message.profile }]);
  }
}

function publicProfile() {
  return {
    name: account.name || "Guest",
    rating: account.rating,
  };
}

function applyProfiles(profiles) {
  for (const entry of profiles) {
    if (!entry || entry.owner === localOwner) continue;
    opponentName.textContent = entry.profile?.name || "Opponent";
    opponentRating.textContent = String(entry.profile?.rating || 1000);
  }
  youName.textContent = account.name || "Guest";
  youRating.textContent = String(account.rating);
  updatePlayerStrips();
}

async function refreshRooms(showLoading = false) {
  if (showLoading) roomsList.replaceChildren(statusLine("Checking rooms..."));
  try {
    const response = await fetch(onlineHttpUrl("/rooms"), { cache: "no-store" });
    if (!response.ok) throw new Error("rooms unavailable");
    const data = await response.json();
    renderRooms(data.rooms || []);
  } catch {
    roomsList.replaceChildren(statusLine("Rooms show when the online server is reachable."));
  }
}

function renderRooms(rooms) {
  roomsList.replaceChildren();
  if (rooms.length === 0) {
    roomsList.append(statusLine("No rooms yet"));
    return;
  }
  for (const room of rooms) {
    roomsList.append(roomButton(room));
  }
}

function roomButton(room) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "room-row";
  button.disabled = !room.open;
  button.title = room.open ? `Join ${room.name}` : `${room.name} is full`;

  const name = document.createElement("span");
  name.textContent = room.name;
  const meta = document.createElement("small");
  meta.textContent = room.players?.map((player) => `${player.name} ${player.rating}`).join(" / ") || "Waiting";
  const count = document.createElement("strong");
  count.textContent = `${room.peers}/2`;

  const label = document.createElement("div");
  label.append(name, meta);
  button.append(label, count);
  button.addEventListener("click", () => {
    roomInput.value = room.name;
    connectOnline();
  });
  return button;
}

function statusLine(text) {
  const line = document.createElement("p");
  line.textContent = text;
  return line;
}

function updatePlayerStrips() {
  youSwatch.className = `swatch ${localOwner === HUMAN ? "player" : "bot"}`;
  opponentSwatch.className = `swatch ${opponentOwner === HUMAN ? "player" : "bot"}`;
}

function sendMove(row, col, owner) {
  sendOnline({ type: "move", row, col, owner });
}

function sendState(type = "state") {
  sendOnline({ type, state: exportState() });
}

function sendOnline(message) {
  if (!onlineEnabled || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function exportState() {
  return {
    board,
    size,
    mode,
    current,
    moveNumber,
    placementsLeft,
    lastFocus,
    moveHistory,
    gameOver,
  };
}

function loadState(state) {
  size = state.size;
  mode = state.mode;
  board = state.board;
  current = state.current;
  moveNumber = state.moveNumber;
  placementsLeft = state.placementsLeft;
  lastFocus = state.lastFocus;
  moveHistory = state.moveHistory;
  gameOver = state.gameOver;
  cameraSize = clampCameraSize(account.screenSize);
  updateScreenSizeControl();
  updateCameraCss();
  rulesText.textContent = `${MODES[mode].rules} No legal move means defeat.`;
  updateModeButtons();
  focusOwnerCamera(localOwner);
  hideVictory();
  render();
  updateTurnStatus();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function key(row, col) {
  return `${row},${col}`;
}

boardEl.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || current !== HUMAN) return;
  makeMove(Number(cell.dataset.row), Number(cell.dataset.col), HUMAN);
});
boardEl.addEventListener("wheel", scrollCamera, { passive: false });

newGameBtn.addEventListener("click", () => {
  if (onlineEnabled && localOwner !== HUMAN) {
    setStatus("Only blue side can start a new online game.");
    return;
  }
  resetGame();
});
playAgainBtn.addEventListener("click", resetGame);
saveProfileBtn.addEventListener("click", () => {
  saveProfileFromInputs("local");
});
googleProfileBtn.addEventListener("click", () => {
  saveProfileFromInputs("google-ready");
});
screenSizeInput.addEventListener("input", () => updateScreenSize(screenSizeInput.value));
themeSelect.addEventListener("change", () => updateTheme(themeSelect.value));
onlineServerInput.addEventListener("change", () => saveOnlineServer(onlineServerInput.value));
onlineBtn.addEventListener("click", connectOnline);
refreshRoomsBtn.addEventListener("click", () => refreshRooms(true));
for (const button of panelTabButtons) {
  button.addEventListener("click", () => activatePanel(button.dataset.panel));
}
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (onlineEnabled && localOwner !== HUMAN) {
      setStatus("Only blue side can change online mode.");
      return;
    }
    mode = button.dataset.mode;
    resetGame();
  });
}
for (const button of cameraButtons) {
  button.addEventListener("click", () => {
    const action = button.dataset.camera;
    if (action === "you") {
      focusOwnerCamera(HUMAN);
      render();
    }
    if (action === "bot") {
      focusOwnerCamera(BOT);
      render();
    }
    if (action === "all") {
      focusAllCamera();
      render();
    }
  });
}

updateProfileUI();
resetGame();
refreshRooms(true);
roomsRefreshTimer = window.setInterval(refreshRooms, 5000);

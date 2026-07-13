/*
  Tileify v1.3.3 Literal Equation Mode Sandbox

  New/updated transformations:
  - Move an additive tile across an equation/inequality boundary.
  - Move an isolated additive count as a multiplicative factor across the boundary.
  - When a positive multiplicative factor crosses, it becomes a denominator-position factor on the other side.
  - If that factor is negative and the boundary is an inequality, the inequality flips automatically.
  - Reveal numeric factors and cancel matching numerator/denominator structures, such as 15/3 -> (5*3)/3 -> 5/1.
  - When a negative multiplicative factor crosses, the remaining isolated variable becomes positive.
  - Parentheses become composite tiles.
  - The parser canonicalizes trailing constants, so (x+2)4 becomes 4(x+2).
  - Composite tiles visibly display their additive count, such as +4(x+2).
  - Expand reveals repeated internal structure, such as 3(x+2) -> x+2+x+2+x+2.
  - An isolated composite tile can move its outside factor across the boundary, such as 4(x+2)=20 -> (x+2)=20/4.
  - Hidden /1 denominators can be shown or hidden.
  - Single parenthetical groups can be unwrapped.
  - A whole side can be grouped into parentheses when needed.
  - Negative divided by negative now produces a positive fraction tile.
  - Denominator-position tiles can cross the boundary into numerator position on the other side.
  - Example: 3/x = 9 becomes 3/1 = 9x.
  - Constants and numeric fraction tiles normalize as rational constants before combining.
  - Nested numeric fractions flatten automatically, so (14/1)/4 becomes 14/4.
  - Multiplicative movement creates fraction structure without performing division or requiring even divisibility.
  - Isolated absolute-value tiles can split into two branches.
  - Factor reveal and factor cancellation are now separate transformations.
  - Monic quadratic trinomials can reveal factor structure step by step.
  - Quadratics split the middle term, then students select/highlight tiles to reveal factor steps.
  - Factoring tools now work for expressions, not only equations equal to zero.
  - Selected number tiles can reveal chosen factor structure such as 6 -> 2·3.
  - Highlighted quadratic groups now factor correctly inside expressions.
  - A typed tile can be added to both sides of an equation or inequality.
  - Highlighted three-term monic trinomials can reveal factor structure directly.
  - Factoring works on either side of an equation, even when the other side is not zero.
  - Repeated binomial products can reveal squared-binomial structure.
  - Entire equations can be raised to integer or fractional powers as a structure move.
  - Power shells can reveal and combine power-to-power multiplication.
  - Even-root solving can put the ± on the number side.
  - Constants move in front of plus-or-minus terms for standard solution form.
  - Plus-or-minus tiles can split into two branches, and negative even-root numbers can show an i-extension.
  - Zero tile disappears when accompanied by a nonzero tile.
*/

const input = document.getElementById("mathInput");
const parseBtn = document.getElementById("parseBtn");
const combineBtn = document.getElementById("combineBtn");
const expandBtn = document.getElementById("expandBtn");
const toggleOnesBtn = document.getElementById("toggleOnesBtn");
const removeParenthesesBtn = null;
const groupButtons = document.getElementById("groupButtons");
const absoluteButtons = document.getElementById("absoluteButtons");
const quadraticButtons = document.getElementById("quadraticButtons");
const branchView = document.getElementById("branchView");
const moveButtons = document.getElementById("moveButtons");
const multiplicativeButtons = document.getElementById("multiplicativeButtons");
const revealFactorsBtn = document.getElementById("revealFactorsBtn");
const cancelFactorsBtn = document.getElementById("cancelFactorsBtn");
const addBothInput = document.getElementById("addBothInput");
const addBothBtn = document.getElementById("addBothBtn");
const powerBothInput = document.getElementById("powerBothInput");
const powerBothBtn = document.getElementById("powerBothBtn");
const literalModeToggle = document.getElementById("literalModeToggle");
const tileView = document.getElementById("tileView");
const debugOutput = document.getElementById("debugOutput");
const transformations = document.getElementById("transformations");
const message = document.getElementById("message");
const historyList = document.getElementById("historyList");

let currentModel = null;
let history = [];
let showHiddenOnes = false;
let literalMode = false;
let currentBranches = [];
let selectedTileIds = new Set();
let suppressNextTileClick = false;

let dragState = {
  active: false,
  pending: false,
  tileId: null,
  side: null,
  dragKind: null,
  tileEl: null,
  startX: 0,
  startY: 0,
  ghost: null,
  lastZone: null,
  originalCharge: null,
  literalFactorIndex: null
};

const SUPERSCRIPT_MAP = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9"
};

function normalizeInput(raw) {
  let s = raw.trim();

  s = s.replaceAll("−", "-")
       .replaceAll("–", "-")
       .replaceAll("—", "-")
       .replaceAll("≤", "<=")
       .replaceAll("≥", ">=")
       .replaceAll("⋅", "*")
       .replaceAll("·", "*");

  s = s.replace(/([a-zA-Z\)])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, base, sup) => {
    const digits = sup.split("").map(ch => SUPERSCRIPT_MAP[ch] ?? ch).join("");
    return `${base}^${digits}`;
  });

  return s.replace(/\s+/g, "");
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function reduceRational(numerator, denominator) {
  if (denominator === 0) throw new Error("Multiplicative completion cannot have denominator 0.");
  const sign = numerator * denominator < 0 ? -1 : 1;
  numerator = Math.abs(numerator);
  denominator = Math.abs(denominator);
  const g = gcd(numerator, denominator);
  return { numerator: sign * (numerator / g), denominator: denominator / g };
}

function completionLabel(completion) {
  if (!completion) return "1";
  if (completion.denominator === 1) return String(completion.numerator);
  return `${completion.numerator}/${completion.denominator}`;
}

function absCompletion(completion) {
  return {
    numerator: Math.abs(completion.numerator),
    denominator: completion.denominator
  };
}

function parseCompletionToken(token) {
  if (!token) {
    return {
      completion: { numerator: 1, denominator: 1 },
      positionFromSign: "numerator"
    };
  }

  let cleaned = token.trim();
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    cleaned = cleaned.slice(1, -1);
  }

  let numerator;
  let denominator;

  if (cleaned.includes("/")) {
    const [n, d] = cleaned.split("/");
    numerator = Number(n);
    denominator = Number(d);
  } else {
    numerator = Number(cleaned);
    denominator = 1;
  }

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new Error(`Invalid multiplicative completion: ${token}`);
  }

  const reduced = reduceRational(numerator, denominator);
  const positionFromSign = reduced.numerator < 0 ? "denominator" : "numerator";

  return {
    completion: absCompletion(reduced),
    positionFromSign
  };
}

function makeLikeSignature(tile) {
  if (tile.kind === "constant") return "constant|1";

  if (tile.kind === "variable") {
    return [
      "variable",
      tile.identity,
      `completion:${completionLabel(tile.multiplicativeCompletion)}`,
      `position:${tile.multiplicativePosition}`
    ].join("|");
  }

  return null;
}

function withComputedFlags(tile) {
  return {
    ...tile,
    likeSignature: makeLikeSignature(tile),
    isAtomic: tile.kind === "constant" || tile.kind === "variable",
    isMovable: tile.kind !== "boundary",
    isIsolated: false
  };
}

function findBoundary(s) {
  for (const symbol of ["<=", ">=", "=", "<", ">"]) {
    const idx = s.indexOf(symbol);
    if (idx !== -1) {
      return { type: symbol, left: s.slice(0, idx), right: s.slice(idx + symbol.length) };
    }
  }
  return { type: null, left: s, right: null };
}

function splitIntoTerms(sideText) {
  if (!sideText) return [];
  let s = sideText;
  if (!s.startsWith("+") && !s.startsWith("-")) s = "+" + s;

  const terms = [];
  let current = "";
  let depth = 0;
  let inAbs = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (ch === "|") inAbs = !inAbs;
    if (ch === "(" && !inAbs) depth++;
    if (ch === ")" && !inAbs) depth--;

    const isSign = ch === "+" || ch === "-";
    const beginsNewTerm = isSign && i !== 0 && depth === 0 && !inAbs;

    if (beginsNewTerm) {
      terms.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }

  if (current) terms.push(current);
  return terms;
}

function stripOuterParens(s) {
  if (!(s.startsWith("(") && s.endsWith(")"))) return s;

  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    if (s[i] === ")") depth--;
    if (depth === 0 && i < s.length - 1) return s;
  }

  return s.slice(1, -1);
}

function splitTopLevelSlash(s) {
  let depth = 0;
  let inAbs = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "|") inAbs = !inAbs;
    if (ch === "(" && !inAbs) depth++;
    if (ch === ")" && !inAbs) depth--;
    if (ch === "/" && depth === 0 && !inAbs) {
      return [s.slice(0, i), s.slice(i + 1)];
    }
  }

  return null;
}


function parseFactorBody(body, forcedMultiplicativePosition = "numerator") {
  body = stripOuterParens(body);

  if (body === "") {
    return {
      kind: "empty",
      display: "",
      raw: body,
      multiplicativePosition: forcedMultiplicativePosition
    };
  }

  if (body.startsWith("|") && body.endsWith("|")) {
    return {
      kind: "absolute",
      display: `|${body.slice(1, -1)}|`,
      raw: body,
      identity: "absolute",
      structureType: "absoluteValue",
      multiplicativePosition: forcedMultiplicativePosition,
      childrenRaw: body.slice(1, -1)
    };
  }

  // Simple parenthetical/composite structure.
  // Supports:
  //   (x+2)
  //   3(x+2)
  //   2(x-5)
  //   (x+2)4   canonicalized as 4(x+2)
  // The outer sign is handled by parseTerm before this function.
  const leadingCompositeMatch = body.match(/^(\d*)\((.*)\)$/);
  const trailingCompositeMatch = body.match(/^\((.*)\)(\d+)$/);

  if (leadingCompositeMatch || trailingCompositeMatch) {
    const additiveCount = leadingCompositeMatch
      ? (leadingCompositeMatch[1] === "" ? 1 : Number(leadingCompositeMatch[1]))
      : Number(trailingCompositeMatch[2]);

    const childrenRaw = leadingCompositeMatch
      ? leadingCompositeMatch[2]
      : trailingCompositeMatch[1];

    const wasCanonicalized = Boolean(trailingCompositeMatch);

    return {
      kind: "composite",
      raw: body,
      display: `${additiveCount === 1 ? "" : additiveCount}(${childrenRaw})`,
      identity: `(${childrenRaw})`,
      additiveCount,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: forcedMultiplicativePosition,
      structureType: "group",
      childrenRaw,
      canonicalizedFrom: wasCanonicalized ? body : null,
      notes: wasCanonicalized
        ? [`Canonicalized ${body} as ${additiveCount}(${childrenRaw}).`]
        : []
    };
  }

  const variableMatch = body.match(/^(\d*)?([a-zA-Z])(?:\^(\(-?\d+(?:\/\d+)?\)|-?\d+(?:\/\d+)?))?$/);
  if (variableMatch) {
    const additiveCount = variableMatch[1] === "" ? 1 : Number(variableMatch[1] || 1);
    const variable = variableMatch[2];
    const completionInfo = parseCompletionToken(variableMatch[3]);
    const completion = completionInfo.completion;

    let multiplicativePosition = forcedMultiplicativePosition;
    if (completionInfo.positionFromSign === "denominator") {
      multiplicativePosition = "denominator";
    }

    const completionText = completionLabel(completion);
    const renderedCompletion = completionText === "1" ? "" : `^${completionText}`;

    return {
      kind: "variable",
      raw: body,
      display: `${additiveCount === 1 ? "" : additiveCount}${variable}${renderedCompletion}`,
      identity: variable,
      additiveCount,
      multiplicativeCompletion: completion,
      multiplicativePosition,
      structureType: "atomic"
    };
  }

  if (/^\d+$/.test(body)) {
    return {
      kind: "constant",
      raw: body,
      display: body,
      identity: "1",
      additiveCount: Number(body),
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: forcedMultiplicativePosition,
      structureType: "atomic"
    };
  }

  return {
    kind: "composite",
    raw: body,
    display: body,
    identity: body,
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: forcedMultiplicativePosition,
    structureType: "composite",
    childrenRaw: body
  };
}


function isLiteralModeProductToken(token) {
  return literalMode &&
    /^[A-Za-z]{2,}$/.test(token) &&
    !token.includes("^");
}

function makeLiteralProductTile({ side, index, raw, factors, additiveCharge = "+", additiveCount = 1 }) {
  const factorObjects = factors.map((factor, factorIndex) => ({
    id: `${side}-literal-factor-${index}-${factorIndex}`,
    kind: "literalFactor",
    raw: factor,
    display: factor,
    identity: factor,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null
  }));

  return withComputedFlags({
    id: `${side}-literal-product-${index}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw,
    display: factors.join("·"),
    kind: "literalProduct",
    identity: factors.join("*"),
    additiveCharge,
    additiveCount,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    factors: factorObjects,
    children: factorObjects,
    structureType: "literalProduct",
    notes: [
      "Literal Mode treats adjacent letters as multiplied symbolic factors."
    ]
  });
}

function getLiteralFactorMoveCandidates(model) {
  if (!model || !model.boundary || !literalMode) return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    const tiles = model.sides[side];
    if (!tiles || tiles.length !== 1) continue;

    const tile = tiles[0];
    if (tile.kind !== "literalProduct" || !tile.factors || tile.factors.length < 2) continue;
    if (tile.additiveCharge !== "+" || tile.additiveCount !== 1) continue;

    tile.factors.forEach((factor, factorIndex) => {
      candidates.push({ tile, factor, factorIndex, side });
    });
  }

  return candidates;
}

function makeLiteralProductFromFactors({ side, sourceTile, factorsToKeep }) {
  const sign = sourceTile.additiveCharge === "-" ? -1 : 1;

  if (factorsToKeep.length === 0) {
    return makeConstantTile({ side, index: 0, signedAdditiveCount: sign });
  }

  if (factorsToKeep.length === 1) {
    return makeVariableTile({
      side,
      index: 0,
      identity: factorsToKeep[0].identity || factorsToKeep[0].raw,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      signedAdditiveCount: sign
    });
  }

  return makeLiteralProductTile({
    side,
    index: 0,
    raw: factorsToKeep.map(f => f.raw || f.display).join(""),
    factors: factorsToKeep.map(f => f.raw || f.display),
    additiveCharge: sourceTile.additiveCharge,
    additiveCount: sourceTile.additiveCount || 1
  });
}

function simpleTileDisplay(tile) {
  if (!tile) return "";
  if (tile.kind === "literalProduct") return (tile.additiveCharge === "-" ? "-" : "") + tile.factors.map(f => f.display || f.raw).join("·");
  if (tile.kind === "fraction") return tile.display || tile.raw;
  return tileLabel(tile).replace(/^\+/, "");
}

function makeFractionTileFromSymbolicDenominator({ side, numeratorTiles, denominatorFactor, fractionCharge = "+" }) {
  const numeratorLabel = numeratorTiles.map(simpleTileDisplay).join(" + ") || "1";

  const numerator = {
    kind: "symbolicNumerator",
    raw: numeratorLabel,
    display: numeratorLabel,
    identity: numeratorLabel,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator"
  };

  const denominator = {
    kind: "symbolicDenominator",
    raw: denominatorFactor.raw || denominatorFactor.display,
    display: denominatorFactor.display || denominatorFactor.raw,
    identity: denominatorFactor.identity || denominatorFactor.raw,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "denominator"
  };

  return withComputedFlags({
    id: `${side}-literal-fraction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${numerator.display}/${denominator.display}`,
    display: `${numerator.display}/${denominator.display}`,
    kind: "fraction",
    identity: "fraction",
    additiveCharge: fractionCharge,
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [
      { ...numerator, relationshipToParent: "numerator" },
      { ...denominator, relationshipToParent: "denominator" }
    ],
    numerator,
    denominator,
    structureType: "fraction",
    notes: [
      "Created in Literal Mode by moving a symbolic factor into denominator position."
    ]
  });
}

function moveLiteralFactorAcross(tileId, factorIndex) {
  if (!currentModel || !currentModel.boundary) {
    setMessage("Literal factor movement needs an equation boundary.", "warn");
    return;
  }

  const location = findTileLocation(tileId);
  if (!location || location.tile.kind !== "literalProduct") {
    setMessage("Could not find that literal product tile.", "warn");
    return;
  }

  const sourceTile = location.tile;
  const factor = sourceTile.factors[factorIndex];

  if (!factor) {
    setMessage("Could not find that symbolic factor.", "warn");
    return;
  }

  const sourceSide = location.side;
  const targetSide = oppositeSide(sourceSide);

  const remainingFactors = sourceTile.factors.filter((_, index) => index !== factorIndex);
  const updatedSourceTile = makeLiteralProductFromFactors({
    side: sourceSide,
    sourceTile,
    factorsToKeep: remainingFactors
  });

  const targetTiles = [...currentModel.sides[targetSide]];
  const newTargetFraction = makeFractionTileFromSymbolicDenominator({
    side: targetSide,
    numeratorTiles: targetTiles,
    denominatorFactor: factor,
    fractionCharge: "+"
  });

  const nextSides = {
    left: [...currentModel.sides.left],
    right: currentModel.boundary ? [...currentModel.sides.right] : []
  };

  nextSides[sourceSide] = [updatedSourceTile];
  nextSides[targetSide] = [newTargetFraction];

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: nextSides,
    lastTransformation: "Literal Factor Boundary Crossing"
  });

  clearSelection();
  history.push(`Moved symbolic factor ${factor.display || factor.raw} into denominator position on the ${targetSide} side.`);
  setMessage(`Moved ${factor.display || factor.raw} into denominator position.`, "good");
  renderModel(currentModel);
}


function parseTerm(termText, side, index) {
  const original = termText;
  let additiveCharge = "+";
  let body = termText;

  if (body.startsWith("+")) body = body.slice(1);
  else if (body.startsWith("-")) {
    additiveCharge = "-";
    body = body.slice(1);
  }

  if (body === "") throw new Error(`Empty term on ${side} side.`);

  if (isLiteralModeProductToken(body)) {
    return makeLiteralProductTile({
      side,
      index,
      raw: original,
      factors: body.split(""),
      additiveCharge,
      additiveCount: 1
    });
  }

  const fractionParts = splitTopLevelSlash(body);
  if (fractionParts) {
    const numeratorRaw = fractionParts[0] || "1";
    const denominatorRaw = fractionParts[1] || "1";
    const numerator = parseFactorBody(numeratorRaw, "numerator");
    const denominator = parseFactorBody(denominatorRaw, "denominator");

    return withComputedFlags({
      id: `${side}-${index}`,
      raw: original,
      display: `${additiveCharge === "-" ? "-" : ""}${numerator.display}/${denominator.display}`,
      kind: "fraction",
      identity: "fraction",
      additiveCharge,
      additiveCount: 1,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      side,
      parentId: null,
      children: [
        { ...numerator, relationshipToParent: "numerator" },
        { ...denominator, relationshipToParent: "denominator" }
      ],
      numerator,
      denominator,
      structureType: "fraction",
      notes: [
        "Fraction structure detected.",
        "Numerator and denominator are separate multiplicative positions."
      ]
    });
  }

  const factor = parseFactorBody(body);

  if (factor.kind === "absolute") {
    return withComputedFlags({
      id: `${side}-${index}`,
      raw: original,
      display: `${additiveCharge === "-" ? "-" : ""}${factor.display}`,
      kind: "absolute",
      identity: "absolute",
      additiveCharge,
      additiveCount: 1,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      side,
      parentId: null,
      children: [],
      childrenRaw: factor.childrenRaw,
      structureType: "absoluteValue",
      notes: ["Absolute value shell detected. Branching is only legal after isolation."]
    });
  }

  if (factor.kind === "variable") {
    return withComputedFlags({
      id: `${side}-${index}`,
      raw: original,
      display: `${additiveCharge === "-" ? "-" : ""}${factor.display}`,
      kind: "variable",
      identity: factor.identity,
      additiveCharge,
      additiveCount: factor.additiveCount,
      multiplicativeCompletion: factor.multiplicativeCompletion,
      multiplicativePosition: factor.multiplicativePosition,
      side,
      parentId: null,
      children: [],
      structureType: "atomic",
      notes: [
        factor.additiveCount > 1 ? "Additive count is a compressed stack of matching tiles." : "Additive count is implicit 1.",
        completionLabel(factor.multiplicativeCompletion) !== "1"
          ? "Multiplicative completion is rendered as exponent notation."
          : "Multiplicative completion is one full base tile.",
        factor.multiplicativePosition === "denominator"
          ? "This tile lives in denominator position."
          : "This tile lives in numerator position."
      ]
    });
  }

  if (factor.kind === "constant") {
    return withComputedFlags({
      id: `${side}-${index}`,
      raw: original,
      display: `${additiveCharge === "-" ? "-" : ""}${factor.display}`,
      kind: "constant",
      identity: "1",
      additiveCharge,
      additiveCount: factor.additiveCount,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      side,
      parentId: null,
      children: [],
      structureType: "atomic",
      notes: [
        factor.additiveCount === 0
          ? "Zero tile."
          : "Constant is a compressed additive stack of 1 tiles."
      ]
    });
  }

  return withComputedFlags({
    id: `${side}-${index}`,
    raw: original,
    display: `${additiveCharge === "-" ? "-" : ""}${factor.display}`,
    kind: "composite",
    identity: factor.identity,
    additiveCharge,
    additiveCount: factor.additiveCount || 1,
    multiplicativeCompletion: factor.multiplicativeCompletion || { numerator: 1, denominator: 1 },
    multiplicativePosition: factor.multiplicativePosition || "numerator",
    side,
    parentId: null,
    children: [],
    childrenRaw: factor.childrenRaw,
    structureType: factor.structureType || "composite",
    notes: [
      ...(factor.notes || []),
      factor.structureType === "group"
        ? "Parenthetical group detected. Expand can reveal repeated internal structure."
        : "Composite term placeholder."
    ]
  });
}

function parseSide(sideText, side) {
  return splitIntoTerms(sideText).map((term, idx) => parseTerm(term, side, idx));
}

function parseMath(raw) {
  const normalized = normalizeInput(raw);
  const boundary = findBoundary(normalized);

  const model = {
    raw,
    normalized,
    type: boundary.type ? "relation" : "expression",
    boundary: boundary.type,
    sides: {
      left: parseSide(boundary.left, "left"),
      right: boundary.right === null ? [] : parseSide(boundary.right, "right")
    }
  };

  return cleanupModelZeros(model);
}

function signedAdditiveCount(tile) {
  const sign = tile.additiveCharge === "-" ? -1 : 1;
  return sign * tile.additiveCount;
}

function makeVariableTile({ side, index, identity, multiplicativeCompletion, multiplicativePosition, signedAdditiveCount }) {
  const additiveCharge = signedAdditiveCount < 0 ? "-" : "+";
  const additiveCount = Math.abs(signedAdditiveCount);
  const completionText = completionLabel(multiplicativeCompletion);

  return withComputedFlags({
    id: `${side}-combined-var-${index}`,
    raw: `${signedAdditiveCount}${identity}`,
    display: `${additiveCharge === "-" ? "-" : ""}${additiveCount === 1 ? "" : additiveCount}${identity}${completionText === "1" ? "" : "^" + completionText}`,
    kind: "variable",
    identity,
    additiveCharge,
    additiveCount,
    multiplicativeCompletion: { ...multiplicativeCompletion },
    multiplicativePosition,
    side,
    parentId: null,
    children: [],
    structureType: "atomic",
    notes: [`Combined tile from like ${identity}-tiles.`]
  });
}

function makeConstantTile({ side, index, signedAdditiveCount }) {
  const additiveCharge = signedAdditiveCount < 0 ? "-" : "+";
  const additiveCount = Math.abs(signedAdditiveCount);

  return withComputedFlags({
    id: `${side}-combined-const-${index}`,
    raw: String(signedAdditiveCount),
    display: `${additiveCharge === "-" ? "-" : ""}${additiveCount}`,
    kind: "constant",
    identity: "1",
    additiveCharge,
    additiveCount,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    structureType: "atomic",
    notes: ["Combined constant tile."]
  });
}


function isZeroTile(tile) {
  return tile &&
    tile.kind === "constant" &&
    tile.additiveCount === 0 &&
    tile.identity === "1";
}

function cleanupZeroPlaceholders(tiles) {
  if (!tiles || tiles.length === 0) return tiles;

  // A zero tile is only a placeholder when it is alone.
  // If any nonzero tile exists on the same side, zero disappears.
  if (tiles.length > 1) {
    return tiles.filter(tile => !isZeroTile(tile));
  }

  return tiles;
}

function cleanupModelZeros(model) {
  return {
    ...model,
    sides: {
      left: cleanupZeroPlaceholders(model.sides.left),
      right: cleanupZeroPlaceholders(model.sides.right)
    }
  };
}


function flipInequalityBoundary(boundary) {
  const flips = {
    "<": ">",
    ">": "<",
    "<=": ">=",
    ">=": "<="
  };
  return flips[boundary] || boundary;
}

function isInequalityBoundary(boundary) {
  return ["<", ">", "<=", ">="].includes(boundary);
}

function sideOverallSignForSingleTile(tiles) {
  // v0.7.1 only safely folds signs when the target side is a single signed tile.
  // For multi-tile expressions, the sign belongs to the expression structure and should not be flattened.
  if (!tiles || tiles.length !== 1) return "+";
  return tiles[0].additiveCharge === "-" ? "-" : "+";
}

function multiplySigns(signA, signB) {
  return signA === signB ? "+" : "-";
}


function tileCoreDisplay(tile, includeCharge = true) {
  const sign = includeCharge && tile.additiveCharge === "-" ? "-" : "";

  if (tile.kind === "constant") {
    return `${sign}${tile.additiveCount}`;
  }

  if (tile.kind === "variable") {
    const count = tile.additiveCount === 1 ? "" : tile.additiveCount;
    const completionText = completionLabel(tile.multiplicativeCompletion);
    const renderedCompletion = completionText === "1" ? "" : `^${completionText}`;
    return `${sign}${count}${tile.identity}${renderedCompletion}`;
  }

  if (tile.kind === "fraction") {
    return `${sign}${tile.numerator.display}/${tile.denominator.display}`;
  }

  if (tile.kind === "absolute") {
    return `${sign}|${tile.childrenRaw}|`;
  }

  if (tile.kind === "composite") {
    const count = tile.additiveCount === 1 ? "" : tile.additiveCount;
    const inside = tile.childrenRaw ? `(${tile.childrenRaw})` : tile.identity;
    return `${sign}${count}${inside}`;
  }

  if (tile.kind === "product" || tile.kind === "factoredGroup" || tile.kind === "factoredNumber" || tile.kind === "squaredBinomial" || tile.kind === "powerShell" || tile.kind === "powerProduct" || tile.kind === "plusMinus" || tile.kind === "imaginaryRoot") {
    const count = tile.kind === "product" && tile.additiveCount !== 1 ? tile.additiveCount : "";
    return `${sign}${count}${tile.display}`;
  }

  return `${sign}${tile.identity}`;
}

function sideExpressionDisplay(tiles) {
  if (!tiles || tiles.length === 0) return "0";

  return tiles.map((tile, index) => {
    const core = tileCoreDisplay(tile, false);
    if (index === 0) {
      return tile.additiveCharge === "-" ? `-${core}` : core;
    }
    return `${tile.additiveCharge === "-" ? " - " : " + "}${core}`;
  }).join("");
}

function factorFromTile(tile, forcedMultiplicativePosition) {
  if (tile.kind === "constant") {
    return {
      kind: "constant",
      raw: String(tile.additiveCount),
      display: String(tile.additiveCount),
      identity: "1",
      additiveCount: tile.additiveCount,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: forcedMultiplicativePosition,
      structureType: "atomic"
    };
  }

  if (tile.kind === "variable") {
    const count = tile.additiveCount === 1 ? "" : tile.additiveCount;
    const completionText = completionLabel(tile.multiplicativeCompletion);
    return {
      kind: "variable",
      raw: tileCoreDisplay(tile, false),
      display: `${count}${tile.identity}${completionText === "1" ? "" : "^" + completionText}`,
      identity: tile.identity,
      additiveCount: tile.additiveCount,
      multiplicativeCompletion: { ...tile.multiplicativeCompletion },
      multiplicativePosition: forcedMultiplicativePosition,
      structureType: "atomic"
    };
  }

  return {
    kind: "composite",
    raw: tileCoreDisplay(tile, false),
    display: tileCoreDisplay(tile, false),
    identity: tileCoreDisplay(tile, false),
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: forcedMultiplicativePosition,
    structureType: "composite",
    childrenRaw: tileCoreDisplay(tile, false)
  };
}


function canFlattenNumericFractionOverDenominator(numeratorTiles, denominatorCount) {
  return numeratorTiles &&
    numeratorTiles.length === 1 &&
    numeratorTiles[0].kind === "fraction" &&
    numeratorTiles[0].numerator &&
    numeratorTiles[0].denominator &&
    numeratorTiles[0].numerator.kind === "constant" &&
    numeratorTiles[0].denominator.kind === "constant" &&
    Number.isFinite(Number(denominatorCount));
}

function flattenedFractionPartsFromNestedNumerator(nestedFractionTile, incomingDenominatorCount, incomingFractionCharge = "+") {
  const nestedSign = nestedFractionTile.additiveCharge === "-" ? -1 : 1;
  const incomingSign = incomingFractionCharge === "-" ? -1 : 1;

  const numeratorSign = nestedFractionTile.numerator.additiveCharge === "-" ? -1 : 1;
  const denominatorSign = nestedFractionTile.denominator.additiveCharge === "-" ? -1 : 1;

  const rawNumerator = nestedSign * incomingSign * numeratorSign * nestedFractionTile.numerator.additiveCount;
  const rawDenominator = denominatorSign * nestedFractionTile.denominator.additiveCount * Number(incomingDenominatorCount);

  // Movement flattens structure but does not perform division or reduce.
  const signOnly = normalizeFractionSignOnly(rawNumerator, rawDenominator, "+");

  return {
    numeratorValue: signOnly.numeratorValue,
    denominatorValue: signOnly.denominatorValue,
    fractionCharge: signOnly.fractionCharge,
    original: `${nestedFractionTile.numerator.display}/${nestedFractionTile.denominator.display}/${incomingDenominatorCount}`
  };
}


function canJoinExistingFractionDenominator(numeratorTiles, denominatorCount) {
  return numeratorTiles &&
    numeratorTiles.length === 1 &&
    numeratorTiles[0].kind === "fraction" &&
    numeratorTiles[0].numerator &&
    numeratorTiles[0].denominator &&
    !denominatorIsOne(numeratorTiles[0]) &&
    Number.isFinite(Number(denominatorCount));
}

function makeJoinedDenominatorFactor(existingDenominator, incomingDenominatorCount) {
  const incoming = Math.abs(Number(incomingDenominatorCount));
  const existingDisplay = existingDenominator.display || existingDenominator.raw || "1";
  const existingRaw = existingDenominator.raw || existingDisplay;

  return {
    kind: "composite",
    raw: `${existingRaw}*${incoming}`,
    display: `${existingDisplay}·${incoming}`,
    identity: `${existingDisplay}·${incoming}`,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "denominator",
    structureType: "denominatorProduct",
    childrenRaw: `${existingRaw}*${incoming}`,
    notes: [
      "Existing denominator kept its structure and the crossed factor joined it."
    ]
  };
}

function makeFractionTileJoiningExistingDenominator({ side, existingFractionTile, denominatorCount, fractionCharge = "+" }) {
  const numerator = factorFromTile({
    ...structuredClone(existingFractionTile.numerator),
    additiveCharge: "+"
  }, "numerator");

  const denominator = makeJoinedDenominatorFactor(existingFractionTile.denominator, denominatorCount);

  return withComputedFlags({
    id: `${side}-fraction-joined-denominator-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${numerator.display}/${denominator.display}`,
    display: `${fractionCharge === "-" ? "-" : ""}${numerator.display}/${denominator.display}`,
    kind: "fraction",
    identity: "fraction",
    additiveCharge: fractionCharge,
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [
      { ...numerator, relationshipToParent: "numerator" },
      { ...denominator, relationshipToParent: "denominator" }
    ],
    numerator,
    denominator,
    structureType: "fraction",
    notes: [
      "Created by multiplicative boundary crossing.",
      `The crossed factor ${Math.abs(Number(denominatorCount))} joined the existing denominator instead of making a nested fraction.`,
      "This keeps denominator structure visible for students."
    ]
  });
}

function makeFractionTileFromSide({ side, numeratorTiles, denominatorCount, fractionCharge = "+" }) {
  if (canJoinExistingFractionDenominator(numeratorTiles, denominatorCount)) {
    return makeFractionTileJoiningExistingDenominator({
      side,
      existingFractionTile: numeratorTiles[0],
      denominatorCount,
      fractionCharge
    });
  }

  if (canFlattenNumericFractionOverDenominator(numeratorTiles, denominatorCount)) {
    const flattened = flattenedFractionPartsFromNestedNumerator(numeratorTiles[0], denominatorCount, fractionCharge);

    return makeFractionTileFromFactors({
      side,
      numeratorValue: flattened.numeratorValue,
      denominatorValue: flattened.denominatorValue,
      fractionCharge: flattened.fractionCharge,
      notes: [
        "Flattened nested fraction structure without reducing.",
        `A fraction in numerator position was restructured with the new denominator: (${flattened.original}).`
      ]
    });
  }

  let numerator;

  if (numeratorTiles.length === 1) {
    // The whole fraction charge carries the numerator/denominator sign relationship.
    // The numerator body itself should be magnitude/structure, not a second negative sign.
    const cleanNumeratorTile = {
      ...structuredClone(numeratorTiles[0]),
      additiveCharge: "+"
    };
    numerator = factorFromTile(cleanNumeratorTile, "numerator");
  } else {
    const display = sideExpressionDisplay(numeratorTiles);
    numerator = {
      kind: "composite",
      raw: display,
      display,
      identity: display,
      additiveCount: 1,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      structureType: "composite",
      childrenRaw: display
    };
  }

  const denominator = {
    kind: "constant",
    raw: String(Math.abs(denominatorCount)),
    display: String(Math.abs(denominatorCount)),
    identity: "1",
    additiveCharge: "+",
    additiveCount: Math.abs(denominatorCount),
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "denominator",
    structureType: "atomic"
  };

  return withComputedFlags({
    id: `${side}-fraction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${numerator.display}/${denominator.display}`,
    display: `${fractionCharge === "-" ? "-" : ""}${numerator.display}/${denominator.display}`,
    kind: "fraction",
    identity: "fraction",
    additiveCharge: fractionCharge,
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [
      { ...numerator, relationshipToParent: "numerator" },
      { ...denominator, relationshipToParent: "denominator" }
    ],
    numerator,
    denominator,
    structureType: "fraction",
    notes: [
      "Created by multiplicative boundary crossing.",
      "The crossed factor now lives in denominator position."
    ]
  });
}

function makeVariableWithAdditiveCount(tile, newCount, forcedCharge = tile.additiveCharge) {
  return withComputedFlags({
    ...structuredClone(tile),
    additiveCount: Math.abs(newCount),
    additiveCharge: forcedCharge,
    raw: `${forcedCharge === "-" ? "-" : ""}${Math.abs(newCount)}${tile.identity}`,
    display: `${forcedCharge === "-" ? "-" : ""}${Math.abs(newCount) === 1 ? "" : Math.abs(newCount)}${tile.identity}`,
    notes: [
      ...(tile.notes || []),
      `Additive count changed from ${tile.additiveCount} to ${Math.abs(newCount)} after multiplicative crossing.`,
      forcedCharge === "+"
        ? "Remaining isolated variable is positive because the signed multiplicative factor crossed the boundary."
        : "Remaining isolated variable kept negative charge."
    ]
  });
}

function makeTileWithAdditiveCount(tile, newCount, forcedCharge = tile.additiveCharge) {
  if (tile.kind === "variable") {
    return makeVariableWithAdditiveCount(tile, newCount, forcedCharge);
  }

  if (tile.kind === "composite") {
    const displayCount = Math.abs(newCount) === 1 ? "" : Math.abs(newCount);
    const inside = tile.childrenRaw ? `(${tile.childrenRaw})` : tile.identity;

    return withComputedFlags({
      ...structuredClone(tile),
      additiveCount: Math.abs(newCount),
      additiveCharge: forcedCharge,
      raw: `${forcedCharge === "-" ? "-" : ""}${displayCount}${inside}`,
      display: `${forcedCharge === "-" ? "-" : ""}${displayCount}${inside}`,
      notes: [
        ...(tile.notes || []),
        `Additive count changed from ${tile.additiveCount} to ${Math.abs(newCount)} after multiplicative crossing.`,
        forcedCharge === "+"
          ? "Remaining isolated composite tile is positive because the signed outside factor crossed the boundary."
          : "Remaining isolated composite tile kept negative charge."
      ]
    });
  }

  return withComputedFlags({
    ...structuredClone(tile),
    additiveCount: Math.abs(newCount),
    additiveCharge: forcedCharge
  });
}


function getIsolatedMovableFactorTiles(model) {
  if (!model || !model.boundary) return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    const sideTiles = model.sides[side];
    if (sideTiles.length !== 1) continue;

    const tile = sideTiles[0];

    const isSupportedIsolatedStructure =
      tile.kind === "variable" ||
      (tile.kind === "composite" && tile.structureType === "group");

    // v0.6 allows the visible additive count of an isolated variable OR parenthetical composite tile to cross.
    if (isSupportedIsolatedStructure && tile.additiveCount > 1 && tile.multiplicativePosition === "numerator") {
      candidates.push(tile);
    }
  }

  return candidates;
}



function isNumericFractionTile(tile) {
  return tile &&
    tile.kind === "fraction" &&
    tile.numerator &&
    tile.denominator &&
    tile.numerator.kind === "constant" &&
    tile.denominator.kind === "constant" &&
    tile.denominator.additiveCount !== 0;
}

function hasRevealableNumericFraction(tile) {
  if (!isNumericFractionTile(tile)) return false;
  if (tile.factorReveal && !tile.factorReveal.cancelled) return false;

  const n = tile.numerator.additiveCount;
  const d = tile.denominator.additiveCount;
  return gcd(n, d) > 1;
}

function hasCancellableRevealedFactors(tile) {
  return isNumericFractionTile(tile) &&
    tile.factorReveal &&
    !tile.factorReveal.cancelled &&
    tile.factorReveal.commonFactor > 1;
}

function makeUnitDenominatorFactor(side) {
  return {
    kind: "constant",
    raw: "1",
    display: "1",
    identity: "1",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "denominator",
    structureType: "atomic"
  };
}

function makeConstantFactorBody(value, position) {
  const signedValue = Number(value);
  return {
    kind: "constant",
    raw: String(Math.abs(signedValue)),
    display: String(Math.abs(signedValue)),
    identity: "1",
    additiveCharge: signedValue < 0 ? "-" : "+",
    additiveCount: Math.abs(signedValue),
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: position,
    structureType: "atomic"
  };
}

function makeFractionTileFromFactors({ side, numeratorValue, denominatorValue, fractionCharge = "+", notes = [] }) {
  // This constructor preserves the numerator and denominator magnitudes.
  // It normalizes sign only; it does NOT reduce 14/4 to 7/2.
  const signOnly = normalizeFractionSignOnly(numeratorValue, denominatorValue, fractionCharge);

  const numerator = makeConstantFactorBody(signOnly.numeratorValue, "numerator");
  const denominator = makeConstantFactorBody(signOnly.denominatorValue, "denominator");
  const structuralCharge = signOnly.fractionCharge;

  return withComputedFlags({
    id: `${side}-fraction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${numerator.display}/${denominator.display}`,
    display: `${structuralCharge === "-" ? "-" : ""}${numerator.display}/${denominator.display}`,
    kind: "fraction",
    identity: "fraction",
    additiveCharge: structuralCharge,
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [
      { ...numerator, relationshipToParent: "numerator" },
      { ...denominator, relationshipToParent: "denominator" }
    ],
    numerator,
    denominator,
    structureType: "fraction",
    factorReveal: null,
    cancellationHistory: notes,
    notes: [
      "Created by structural fraction movement or factor cancellation.",
      ...notes
    ]
  });
}

function revealFactorsInFractionTile(tile, side, index) {
  const numeratorOriginal = tile.numerator.additiveCount;
  const denominatorOriginal = tile.denominator.additiveCount;
  const commonFactor = gcd(numeratorOriginal, denominatorOriginal);

  if (commonFactor <= 1) return tile;

  const remainingNumerator = numeratorOriginal / commonFactor;
  const remainingDenominator = denominatorOriginal / commonFactor;

  return withComputedFlags({
    ...structuredClone(tile),
    factorReveal: {
      numeratorOriginal,
      denominatorOriginal,
      remainingNumerator,
      remainingDenominator,
      commonFactor,
      cancelled: false
    },
    notes: [
      ...(tile.notes || []),
      `${numeratorOriginal} was revealed as ${remainingNumerator}*${commonFactor}.`,
      `${denominatorOriginal} was revealed as ${remainingDenominator}*${commonFactor}.`,
      `Matching factor ${commonFactor} is now visible but not cancelled yet.`
    ]
  });
}

function revealFactorsOnSide(tiles, side) {
  let changed = false;
  const result = tiles.map((tile, index) => {
    if (hasRevealableNumericFraction(tile)) {
      changed = true;
      return revealFactorsInFractionTile(tile, side, index);
    }

    return tile;
  });

  return { tiles: result, changed };
}

function cancelRevealedFractionTile(tile, side, index) {
  const reveal = tile.factorReveal;
  const sign = tile.additiveCharge === "-" ? "-" : "+";

  const notes = [
    `${reveal.numeratorOriginal} was revealed as ${reveal.remainingNumerator}*${reveal.commonFactor}.`,
    `${reveal.denominatorOriginal} was revealed as ${reveal.remainingDenominator}*${reveal.commonFactor}.`,
    `Matching factor ${reveal.commonFactor} cancelled from numerator and denominator.`,
    `Remaining structure is ${reveal.remainingNumerator}/${reveal.remainingDenominator}.`
  ];

  return makeFractionTileFromFactors({
    side,
    numeratorValue: reveal.remainingNumerator,
    denominatorValue: reveal.remainingDenominator,
    fractionCharge: sign,
    notes
  });
}

function cancelRevealedFactorsOnSide(tiles, side) {
  let changed = false;
  const result = tiles.map((tile, index) => {
    if (hasCancellableRevealedFactors(tile)) {
      changed = true;
      return cancelRevealedFractionTile(tile, side, index);
    }

    return tile;
  });

  return { tiles: result, changed };
}


function hasExpandableComposite(tile) {
  // Tileify language: "Expand Parentheses" is the one action for opening
  // parenthetical structure. This includes both repeated groups like
  // 3(x+2) and single groups created by Add Parentheses.
  return tile.kind === "composite" &&
    tile.structureType === "group" &&
    typeof tile.childrenRaw === "string" &&
    tile.childrenRaw.length > 0;
}

function cloneExpandedChild(child, side, copyIndex, childIndex, outerCharge) {
  const cloned = structuredClone(child);
  const shouldFlip = outerCharge === "-";
  const newCharge = shouldFlip ? flipCharge(cloned.additiveCharge) : cloned.additiveCharge;

  return withComputedFlags({
    ...cloned,
    id: `${side}-expanded-${Date.now()}-${copyIndex}-${childIndex}-${Math.random().toString(16).slice(2)}`,
    side,
    additiveCharge: newCharge,
    parentId: null,
    notes: [
      ...(cloned.notes || []),
      shouldFlip
        ? "Expanded from a negative parenthetical tile; inner additive charge flipped."
        : "Expanded from a parenthetical tile."
    ]
  });
}

function expandCompositeTile(tile) {
  if (!hasExpandableComposite(tile)) {
    return { tiles: [tile], stage: "none" };
  }

  const repeatCount = Math.max(1, tile.additiveCount || 1);

  // Stage 1: if the parenthetical tile still has an outside additive count,
  // show that the entire group tile is being copied.
  if (repeatCount > 1) {
    const copiedGroups = [];

    for (let copy = 0; copy < repeatCount; copy++) {
      copiedGroups.push(withComputedFlags({
        ...structuredClone(tile),
        id: `${tile.side}-group-copy-${copy}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        side: tile.side,
        additiveCount: 1,
        parentId: null
      }));
    }

    return { tiles: copiedGroups, stage: "copied-groups" };
  }

  // Stage 2: once the tile is a single group, open it into the inside tiles.
  const expanded = [];
  const children = parseSide(tile.childrenRaw, tile.side);
  children.forEach((child, childIndex) => {
    expanded.push(cloneExpandedChild(child, tile.side, 0, childIndex, tile.additiveCharge));
  });

  return { tiles: expanded, stage: "opened-group" };
}

function expandSide(tiles) {
  let changed = false;
  let copiedGroups = false;
  let openedGroups = false;
  const result = [];

  for (const tile of tiles) {
    if (hasExpandableComposite(tile)) {
      changed = true;
      const expansion = expandCompositeTile(tile);
      result.push(...expansion.tiles);

      if (expansion.stage === "copied-groups") copiedGroups = true;
      if (expansion.stage === "opened-group") openedGroups = true;
    } else {
      result.push(tile);
    }
  }

  return {
    tiles: cleanupZeroPlaceholders(result),
    changed,
    copiedGroups,
    openedGroups
  };
}

function expandCompositeTiles() {
  if (!currentModel) return;

  const left = expandSide(currentModel.sides.left);
  const right = currentModel.boundary
    ? expandSide(currentModel.sides.right)
    : { tiles: [], changed: false, copiedGroups: false, openedGroups: false };

  if (!left.changed && !right.changed) {
    setMessage("No parenthetical structure is ready to expand.", "warn");
    return;
  }

  const copiedGroups = left.copiedGroups || right.copiedGroups;
  const openedGroups = left.openedGroups || right.openedGroups;

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: left.tiles,
      right: currentModel.boundary ? right.tiles : []
    },
    lastTransformation: copiedGroups
      ? "Expand Parentheses Into Repeated Group Tiles"
      : "Open Parentheses Into Internal Tiles"
  });

  if (copiedGroups) {
    history.push("Expanded by copying the parenthetical-expression tile into repeated group tiles.");
    setMessage("The parenthetical tile was copied the required number of times. Expand again to open each group.", "good");
  } else if (openedGroups) {
    history.push("Opened repeated parenthetical group tiles into their inside tiles.");
    setMessage("The copied group tiles opened into inside tiles. Now combine like terms if possible.", "good");
  } else {
    history.push("Expanded/opened parenthetical structure.");
    setMessage("Expanded/opened parenthetical structure. Now combine like terms if possible.", "good");
  }

  renderModel(currentModel);
}


function normalizeRational(numerator, denominator) {
  if (denominator === 0) {
    return { numerator, denominator };
  }

  let n = Number(numerator);
  let d = Number(denominator);

  // Denominator sign is never the charge owner in Tileify.
  // The sign belongs to the numerator/fraction charge.
  if (d < 0) {
    n *= -1;
    d *= -1;
  }

  const g = gcd(Math.abs(n), Math.abs(d));
  return {
    numerator: n / g,
    denominator: d / g
  };
}

function normalizeFractionSignOnly(numerator, denominator, fractionCharge = "+") {
  let n = (fractionCharge === "-" ? -1 : 1) * Number(numerator);
  let d = Number(denominator);

  if (d < 0) {
    n *= -1;
    d *= -1;
  }

  return {
    numeratorValue: Math.abs(n),
    denominatorValue: Math.abs(d),
    fractionCharge: n < 0 ? "-" : "+"
  };
}

function rationalFromConstantLikeTile(tile) {
  if (!tile) return null;

  if (tile.kind === "constant") {
    return normalizeRational(signedAdditiveCount(tile), 1);
  }

  if (tile.kind === "fraction" &&
      tile.numerator &&
      tile.denominator &&
      tile.numerator.kind === "constant" &&
      tile.denominator.kind === "constant") {
    const fractionSign = tile.additiveCharge === "-" ? -1 : 1;
    const numeratorSign = tile.numerator.additiveCharge === "-" ? -1 : 1;
    const denominatorSign = tile.denominator.additiveCharge === "-" ? -1 : 1;

    const n = fractionSign * numeratorSign * tile.numerator.additiveCount;
    const d = denominatorSign * tile.denominator.additiveCount;

    return normalizeRational(n, d);
  }

  return null;
}

function isConstantLikeTile(tile) {
  return rationalFromConstantLikeTile(tile) !== null;
}

function makeRationalConstantTile({ side, index, numerator, denominator }) {
  const normalized = normalizeRational(numerator, denominator);

  if (normalized.denominator === 1) {
    return makeConstantTile({
      side,
      index,
      signedAdditiveCount: normalized.numerator
    });
  }

  const fractionCharge = normalized.numerator < 0 ? "-" : "+";

  return makeFractionTileFromFactors({
    side,
    numeratorValue: Math.abs(normalized.numerator),
    denominatorValue: normalized.denominator,
    fractionCharge,
    notes: [
      "Created by rational constant normalization."
    ]
  });
}

function addRationals(a, b) {
  return normalizeRational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator
  );
}


function combineSide(tiles, side) {
  const variableBuckets = new Map();
  const passthrough = [];

  let constantRational = { numerator: 0, denominator: 1 };
  let constantTouched = false;
  let constantLikeCount = 0;
  let fractionConstantLikeCount = 0;

  for (const tile of tiles) {
    if (isZeroTile(tile)) continue;

    const rational = rationalFromConstantLikeTile(tile);
    if (rational) {
      constantRational = addRationals(constantRational, rational);
      constantTouched = true;
      constantLikeCount += 1;
      if (tile.kind === "fraction") fractionConstantLikeCount += 1;
      continue;
    }

    if (tile.kind === "variable" && tile.likeSignature) {
      const key = tile.likeSignature;
      if (!variableBuckets.has(key)) variableBuckets.set(key, []);
      variableBuckets.get(key).push(tile);
      continue;
    }

    passthrough.push(tile);
  }

  const result = [...passthrough];
  let changed = false;

  for (const [, group] of variableBuckets.entries()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    const sample = group[0];
    const total = group.reduce((sum, tile) => sum + signedAdditiveCount(tile), 0);
    changed = true;

    if (total !== 0) {
      result.push(makeVariableTile({
        side,
        index: result.length,
        identity: sample.identity,
        multiplicativeCompletion: sample.multiplicativeCompletion,
        multiplicativePosition: sample.multiplicativePosition,
        signedAdditiveCount: total
      }));
    }
  }

  if (constantTouched) {
    const normalizedConstant = normalizeRational(constantRational.numerator, constantRational.denominator);

    if (constantLikeCount > 1 || fractionConstantLikeCount > 0 || normalizedConstant.numerator === 0) {
      changed = true;
    }

    if (normalizedConstant.numerator !== 0 || result.length === 0) {
      result.push(makeRationalConstantTile({
        side,
        index: result.length,
        numerator: normalizedConstant.numerator,
        denominator: normalizedConstant.denominator
      }));
    }
  }

  if (result.length === 0) {
    result.push(makeConstantTile({ side, index: 0, signedAdditiveCount: 0 }));
  }

  return { tiles: cleanupZeroPlaceholders(result), changed };
}

function combineLikeTerms() {
  if (!currentModel) return;

  const left = combineSide(currentModel.sides.left, "left");
  const right = currentModel.boundary ? combineSide(currentModel.sides.right, "right") : { tiles: [], changed: false };
  const changed = left.changed || right.changed;

  if (!changed) {
    setMessage("No like terms are available to combine on the same side.", "warn");
    return;
  }

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: left.tiles,
      right: currentModel.boundary ? right.tiles : []
    },
    lastTransformation: "Combine Like Terms"
  });

  history.push("Combined matching tile identities using additive counts.");
  setMessage("Combined like terms successfully.", "good");
  renderModel(currentModel);
}

function oppositeSide(side) {
  return side === "left" ? "right" : "left";
}

function flipCharge(charge) {
  return charge === "+" ? "-" : "+";
}

function cloneTileForMove(tile, targetSide) {
  return withComputedFlags({
    ...structuredClone(tile),
    id: `${targetSide}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    side: targetSide,
    additiveCharge: flipCharge(tile.additiveCharge),
    notes: [
      ...(tile.notes || []),
      "Moved additively across the boundary; additive charge flipped."
    ]
  });
}


function insertMovedTileOnTargetSide(targetTiles, movedTile) {
  const plusMinusIndex = targetTiles.findIndex(tile => tile.kind === "plusMinus");

  if (plusMinusIndex !== -1) {
    targetTiles.splice(plusMinusIndex, 0, movedTile);
  } else {
    targetTiles.push(movedTile);
  }
}

function moveAdditiveTileAcross(tileId) {
  if (!currentModel || !currentModel.boundary) {
    setMessage("No boundary exists, so additive crossing is locked.", "warn");
    return;
  }

  const leftIndex = currentModel.sides.left.findIndex(t => t.id === tileId);
  const rightIndex = currentModel.sides.right.findIndex(t => t.id === tileId);

  let sourceSide;
  let index;
  let tile;

  if (leftIndex !== -1) {
    sourceSide = "left";
    index = leftIndex;
    tile = currentModel.sides.left[leftIndex];
  } else if (rightIndex !== -1) {
    sourceSide = "right";
    index = rightIndex;
    tile = currentModel.sides.right[rightIndex];
  } else {
    setMessage("Could not find that tile.", "warn");
    return;
  }

  const targetSide = oppositeSide(sourceSide);
  const movedTile = cloneTileForMove(tile, targetSide);

  const newLeft = [...currentModel.sides.left];
  const newRight = [...currentModel.sides.right];

  if (sourceSide === "left") {
    newLeft.splice(index, 1);
    insertMovedTileOnTargetSide(newRight, movedTile);
  } else {
    newRight.splice(index, 1);
    insertMovedTileOnTargetSide(newLeft, movedTile);
  }

  if (newLeft.length === 0) newLeft.push(makeConstantTile({ side: "left", index: 0, signedAdditiveCount: 0 }));
  if (newRight.length === 0) newRight.push(makeConstantTile({ side: "right", index: 0, signedAdditiveCount: 0 }));

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: { left: newLeft, right: newRight },
    lastTransformation: "Additive Boundary Crossing"
  });

  const oldLabel = tileReadableLabel(tile);
  const newLabel = tileReadableLabel(movedTile);
  const orderingNote = currentModel.sides[targetSide].some(t => t.kind === "plusMinus")
    ? " Constants are placed before the ± term for standard solution form."
    : "";
  history.push(`${oldLabel} crossed from ${sourceSide} to ${targetSide}; it became ${newLabel}.`);
  setMessage(`${oldLabel} crossed the boundary and became ${newLabel}.${orderingNote}`, "good");
  renderModel(currentModel);
}



function factorReadableLabel(factor) {
  if (!factor) return "?";

  if (factor.kind === "constant") {
    return String(factor.additiveCount);
  }

  if (factor.kind === "variable") {
    const count = factor.additiveCount === 1 ? "" : factor.additiveCount;
    const completionText = completionLabel(factor.multiplicativeCompletion);
    const renderedCompletion = completionText === "1" ? "" : `^${completionText}`;
    return `${count}${factor.identity}${renderedCompletion}`;
  }

  if (factor.kind === "composite") {
    return factor.display || factor.childrenRaw || factor.identity || factor.raw || "group";
  }

  return factor.display || factor.identity || factor.raw || "?";
}

function denominatorKnownPositive(factor) {
  return factor && factor.kind === "constant" && factor.additiveCount > 0;
}

function getDenominatorCrossingCandidates(model) {
  if (!model || !model.boundary) return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    const sideTiles = model.sides[side];
    if (sideTiles.length !== 1) continue;

    const tile = sideTiles[0];
    if (tile.kind !== "fraction") continue;
    if (denominatorIsOne(tile)) continue;

    // Inequalities are only safe here when the denominator is known positive.
    // A variable denominator would need branching/conditions.
    if (isInequalityBoundary(model.boundary) && !denominatorKnownPositive(tile.denominator)) {
      continue;
    }

    candidates.push({
      tile,
      denominator: tile.denominator,
      sourceSide: side,
      targetSide: oppositeSide(side)
    });
  }

  return candidates;
}

function makeFractionWithDenominatorOne(tile) {
  const numerator = structuredClone(tile.numerator);
  const denominator = makeConstantFactorBody(1, "denominator");

  return withComputedFlags({
    ...structuredClone(tile),
    id: `${tile.side}-den-cleared-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${numerator.display}/1`,
    display: `${tile.additiveCharge === "-" ? "-" : ""}${numerator.display}/1`,
    denominator,
    children: [
      { ...numerator, relationshipToParent: "numerator" },
      { ...denominator, relationshipToParent: "denominator" }
    ],
    notes: [
      ...(tile.notes || []),
      "Denominator-position factor crossed the boundary; denominator is now 1."
    ]
  });
}

function makeCompositeTileFromFactor({ side, factor, signedAdditiveCount }) {
  const additiveCharge = signedAdditiveCount < 0 ? "-" : "+";
  const additiveCount = Math.abs(signedAdditiveCount);
  const inside = factor.childrenRaw || factor.identity || factor.display || factor.raw || "?";
  const display = `${additiveCount === 1 ? "" : additiveCount}(${inside})`;

  return withComputedFlags({
    id: `${side}-den-cross-composite-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${additiveCharge === "-" ? "-" : ""}${display}`,
    display: `${additiveCharge === "-" ? "-" : ""}${display}`,
    kind: "composite",
    identity: `(${inside})`,
    additiveCharge,
    additiveCount,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    childrenRaw: inside,
    structureType: factor.structureType === "group" ? "group" : "composite",
    notes: [
      "Created when a denominator-position composite factor crossed into numerator position."
    ]
  });
}

function makeProductPlaceholderTile({ side, targetTiles, factor }) {
  const targetDisplay = sideExpressionDisplay(targetTiles);
  const factorDisplay = factorReadableLabel(factor);
  const display = `${targetDisplay}*${factorDisplay}`;

  return withComputedFlags({
    id: `${side}-den-cross-product-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: display,
    display,
    kind: "composite",
    identity: display,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: structuredClone(targetTiles),
    childrenRaw: display,
    structureType: "product",
    notes: [
      "Product placeholder created by denominator crossing.",
      "This product structure will get stronger in a later build."
    ]
  });
}

function multiplySingleTileByDenominatorFactor(singleTile, factor, side) {
  const targetSignedCount = signedAdditiveCount(singleTile);
  const factorCount = factor.additiveCount || 1;

  if (singleTile.kind === "constant" && factor.kind === "constant") {
    return makeConstantTile({
      side,
      index: 0,
      signedAdditiveCount: targetSignedCount * factorCount
    });
  }

  if (singleTile.kind === "constant" && factor.kind === "variable") {
    return makeVariableTile({
      side,
      index: 0,
      identity: factor.identity,
      multiplicativeCompletion: factor.multiplicativeCompletion,
      multiplicativePosition: "numerator",
      signedAdditiveCount: targetSignedCount * factorCount
    });
  }

  if (singleTile.kind === "variable" && factor.kind === "constant") {
    return makeVariableTile({
      side,
      index: 0,
      identity: singleTile.identity,
      multiplicativeCompletion: singleTile.multiplicativeCompletion,
      multiplicativePosition: "numerator",
      signedAdditiveCount: targetSignedCount * factorCount
    });
  }

  if (singleTile.kind === "constant" && factor.kind === "composite") {
    return makeCompositeTileFromFactor({
      side,
      factor,
      signedAdditiveCount: targetSignedCount * factorCount
    });
  }

  if (singleTile.kind === "composite" && factor.kind === "constant") {
    return makeTileWithAdditiveCount(singleTile, singleTile.additiveCount * factorCount, singleTile.additiveCharge);
  }

  return makeProductPlaceholderTile({
    side,
    targetTiles: [singleTile],
    factor
  });
}

function multiplySideByDenominatorFactor(targetTiles, factor, targetSide) {
  if (!targetTiles || targetTiles.length === 0) {
    return [makeConstantTile({ side: targetSide, index: 0, signedAdditiveCount: 0 })];
  }

  if (targetTiles.length === 1) {
    return [multiplySingleTileByDenominatorFactor(targetTiles[0], factor, targetSide)];
  }

  // If a known positive constant denominator crosses onto a multi-tile side,
  // treat it as a count on a grouped copy of that whole side.
  if (factor.kind === "constant") {
    const inside = sideExpressionDisplay(targetTiles);
    return [withComputedFlags({
      id: `${targetSide}-den-cross-group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      raw: `${factor.additiveCount}(${inside})`,
      display: `${factor.additiveCount}(${inside})`,
      kind: "composite",
      identity: `(${inside})`,
      additiveCharge: "+",
      additiveCount: factor.additiveCount,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      side: targetSide,
      parentId: null,
      children: structuredClone(targetTiles),
      childrenRaw: inside,
      structureType: "group",
      notes: [
        "Created when a constant denominator crossed and grouped a multi-tile side."
      ]
    })];
  }

  return [makeProductPlaceholderTile({
    side: targetSide,
    targetTiles,
    factor
  })];
}

function moveDenominatorAcross(fractionTileId) {
  if (!currentModel || !currentModel.boundary) {
    setMessage("No boundary exists, so denominator crossing is locked.", "warn");
    return;
  }

  const candidate = getDenominatorCrossingCandidates(currentModel)
    .find(item => item.tile.id === fractionTileId);

  if (!candidate) {
    setMessage("Denominator crossing requires an isolated fraction tile. For inequalities, the denominator must be known positive.", "warn");
    return;
  }

  const { tile, denominator, sourceSide, targetSide } = candidate;
  const targetTiles = currentModel.sides[targetSide];

  const updatedSourceFraction = makeFractionWithDenominatorOne(tile);
  const updatedTargetTiles = multiplySideByDenominatorFactor(targetTiles, denominator, targetSide);

  const newSides = {
    left: sourceSide === "left" ? [updatedSourceFraction] : updatedTargetTiles,
    right: sourceSide === "right" ? [updatedSourceFraction] : updatedTargetTiles
  };

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: newSides,
    lastTransformation: "Denominator Boundary Crossing"
  });

  const factorLabel = factorReadableLabel(denominator);
  history.push(`Denominator-position factor ${factorLabel} crossed from ${sourceSide} to ${targetSide} and became numerator-position structure.`);
  setMessage(`Moved denominator ${factorLabel} across the boundary into numerator position on the ${targetSide} side.`, "good");
  renderModel(currentModel);
}


function moveMultiplicativeFactorAcross(tileId) {
  if (!currentModel || !currentModel.boundary) {
    setMessage("No boundary exists, so multiplicative crossing is locked.", "warn");
    return;
  }

  const candidates = getIsolatedMovableFactorTiles(currentModel);
  const tile = candidates.find(t => t.id === tileId);

  if (!tile) {
    setMessage("Multiplicative crossing is only available when a variable tile with additive count greater than 1 is isolated.", "warn");
    return;
  }

  const sourceSide = tile.side;
  const targetSide = oppositeSide(sourceSide);
  const sourceTiles = [...currentModel.sides[sourceSide]];
  const targetTiles = [...currentModel.sides[targetSide]];

  const factorCount = tile.additiveCount;
  const factorSign = tile.additiveCharge === "-" ? -1 : 1;
  const signedFactor = factorSign * factorCount;

  // The entire signed outside factor crosses.
  // Example: -3x < 12 leaves +x.
  // Example: -2(x-5) < 8 leaves +(x-5).
  const updatedSourceTile = makeTileWithAdditiveCount(tile, 1, "+");

  // The sign of the created fraction comes from numerator sign divided by denominator sign.
  // Example: -12 / -3 should create a positive fraction tile.
  // Example: 12 / -3 should create a negative fraction tile.
  const numeratorSign = sideOverallSignForSingleTile(targetTiles);
  const denominatorSign = signedFactor < 0 ? "-" : "+";
  const fractionCharge = multiplySigns(numeratorSign, denominatorSign);

  const newTargetFraction = makeFractionTileFromSide({
    side: targetSide,
    numeratorTiles: targetTiles,
    denominatorCount: Math.abs(signedFactor),
    fractionCharge
  });

  let newBoundary = currentModel.boundary;
  let boundaryMessage = "";

  if (signedFactor < 0 && isInequalityBoundary(currentModel.boundary)) {
    newBoundary = flipInequalityBoundary(currentModel.boundary);
    boundaryMessage = ` The inequality boundary flipped from ${currentModel.boundary} to ${newBoundary}.`;
  }

  const newSides = {
    left: sourceSide === "left" ? [updatedSourceTile] : [newTargetFraction],
    right: sourceSide === "right" ? [updatedSourceTile] : [newTargetFraction]
  };

  currentModel = cleanupModelZeros({
    ...currentModel,
    boundary: newBoundary,
    sides: newSides,
    lastTransformation: "Multiplicative Boundary Crossing"
  });

  history.push(`The signed outside factor ${signedFactor} crossed from ${sourceSide} to ${targetSide}; the remaining tile became positive with additive count 1.${boundaryMessage}`);
  setMessage(`Moved signed outside factor ${signedFactor} across the boundary. If the target was already a fraction, the factor joined the existing denominator.${boundaryMessage}`, "good");
  renderModel(currentModel);
}



function revealCommonFactors() {
  if (!currentModel) return;

  const left = revealFactorsOnSide(currentModel.sides.left, "left");
  const right = currentModel.boundary ? revealFactorsOnSide(currentModel.sides.right, "right") : { tiles: [], changed: false };

  if (!left.changed && !right.changed) {
    setMessage("No numeric fraction structures have common factors to reveal.", "warn");
    return;
  }

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: left.tiles,
      right: currentModel.boundary ? right.tiles : []
    },
    lastTransformation: "Reveal Common Factors"
  });

  history.push("Revealed common factor structure in numeric fractions without cancelling.");
  setMessage("Common factors are now visible. Use Cancel Revealed Factors when you are ready to remove the matching tiles.", "good");
  renderModel(currentModel);
}

function cancelRevealedFactors() {
  if (!currentModel) return;

  const left = cancelRevealedFactorsOnSide(currentModel.sides.left, "left");
  const right = currentModel.boundary ? cancelRevealedFactorsOnSide(currentModel.sides.right, "right") : { tiles: [], changed: false };

  if (!left.changed && !right.changed) {
    setMessage("No revealed matching factors are available to cancel.", "warn");
    return;
  }

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: left.tiles,
      right: currentModel.boundary ? right.tiles : []
    },
    lastTransformation: "Cancel Revealed Factors"
  });

  history.push("Cancelled matching revealed factors from numerator and denominator.");
  setMessage("Cancelled the matching revealed factors. The remaining fraction structure stays visible.", "good");
  renderModel(currentModel);
}

function tileReadableLabel(tile) {
  if (tile.kind === "fraction") {
    const sign = tile.additiveCharge === "-" ? "-" : "+";
    return `${sign}${tile.numerator.display}/${tile.denominator.display}`;
  }

  return tileLabel(tile);
}

function tileLabel(tile) {
  if (tile.kind === "literalProduct") {
    const sign = tile.additiveCharge === "-" ? "-" : "+";
    const count = tile.additiveCount && tile.additiveCount !== 1 ? tile.additiveCount : "";
    const factors = tile.factors ? tile.factors.map(f => f.display || f.raw).join("·") : tile.display;
    return `${sign}${count}${factors}`;
  }

  const charge = tile.additiveCharge === "-" ? "-" : "+";

  if (tile.kind === "constant") return `${charge}${tile.additiveCount}`;

  if (tile.kind === "variable") {
    const count = tile.additiveCount === 1 ? "" : tile.additiveCount;
    const completionText = completionLabel(tile.multiplicativeCompletion);
    const renderedCompletion = completionText === "1" ? "" : `^${completionText}`;
    const pos = tile.multiplicativePosition === "denominator" ? "⁻pos" : "";
    return `${charge}${count}${tile.identity}${renderedCompletion}${pos}`;
  }

  if (tile.kind === "absolute") return `${charge}|${tile.childrenRaw}|`;
  if (tile.kind === "fraction") return charge;

  if (tile.kind === "composite") {
    const count = tile.additiveCount === 1 ? "" : tile.additiveCount;
    const inside = tile.childrenRaw ? `(${tile.childrenRaw})` : tile.identity;
    return `${charge}${count}${inside}`;
  }

  if (tile.kind === "product" || tile.kind === "factoredGroup" || tile.kind === "factoredNumber" || tile.kind === "squaredBinomial" || tile.kind === "powerShell" || tile.kind === "powerProduct" || tile.kind === "plusMinus" || tile.kind === "imaginaryRoot") {
    const count = tile.kind === "product" && tile.additiveCount !== 1 ? tile.additiveCount : "";
    return `${charge}${count}${tile.display}`;
  }

  return `${charge}${tile.identity}`;
}


function denominatorIsOne(tile) {
  return tile.kind === "fraction" &&
    tile.denominator &&
    tile.denominator.kind === "constant" &&
    tile.denominator.additiveCount === 1;
}

function renderAsOverOne(tile, label) {
  const wrap = document.createElement("div");
  wrap.className = "fraction-display";

  const top = document.createElement("div");
  top.className = "frac-part";
  top.textContent = tileCoreDisplay(tile, true);

  const bar = document.createElement("div");
  bar.className = "frac-bar";

  const bottom = document.createElement("div");
  bottom.className = "frac-part";
  bottom.textContent = "1";

  wrap.appendChild(top);
  wrap.appendChild(bar);
  wrap.appendChild(bottom);
  label.appendChild(wrap);
}

function unwrapCompositeTile(tile) {
  if (!(tile.kind === "composite" && tile.structureType === "group")) return [tile];

  // Removing parentheses reveals one copy of the inside structure.
  // This is only meant for additiveCount 1. Larger counts should use Expand.
  const children = parseSide(tile.childrenRaw, tile.side);
  return children.map((child, childIndex) => {
    const shouldFlip = tile.additiveCharge === "-";
    return withComputedFlags({
      ...structuredClone(child),
      id: `${tile.side}-unwrapped-${Date.now()}-${childIndex}-${Math.random().toString(16).slice(2)}`,
      side: tile.side,
      additiveCharge: shouldFlip ? flipCharge(child.additiveCharge) : child.additiveCharge,
      parentId: null,
      notes: [
        ...(child.notes || []),
        shouldFlip
          ? "Unwrapped from a negative parenthetical group; additive charge flipped."
          : "Unwrapped from a parenthetical group."
      ]
    });
  });
}

function hasRemovableParentheses(tile) {
  return tile.kind === "composite" &&
    tile.structureType === "group" &&
    tile.additiveCount === 1 &&
    typeof tile.childrenRaw === "string" &&
    tile.childrenRaw.length > 0;
}

function removeUnneededParentheses() {
  if (!currentModel) return;

  let changed = false;

  function unwrapSide(tiles) {
    const result = [];
    for (const tile of tiles) {
      if (hasRemovableParentheses(tile)) {
        changed = true;
        result.push(...unwrapCompositeTile(tile));
      } else {
        result.push(tile);
      }
    }
    return cleanupZeroPlaceholders(result);
  }

  const left = unwrapSide(currentModel.sides.left);
  const right = currentModel.boundary ? unwrapSide(currentModel.sides.right) : [];

  if (!changed) {
    setMessage("No removable single parenthetical groups are available.", "warn");
    return;
  }

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left,
      right: currentModel.boundary ? right : []
    },
    lastTransformation: "Remove Parentheses"
  });

  history.push("Removed unneeded parentheses from single composite groups.");
  setMessage("Removed parentheses and revealed the inside tiles.", "good");
  renderModel(currentModel);
}

function makeCompositeGroupFromSide(side, tiles) {
  const inside = sideExpressionDisplay(tiles);

  return withComputedFlags({
    id: `${side}-group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `(${inside})`,
    display: `(${inside})`,
    kind: "composite",
    identity: `(${inside})`,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: structuredClone(tiles),
    childrenRaw: inside,
    structureType: "group",
    notes: [
      "Created by grouping the whole side into a parenthetical composite tile."
    ]
  });
}

function groupWholeSide(side) {
  if (!currentModel) return;

  const tiles = currentModel.sides[side];
  if (!tiles || tiles.length < 2) {
    setMessage("Grouping requires at least two tiles on that side.", "warn");
    return;
  }

  const grouped = makeCompositeGroupFromSide(side, tiles);

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? [grouped] : currentModel.sides.left,
      right: side === "right" ? [grouped] : currentModel.sides.right
    },
    lastTransformation: "Add Parentheses"
  });

  history.push(`Grouped the ${side} side into one parenthetical composite tile.`);
  setMessage(`Added parentheses around the ${side} side.`, "good");
  renderModel(currentModel);
}

function toggleHiddenOnes() {
  showHiddenOnes = !showHiddenOnes;
  setMessage(showHiddenOnes ? "Showing hidden /1 denominators." : "Hiding hidden /1 denominators.", "good");
  if (currentModel) renderModel(currentModel);
}


function clearSelection() {
  selectedTileIds.clear();
}

function findTileLocation(tileId, model = currentModel) {
  if (!model) return null;

  for (const side of ["left", "right"]) {
    const tiles = model.sides[side] || [];
    const index = tiles.findIndex(tile => tile.id === tileId);
    if (index !== -1) {
      return { side, index, tile: tiles[index] };
    }
  }

  return null;
}

function tileCanDragOutsideFactor(tile) {
  if (!tile || !currentModel) return false;
  return getIsolatedMovableFactorTiles(currentModel).some(candidate => candidate.id === tile.id);
}

function outsideFactorLabelForTile(tile) {
  if (!tile) return "";
  const sign = tile.additiveCharge === "-" ? "-" : "";
  return `${sign}${tile.additiveCount}`;
}

function makeWholeTileGhost(tileEl) {
  const ghost = tileEl.cloneNode(true);
  ghost.classList.remove("selected", "dragging-source", "drag-preview-additive", "drag-preview-denominator");
  ghost.classList.add("drag-ghost", "whole-tile-ghost");
  const handle = ghost.querySelector(".factor-handle");
  if (handle) handle.remove();
  return ghost;
}

function makeFactorGhost(tile) {
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost factor-ghost";

  if (dragState.dragKind === "literalFactor" && tile.kind === "literalProduct" && tile.factors) {
    const factor = tile.factors[dragState.literalFactorIndex || 0];
    ghost.innerHTML = `<strong>${factor.display || factor.raw}</strong><span>to denominator</span>`;
    return ghost;
  }

  ghost.innerHTML = `<strong>${outsideFactorLabelForTile(tile)}</strong><span>to denominator</span>`;
  return ghost;
}

function beginPendingTileDrag(event, tile, dragKind = "tile") {
  if (!currentModel || !currentModel.boundary) return;
  if (event.button !== undefined && event.button !== 0) return;

  const location = findTileLocation(tile.id);
  if (!location) return;

  dragState = {
    active: false,
    pending: true,
    tileId: tile.id,
    side: location.side,
    dragKind,
    tileEl: event.currentTarget.closest(".tile") || event.currentTarget,
    startX: event.clientX,
    startY: event.clientY,
    ghost: null,
    lastZone: null,
    originalCharge: tile.additiveCharge
  };

  window.addEventListener("pointermove", moveTileDrag);
  window.addEventListener("pointerup", endTileDrag);
  window.addEventListener("pointercancel", endTileDrag);
}

function activateDrag(event) {
  if (!dragState.pending || dragState.active) return;

  const location = findTileLocation(dragState.tileId);
  if (!location) return;

  dragState.active = true;
  suppressNextTileClick = true;

  if (dragState.dragKind === "factor") {
    dragState.ghost = makeFactorGhost(location.tile);
  } else {
    dragState.ghost = makeWholeTileGhost(dragState.tileEl);
  }

  dragState.ghost.style.position = "fixed";
  dragState.ghost.style.pointerEvents = "none";
  dragState.ghost.style.zIndex = "9999";
  dragState.ghost.style.left = "-9999px";
  dragState.ghost.style.top = "-9999px";
  document.body.appendChild(dragState.ghost);

  if (dragState.tileEl) dragState.tileEl.classList.add("dragging-source");
  document.body.classList.add("dragging-tile");

  moveDragGhost(event.clientX, event.clientY);
  updateDragZone(event.clientX, event.clientY);
}

function moveTileDrag(event) {
  if (!dragState.pending) return;

  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;
  const distance = Math.hypot(dx, dy);

  if (!dragState.active && distance > 7) {
    activateDrag(event);
  }

  if (!dragState.active) return;

  event.preventDefault();
  moveDragGhost(event.clientX, event.clientY);
  updateDragZone(event.clientX, event.clientY);
}

function moveDragGhost(x, y) {
  if (!dragState.ghost) return;
  dragState.ghost.style.left = `${x + 12}px`;
  dragState.ghost.style.top = `${y + 12}px`;
}

function cleanupDragListeners() {
  window.removeEventListener("pointermove", moveTileDrag);
  window.removeEventListener("pointerup", endTileDrag);
  window.removeEventListener("pointercancel", endTileDrag);
}

function cleanupDragGhost() {
  if (dragState.ghost && dragState.ghost.parentNode) {
    dragState.ghost.parentNode.removeChild(dragState.ghost);
  }
  dragState.ghost = null;
}

function clearDropZoneHighlights() {
  document.querySelectorAll(".side.drop-additive, .denominator-drop-zone.active, .tile.drop-combine-target").forEach(el => {
    el.classList.remove("drop-additive", "active", "drop-combine-target");
  });
}

function setTileDragPreview(tileId, mode) {
  document.querySelectorAll(".tile.drag-preview-additive, .tile.drag-preview-denominator, .tile.drag-preview-combine").forEach(el => {
    el.classList.remove("drag-preview-additive", "drag-preview-denominator", "drag-preview-combine");
  });

  const tileEl = Array.from(document.querySelectorAll(".tile")).find(el => el.dataset.tileId === tileId);
  if (!tileEl) return;

  if (mode === "additive") tileEl.classList.add("drag-preview-additive");
  if (mode === "denominator") tileEl.classList.add("drag-preview-denominator");
  if (mode === "combine") tileEl.classList.add("drag-preview-combine");
}

function clearTileDragPreview() {
  document.querySelectorAll(".tile.drag-preview-additive, .tile.drag-preview-denominator, .tile.drag-preview-combine").forEach(el => {
    el.classList.remove("drag-preview-additive", "drag-preview-denominator", "drag-preview-combine");
  });
}

function setGhostChargePreview(mode) {
  if (!dragState.ghost || dragState.dragKind !== "tile") return;

  const charge = dragState.ghost.querySelector(".charge");
  if (!charge) return;

  if (mode === "additive") {
    charge.textContent = dragState.originalCharge === "-" ? "+" : "-";
    dragState.ghost.classList.add("ghost-charge-flipped");
  } else {
    charge.textContent = dragState.originalCharge || charge.textContent;
    dragState.ghost.classList.remove("ghost-charge-flipped");
  }
}

function getSideFromTitle(title) {
  if (title === "Left Side") return "left";
  if (title === "Right Side") return "right";
  return "left";
}

function getDragZoneFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  const denominatorZone = el.closest(".denominator-drop-zone");
  if (denominatorZone) {
    return {
      mode: "denominator",
      side: denominatorZone.dataset.side
    };
  }

  const tileEl = el.closest(".tile");
  if (tileEl && tileEl.dataset.tileId) {
    const location = findTileLocation(tileEl.dataset.tileId);
    if (location) {
      return {
        mode: "combine",
        side: location.side,
        tileId: tileEl.dataset.tileId
      };
    }
  }

  const sideEl = el.closest(".side");
  if (sideEl) {
    return {
      mode: "additive",
      side: sideEl.dataset.side
    };
  }

  return null;
}

function updateDragZone(x, y) {
  clearDropZoneHighlights();

  const zone = getDragZoneFromPoint(x, y);
  dragState.lastZone = zone;

  if (!zone || !dragState.tileId || !dragState.side) {
    clearTileDragPreview();
    setGhostChargePreview(null);
    return;
  }

  if (zone.mode === "combine" && dragState.dragKind === "tile") {
    const sourceLocation = findTileLocation(dragState.tileId);
    const targetLocation = findTileLocation(zone.tileId);

    if (
      sourceLocation &&
      targetLocation &&
      canDragCombineTiles(sourceLocation.tile, targetLocation.tile)
    ) {
      const targetEl = Array.from(document.querySelectorAll(".tile")).find(el => el.dataset.tileId === zone.tileId);
      if (targetEl) targetEl.classList.add("drop-combine-target");
      setTileDragPreview(dragState.tileId, "combine");
      setGhostChargePreview(null);
      return;
    }
  }

  if (zone.side === dragState.side) {
    clearTileDragPreview();
    setGhostChargePreview(null);
    return;
  }

  if (zone.mode === "denominator") {
    const location = findTileLocation(dragState.tileId);
    const canDropFactor =
      location &&
      (
        tileCanDragOutsideFactor(location.tile) ||
        (dragState.dragKind === "literalFactor" && location.tile.kind === "literalProduct")
      );

    if (canDropFactor) {
      const zoneEl = document.querySelector(`.denominator-drop-zone[data-side="${zone.side}"]`);
      if (zoneEl) zoneEl.classList.add("active");
      setTileDragPreview(dragState.tileId, "denominator");
      setGhostChargePreview(null);
      return;
    }
  }

  if (zone.mode === "additive" && dragState.dragKind === "tile") {
    const sideEl = Array.from(document.querySelectorAll(".side")).find(el => el.dataset.side === zone.side);
    if (sideEl) sideEl.classList.add("drop-additive");
    setTileDragPreview(dragState.tileId, "additive");
    setGhostChargePreview("additive");
    return;
  }

  clearTileDragPreview();
  setGhostChargePreview(null);
}

function resetDragState() {
  dragState = {
    active: false,
    pending: false,
    tileId: null,
    side: null,
    dragKind: null,
    tileEl: null,
    startX: 0,
    startY: 0,
    ghost: null,
    lastZone: null,
    originalCharge: null,
    literalFactorIndex: null
  };
}

function safeMoveAdditiveByDrag(tileId) {
  if (!currentModel || !currentModel.boundary) {
    setMessage("Additive crossing needs an equation or inequality boundary.", "warn");
    return false;
  }

  const location = findTileLocation(tileId);
  if (!location) {
    setMessage("Could not find that tile.", "warn");
    return false;
  }

  moveAdditiveTileAcross(tileId);
  return true;
}

function safeMoveOutsideFactorByDrag(tileId) {
  if (!currentModel || !currentModel.boundary) {
    setMessage("Multiplicative movement needs an equation or inequality boundary.", "warn");
    return false;
  }

  const location = findTileLocation(tileId);
  if (!location || !tileCanDragOutsideFactor(location.tile)) {
    setMessage("That outside factor is not ready to move. It may need to be isolated first.", "warn");
    return false;
  }

  moveMultiplicativeFactorAcross(tileId);
  return true;
}


function canDragCombineTiles(sourceTile, targetTile) {
  if (!sourceTile || !targetTile) return false;
  if (sourceTile.id === targetTile.id) return false;
  if (sourceTile.side !== targetTile.side) return false;

  const sourceRational = rationalFromConstantLikeTile(sourceTile);
  const targetRational = rationalFromConstantLikeTile(targetTile);

  if (sourceRational && targetRational) return true;

  return sourceTile.kind === "variable" &&
    targetTile.kind === "variable" &&
    sourceTile.likeSignature &&
    sourceTile.likeSignature === targetTile.likeSignature;
}

function combineTwoTilesByDrag(sourceTileId, targetTileId) {
  if (!currentModel) return false;

  const source = findTileLocation(sourceTileId);
  const target = findTileLocation(targetTileId);

  if (!source || !target || source.side !== target.side || source.index === target.index) {
    setMessage("Those tiles cannot combine.", "warn");
    return false;
  }

  if (!canDragCombineTiles(source.tile, target.tile)) {
    setMessage("Only matching like terms can snap together.", "warn");
    return false;
  }

  const side = source.side;
  const remaining = currentModel.sides[side].filter(tile =>
    tile.id !== sourceTileId && tile.id !== targetTileId
  );

  let combinedTile = null;

  const sourceRational = rationalFromConstantLikeTile(source.tile);
  const targetRational = rationalFromConstantLikeTile(target.tile);

  if (sourceRational && targetRational) {
    const sum = addRationals(sourceRational, targetRational);
    const normalized = normalizeRational(sum.numerator, sum.denominator);

    if (normalized.numerator !== 0 || remaining.length === 0) {
      combinedTile = makeRationalConstantTile({
        side,
        index: remaining.length,
        numerator: normalized.numerator,
        denominator: normalized.denominator
      });
    }
  } else {
    const total = signedAdditiveCount(source.tile) + signedAdditiveCount(target.tile);

    if (total !== 0 || remaining.length === 0) {
      const sample = source.tile;
      combinedTile = makeVariableTile({
        side,
        index: remaining.length,
        identity: sample.identity,
        multiplicativeCompletion: sample.multiplicativeCompletion,
        multiplicativePosition: sample.multiplicativePosition,
        signedAdditiveCount: total
      });
    }
  }

  if (combinedTile) remaining.push(combinedTile);
  if (remaining.length === 0) {
    remaining.push(makeConstantTile({ side, index: 0, signedAdditiveCount: 0 }));
  }

  const nextSides = {
    left: [...currentModel.sides.left],
    right: currentModel.boundary ? [...currentModel.sides.right] : []
  };

  nextSides[side] = remaining;

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: nextSides,
    lastTransformation: "Drag Combine Like Terms"
  });

  clearSelection();
  history.push(`Dragged ${tileReadableLabel(source.tile)} onto ${tileReadableLabel(target.tile)} and combined like terms.`);
  setMessage("Like terms snapped together and combined.", "good");
  renderModel(currentModel);
  return true;
}

function endTileDrag(event) {
  if (!dragState.pending) return;

  cleanupDragListeners();

  if (!dragState.active) {
    resetDragState();
    return;
  }

  if (event && event.preventDefault) event.preventDefault();

  const tileId = dragState.tileId;
  const startSide = dragState.side;
  const dragKind = dragState.dragKind;
  const literalFactorIndex = dragState.literalFactorIndex || 0;
  const zone = dragState.lastZone || getDragZoneFromPoint(event.clientX, event.clientY);

  document.querySelectorAll(".tile.dragging-source").forEach(el => el.classList.remove("dragging-source"));
  document.body.classList.remove("dragging-tile");
  cleanupDragGhost();
  clearTileDragPreview();
  clearDropZoneHighlights();

  resetDragState();

  if (!zone) {
    setMessage("Tile snapped back. Drag onto a matching like term or across the boundary to transform it.", "warn");
    return;
  }

  if (zone.mode === "combine" && dragKind === "tile") {
    combineTwoTilesByDrag(tileId, zone.tileId);
    return;
  }

  if (zone.side === startSide) {
    setMessage("Tile snapped back. Drag onto a matching like term or across the boundary to transform it.", "warn");
    return;
  }

  if (zone.mode === "denominator") {
    if (dragKind === "literalFactor") {
      moveLiteralFactorAcross(tileId, literalFactorIndex);
      return;
    }

    safeMoveOutsideFactorByDrag(tileId);
    return;
  }

  if (zone.mode === "additive" && dragKind === "tile") {
    safeMoveAdditiveByDrag(tileId);
    return;
  }

  setMessage("That drag path is not a legal transformation yet.", "warn");
}


function getAllModelTiles(model = currentModel) {
  if (!model) return [];
  return [...model.sides.left, ...model.sides.right];
}

function findTileById(tileId, model = currentModel) {
  return getAllModelTiles(model).find(tile => tile.id === tileId) || null;
}

function toggleTileSelection(tileId) {
  if (!currentModel || !findTileById(tileId, currentModel)) return;

  if (selectedTileIds.has(tileId)) {
    selectedTileIds.delete(tileId);
  } else {
    selectedTileIds.add(tileId);
  }

  renderModel(currentModel);
}

function getSelectedTilesOrdered(model = currentModel) {
  if (!model) return [];

  const result = [];

  for (const side of ["left", "right"]) {
    model.sides[side].forEach((tile, index) => {
      if (selectedTileIds.has(tile.id)) {
        result.push({ tile, side, index });
      }
    });
  }

  return result;
}

function selectedTilesAreSameSide(selected) {
  if (!selected.length) return false;
  return selected.every(item => item.side === selected[0].side);
}

function selectedIndexes(selected) {
  return selected.map(item => item.index).sort((a, b) => a - b);
}

function indexesAreConsecutive(indexes) {
  if (!indexes.length) return false;
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] !== indexes[i - 1] + 1) return false;
  }
  return true;
}

function renderSelectionNote(container) {
  const selected = getSelectedTilesOrdered();

  const note = document.createElement("p");
  note.className = "note";

  if (!selected.length) {
    note.textContent = "Click tiles to highlight them. Factoring buttons appear when highlighted tiles contain revealable structure.";
  } else {
    const selectedText = selected.map(item => tileCoreDisplay(item.tile, true)).join(", ");
    note.textContent = `Highlighted: ${selectedText}`;

    if (selected.length === 3 && selectedTilesAreSameSide(selected)) {
      const candidate = getSelectedTrinomialFactorCandidate();
      if (!candidate) {
        note.textContent += " — these three highlighted tiles are not currently recognized as a monic integer-factorable trinomial.";
      }
    }
  }

  container.appendChild(note);

  if (selected.length) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "move-action secondary-action";
    clearBtn.textContent = "Clear highlighted tiles";
    clearBtn.addEventListener("click", () => {
      clearSelection();
      renderModel(currentModel);
    });
    container.appendChild(clearBtn);
  }
}

function renderFraction(tile, label) {
  const wrap = document.createElement("div");
  wrap.className = "fraction-display";

  const top = document.createElement("div");
  top.className = "frac-part";

  const bar = document.createElement("div");
  bar.className = "frac-bar";

  const bottom = document.createElement("div");
  bottom.className = "frac-part";

  if (tile.factorReveal && !tile.factorReveal.cancelled) {
    const reveal = tile.factorReveal;
    top.textContent = `${reveal.remainingNumerator}·${reveal.commonFactor}`;
    bottom.textContent = `${reveal.remainingDenominator}·${reveal.commonFactor}`;
  } else {
    top.textContent = tile.numerator.display || "1";
    bottom.textContent = tile.denominator.display || "1";
  }

  wrap.appendChild(top);
  wrap.appendChild(bar);
  wrap.appendChild(bottom);
  label.appendChild(wrap);
}

function renderTile(tile) {
  const div = document.createElement("div");
  div.className = `tile ${tile.kind} ${tile.additiveCharge === "-" ? "negative" : "positive"} ${selectedTileIds.has(tile.id) ? "selected" : ""}`;
  div.dataset.tileId = tile.id;
  div.title = "Click to highlight/select. Drag across the boundary to transform.";
  div.addEventListener("click", event => {
    event.stopPropagation();
    if (suppressNextTileClick) {
      suppressNextTileClick = false;
      return;
    }
    toggleTileSelection(tile.id);
  });
  div.addEventListener("pointerdown", event => {
    if (event.target.closest(".factor-handle")) return;
    beginPendingTileDrag(event, tile, "tile");
  });

  const charge = document.createElement("div");
  charge.className = "charge";
  charge.textContent = tile.additiveCharge;

  const label = document.createElement("div");
  label.className = "tile-label";

  if (tile.kind === "fraction") {
    if (denominatorIsOne(tile) && !showHiddenOnes) {
      label.textContent = `${tile.additiveCharge === "-" ? "-" : "+"}${tile.numerator.display || "1"}`;
    } else {
      renderFraction(tile, label);
    }
  } else if (showHiddenOnes) {
    renderAsOverOne(tile, label);
  } else {
    label.textContent = tileLabel(tile);
  }

  const meta = document.createElement("div");
  meta.className = "tile-meta";

  if (tile.kind === "fraction") {
    meta.innerHTML = [
      `kind: fraction`,
      `add count: ${tile.additiveCount}`,
      `completion: ${completionLabel(tile.multiplicativeCompletion)}`,
      `num pos: numerator`,
      `den pos: denominator`,
      denominatorIsOne(tile) && !showHiddenOnes ? `hidden: /1` : null,
      tile.factorReveal && !tile.factorReveal.cancelled ? `factors revealed: yes` : null,
      tile.cancellationHistory ? `cancelled: yes` : null
    ].filter(Boolean).join("<br>");
  } else {
    meta.innerHTML = [
      `kind: ${tile.kind}`,
      `identity: ${tile.identity}`,
      `add count: ${tile.additiveCount}`,
      `completion: ${completionLabel(tile.multiplicativeCompletion)}`,
      `position: ${tile.multiplicativePosition}`,
      tile.kind === "composite" && tile.childrenRaw ? `inside: ${tile.childrenRaw}` : null,
      tile.kind === "product" && tile.factors ? `factors: ${tile.factors.map(f => "(" + f.raw + ")").join("")}` : null,
      tile.kind === "factoredNumber" && tile.factorParts ? `number factors: ${tile.factorParts.join("·")}` : null,
      tile.kind === "squaredBinomial" && tile.baseFactor ? `base: (${tile.baseFactor.display})` : null,
      tile.kind === "squaredBinomial" ? `power: 2` : null,
      tile.kind === "powerShell" && tile.power ? `applied power: ${powerDisplay(tile.power)}` : null,
      tile.kind === "powerShell" && tile.baseRaw ? `base: ${tile.baseRaw}` : null,
      tile.kind === "powerProduct" && tile.baseFactor ? `base: (${tile.baseFactor.display || tile.baseFactor.raw})` : null,
      tile.kind === "powerProduct" && tile.innerPower && tile.outerPower ? `power product: ${powerDisplay(tile.innerPower)}·${powerDisplay(tile.outerPower)}` : null,
      tile.kind === "plusMinus" && tile.magnitudeDisplay ? `plus/minus magnitude: ${tile.magnitudeDisplay}` : null,
      tile.kind === "imaginaryRoot" && tile.magnitudeDisplay ? `imaginary magnitude: i·${tile.magnitudeDisplay}` : null
    ].filter(Boolean).join("<br>");
  }

  div.appendChild(charge);
  div.appendChild(label);
  div.appendChild(meta);

  if (tileCanDragOutsideFactor(tile)) {
    const factorHandle = document.createElement("button");
    factorHandle.type = "button";
    factorHandle.className = "factor-handle";
    factorHandle.innerHTML = `<span>grab</span><strong>${outsideFactorLabelForTile(tile)}</strong>`;
    factorHandle.title = "Drag this outside factor to the opposite denominator zone.";
    factorHandle.addEventListener("click", event => {
      event.stopPropagation();
    });
    factorHandle.addEventListener("pointerdown", event => {
      event.stopPropagation();
      beginPendingTileDrag(event, tile, "factor");
    });
    div.appendChild(factorHandle);
  }

  if (tile.kind === "literalProduct" && tile.factors && tile.factors.length > 1 && literalMode) {
    const literalHandleRow = document.createElement("div");
    literalHandleRow.className = "literal-factor-handles";

    tile.factors.forEach((factor, factorIndex) => {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "literal-factor-handle";
      handle.textContent = factor.display || factor.raw;
      handle.title = "Drag this symbolic factor to the opposite denominator zone.";
      handle.addEventListener("click", event => {
        event.stopPropagation();
      });
      handle.addEventListener("pointerdown", event => {
        event.stopPropagation();
        beginPendingTileDrag(event, tile, "literalFactor");
        dragState.literalFactorIndex = factorIndex;
      });
      literalHandleRow.appendChild(handle);
    });

    div.appendChild(literalHandleRow);
  }

  return div;
}

function renderSide(title, tiles) {
  const sideName = getSideFromTitle(title);
  const sideDiv = document.createElement("div");
  sideDiv.className = "side";
  sideDiv.dataset.side = sideName;

  const sideTitle = document.createElement("div");
  sideTitle.className = "side-title";
  sideTitle.textContent = title;

  const tilesDiv = document.createElement("div");
  tilesDiv.className = "tiles";

  if (!tiles.length) {
    const empty = document.createElement("span");
    empty.className = "tile-meta";
    empty.textContent = "No tiles";
    tilesDiv.appendChild(empty);
  } else {
    tiles.forEach(tile => tilesDiv.appendChild(renderTile(tile)));
  }

  sideDiv.appendChild(sideTitle);
  sideDiv.appendChild(tilesDiv);

  if (currentModel && currentModel.boundary) {
    const denominatorZone = document.createElement("div");
    denominatorZone.className = "denominator-drop-zone";
    denominatorZone.dataset.side = sideName;
    denominatorZone.innerHTML = "<span>drop outside factor here for denominator</span>";
    sideDiv.appendChild(denominatorZone);
  }

  return sideDiv;
}

function renderBoundary(boundary) {
  const div = document.createElement("div");
  div.className = "boundary";
  div.textContent = boundary || "";
  return div;
}


function isIsolatedAbsoluteValueTile(tile, model) {
  if (!tile || tile.kind !== "absolute") return false;
  if (!model || model.boundary !== "=") return false;
  if (tile.additiveCharge !== "+" || tile.additiveCount !== 1) return false;

  const sideTiles = model.sides[tile.side];
  return sideTiles.length === 1 && sideTiles[0].id === tile.id;
}

function getIsolatedAbsoluteValueCandidates(model) {
  if (!model || model.boundary !== "=") return [];

  const allTiles = [...model.sides.left, ...model.sides.right];

  return allTiles.filter(tile => {
    if (!isIsolatedAbsoluteValueTile(tile, model)) return false;
    const targetSide = oppositeSide(tile.side);
    return model.sides[targetSide] && model.sides[targetSide].length > 0;
  });
}

function cloneTilesForSide(tiles, side, label) {
  return tiles.map((tile, index) => withComputedFlags({
    ...structuredClone(tile),
    id: `${side}-${label}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    side,
    parentId: null
  }));
}

function negateTilesForBranch(tiles, side, label) {
  if (tiles.length === 1) {
    const tile = structuredClone(tiles[0]);
    return [withComputedFlags({
      ...tile,
      id: `${side}-${label}-neg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      side,
      additiveCharge: flipCharge(tile.additiveCharge),
      parentId: null,
      notes: [
        ...(tile.notes || []),
        "Negated for the negative absolute-value branch."
      ]
    })];
  }

  const inside = sideExpressionDisplay(tiles);

  return [withComputedFlags({
    id: `${side}-${label}-neg-group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `-(${inside})`,
    display: `-(${inside})`,
    kind: "composite",
    identity: `(${inside})`,
    additiveCharge: "-",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: structuredClone(tiles),
    childrenRaw: inside,
    structureType: "group",
    notes: [
      "Grouped and negated for the negative absolute-value branch."
    ]
  })];
}

function targetSideIsKnownNegativeConstant(tiles) {
  if (!tiles || tiles.length !== 1) return false;
  const rational = rationalFromConstantLikeTile(tiles[0]);
  return rational && rational.numerator < 0;
}

function makeAbsoluteValueBranchModels(absTile) {
  const sourceSide = absTile.side;
  const targetSide = oppositeSide(sourceSide);
  const targetTiles = currentModel.sides[targetSide];

  if (targetSideIsKnownNegativeConstant(targetTiles)) {
    return [{
      title: "No Real Solution",
      note: "The absolute-value tile is isolated, but the other side is negative. Absolute value cannot equal a negative number.",
      model: null
    }];
  }

  const innerPositive = parseSide(absTile.childrenRaw, sourceSide);
  const innerNegative = parseSide(absTile.childrenRaw, sourceSide);

  const positiveTarget = cloneTilesForSide(targetTiles, targetSide, "abs-positive-target");
  const negativeTarget = negateTilesForBranch(targetTiles, targetSide, "abs-negative-target");

  const positiveSides = {
    left: sourceSide === "left" ? cloneTilesForSide(innerPositive, "left", "abs-positive-inner") : positiveTarget,
    right: sourceSide === "right" ? cloneTilesForSide(innerPositive, "right", "abs-positive-inner") : positiveTarget
  };

  const negativeSides = {
    left: sourceSide === "left" ? cloneTilesForSide(innerNegative, "left", "abs-negative-inner") : negativeTarget,
    right: sourceSide === "right" ? cloneTilesForSide(innerNegative, "right", "abs-negative-inner") : negativeTarget
  };

  return [
    {
      title: "Positive Branch",
      note: "The inside structure equals the original other side.",
      model: cleanupModelZeros({
        raw: `${absTile.childrenRaw} = ${sideExpressionDisplay(targetTiles)}`,
        normalized: "",
        type: "relation",
        boundary: "=",
        sides: positiveSides,
        lastTransformation: "Absolute Value Split: Positive Branch"
      })
    },
    {
      title: "Negative Branch",
      note: "The inside structure equals the opposite of the original other side.",
      model: cleanupModelZeros({
        raw: `${absTile.childrenRaw} = -(${sideExpressionDisplay(targetTiles)})`,
        normalized: "",
        type: "relation",
        boundary: "=",
        sides: negativeSides,
        lastTransformation: "Absolute Value Split: Negative Branch"
      })
    }
  ];
}

function splitAbsoluteValue(absTileId) {
  if (!currentModel) return;

  const candidate = getIsolatedAbsoluteValueCandidates(currentModel)
    .find(tile => tile.id === absTileId);

  if (!candidate) {
    setMessage("Absolute value split is locked until one absolute-value tile is isolated by itself on one side of an equation.", "warn");
    return;
  }

  currentBranches = makeAbsoluteValueBranchModels(candidate);
  history.push(`Split isolated absolute-value tile |${candidate.childrenRaw}| into branch results.`);
  setMessage("Absolute value split created branch results. Choose a branch to keep solving.", "good");
  renderModel(currentModel);
}

function loadBranch(index) {
  const branch = currentBranches[index];
  if (!branch || !branch.model) {
    setMessage("That branch does not contain a solvable equation.", "warn");
    return;
  }

  currentModel = cleanupModelZeros(structuredClone(branch.model));
  currentBranches = [];
  history.push(`Loaded ${branch.title} from the branch results.`);
  setMessage(`${branch.title} loaded. Continue solving this branch.`, "good");
  renderModel(currentModel);
}

function renderBranches() {
  branchView.innerHTML = "";

  if (!currentBranches.length) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "No branch results yet.";
    branchView.appendChild(note);
    return;
  }

  currentBranches.forEach((branch, index) => {
    const card = document.createElement("div");
    card.className = "branch-card";

    const title = document.createElement("h3");
    title.textContent = branch.title;
    card.appendChild(title);

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = branch.note;
    card.appendChild(note);

    if (branch.model) {
      const view = document.createElement("div");
      view.className = "tile-view branch-tile-view";
      view.appendChild(renderSide("Left Side", branch.model.sides.left));
      view.appendChild(renderBoundary(branch.model.boundary));
      view.appendChild(renderSide("Right Side", branch.model.sides.right));
      card.appendChild(view);

      const loadBtn = document.createElement("button");
      loadBtn.className = "move-action";
      loadBtn.textContent = `Load ${branch.title}`;
      loadBtn.addEventListener("click", () => loadBranch(index));
      card.appendChild(loadBtn);
    }

    branchView.appendChild(card);
  });
}

function renderAbsoluteButtons(model) {
  absoluteButtons.innerHTML = "";

  const candidates = getIsolatedAbsoluteValueCandidates(model);

  if (!candidates.length) return;

  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "Absolute value split is available because the absolute-value tile is isolated.";
  absoluteButtons.appendChild(note);

  candidates.forEach(tile => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Split absolute value <strong>|${tile.childrenRaw}|</strong> into two branches`;
    btn.addEventListener("click", () => splitAbsoluteValue(tile.id));
    absoluteButtons.appendChild(btn);
  });
}


function rationalIsInteger(rational) {
  return rational && rational.denominator === 1 && Number.isInteger(rational.numerator);
}

function sideIsZero(tiles) {
  if (!tiles || tiles.length !== 1) return false;
  const rational = rationalFromConstantLikeTile(tiles[0]);
  return rational && rational.numerator === 0;
}

function variableCompletionIs(tile, numerator, denominator = 1) {
  return tile &&
    tile.kind === "variable" &&
    tile.multiplicativeCompletion &&
    tile.multiplicativeCompletion.numerator === numerator &&
    tile.multiplicativeCompletion.denominator === denominator &&
    tile.multiplicativePosition === "numerator";
}

function getQuadraticInfoForSide(tiles) {
  let variable = null;
  let a = 0;
  let b = 0;
  let c = 0;

  for (const tile of tiles) {
    if (isZeroTile(tile)) continue;

    if (tile.kind === "variable") {
      if (!variable) variable = tile.identity;
      if (tile.identity !== variable) return null;

      if (variableCompletionIs(tile, 2, 1)) {
        a += signedAdditiveCount(tile);
        continue;
      }

      if (variableCompletionIs(tile, 1, 1)) {
        b += signedAdditiveCount(tile);
        continue;
      }

      return null;
    }

    const rational = rationalFromConstantLikeTile(tile);
    if (rational && rationalIsInteger(rational)) {
      c += rational.numerator;
      continue;
    }

    return null;
  }

  if (!variable || a === 0) return null;

  return { variable, a, b, c };
}

function findMonicIntegerFactorPair(b, c) {
  const limit = Math.max(20, Math.abs(b) + Math.abs(c) + 10);

  for (let m = -limit; m <= limit; m++) {
    for (let n = -limit; n <= limit; n++) {
      if (m + n === b && m * n === c) {
        return { p: m, q: n };
      }
    }
  }

  return null;
}

function binomialRaw(variable, constant) {
  if (constant === 0) return variable;
  return `${variable}${constant < 0 ? "" : "+"}${constant}`;
}

function binomialDisplay(variable, constant) {
  if (constant === 0) return variable;
  return `${variable} ${constant < 0 ? "- " + Math.abs(constant) : "+ " + constant}`;
}

function makeQuadraticProductTile({ side, variable, p, q }) {
  const leftRaw = binomialRaw(variable, p);
  const rightRaw = binomialRaw(variable, q);
  const leftDisplay = binomialDisplay(variable, p);
  const rightDisplay = binomialDisplay(variable, q);

  return withComputedFlags({
    id: `${side}-quadratic-product-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `(${leftRaw})(${rightRaw})`,
    display: `(${leftDisplay})(${rightDisplay})`,
    kind: "product",
    identity: "quadratic-product",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    structureType: "quadraticProduct",
    factors: [
      { raw: leftRaw, display: leftDisplay, variable, constant: p },
      { raw: rightRaw, display: rightDisplay, variable, constant: q }
    ],
    childrenRaw: `(${leftRaw})(${rightRaw})`,
    notes: [
      `Quadratic factor structure revealed from x^2 + ${p + q}x + ${p * q}.`,
      `${p} and ${q} add to ${p + q} and multiply to ${p * q}.`
    ]
  });
}


function makeQuadraticSplitMiddleTiles({ side, variable, p, q }) {
  return [
    makeVariableTile({
      side,
      index: 0,
      identity: variable,
      multiplicativeCompletion: { numerator: 2, denominator: 1 },
      multiplicativePosition: "numerator",
      signedAdditiveCount: 1
    }),
    makeVariableTile({
      side,
      index: 1,
      identity: variable,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      signedAdditiveCount: p
    }),
    makeVariableTile({
      side,
      index: 2,
      identity: variable,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      signedAdditiveCount: q
    }),
    makeConstantTile({
      side,
      index: 3,
      signedAdditiveCount: p * q
    })
  ];
}

function getSplitMiddleInfoForSide(tiles) {
  if (!tiles || tiles.length !== 4) return null;

  const nonZero = tiles.filter(t => !isZeroTile(t));
  if (nonZero.length !== 4) return null;

  const [t0, t1, t2, t3] = nonZero;

  if (!variableCompletionIs(t0, 2, 1)) return null;
  if (!variableCompletionIs(t1, 1, 1)) return null;
  if (!variableCompletionIs(t2, 1, 1)) return null;
  if (t1.identity !== t0.identity || t2.identity !== t0.identity) return null;

  const c = rationalFromConstantLikeTile(t3);
  if (!c || !rationalIsInteger(c)) return null;

  const p = signedAdditiveCount(t1);
  const q = signedAdditiveCount(t2);

  if (p * q !== c.numerator) return null;

  return {
    variable: t0.identity,
    p,
    q,
    constant: c.numerator
  };
}

function makeGroupedQuadraticPairTile({ side, variable, outsideFactor, insideConstant }) {
  const raw = outsideFactor === 1
    ? `${variable}(${binomialRaw(variable, insideConstant)})`
    : `${outsideFactor}(${binomialRaw(variable, insideConstant)})`;

  const display = outsideFactor === 1
    ? `${variable}(${binomialDisplay(variable, insideConstant)})`
    : `${outsideFactor}(${binomialDisplay(variable, insideConstant)})`;

  return withComputedFlags({
    id: `${side}-factored-group-${Date.now()}-${outsideFactor}-${insideConstant}-${Math.random().toString(16).slice(2)}`,
    raw,
    display,
    kind: "factoredGroup",
    identity: "factored-group",
    additiveCharge: outsideFactor < 0 ? "-" : "+",
    additiveCount: Math.abs(outsideFactor),
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    structureType: "factoredGroup",
    outsideFactor,
    binomial: {
      variable,
      constant: insideConstant,
      raw: binomialRaw(variable, insideConstant),
      display: binomialDisplay(variable, insideConstant)
    },
    childrenRaw: raw,
    notes: [
      "Created by factoring a grouped quadratic pair."
    ]
  });
}

function makeRawGroupTile({ side, rawInside, displayInside, groupRole, p, q, variable }) {
  return withComputedFlags({
    id: `${side}-quadratic-raw-group-${Date.now()}-${groupRole}-${Math.random().toString(16).slice(2)}`,
    raw: `(${rawInside})`,
    display: `(${displayInside})`,
    kind: "composite",
    identity: `(${rawInside})`,
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    childrenRaw: rawInside,
    structureType: "quadraticGroup",
    groupRole,
    p,
    q,
    variable,
    notes: [
      "Created by grouping a split-middle quadratic."
    ]
  });
}

function makeGroupedSplitMiddleTiles({ side, variable, p, q }) {
  const firstRaw = `${variable}^2${p < 0 ? "" : "+"}${p}${variable}`;
  const firstDisplay = `${variable}² ${p < 0 ? "- " + Math.abs(p) : "+ " + p}${variable}`;
  const secondRaw = `${q}${variable}${p*q < 0 ? "" : "+"}${p*q}`;
  const secondDisplay = `${q}${variable} ${p*q < 0 ? "- " + Math.abs(p*q) : "+ " + p*q}`;

  return [
    makeRawGroupTile({
      side,
      rawInside: firstRaw,
      displayInside: firstDisplay,
      groupRole: "first",
      p,
      q,
      variable
    }),
    makeRawGroupTile({
      side,
      rawInside: secondRaw,
      displayInside: secondDisplay,
      groupRole: "second",
      p,
      q,
      variable
    })
  ];
}

function getGroupedQuadraticInfoForSide(tiles) {
  if (!tiles || tiles.length !== 2) return null;

  const [g1, g2] = tiles;
  if (g1.kind !== "composite" || g2.kind !== "composite") return null;
  if (g1.structureType !== "quadraticGroup" || g2.structureType !== "quadraticGroup") return null;
  if (g1.groupRole !== "first" || g2.groupRole !== "second") return null;
  if (g1.variable !== g2.variable || g1.p !== g2.p || g1.q !== g2.q) return null;

  return {
    variable: g1.variable,
    p: g1.p,
    q: g1.q
  };
}

function getFactoredGroupInfoForSide(tiles) {
  if (!tiles || tiles.length !== 2) return null;

  const [f1, f2] = tiles;
  if (f1.kind !== "factoredGroup" || f2.kind !== "factoredGroup") return null;
  if (!f1.binomial || !f2.binomial) return null;
  if (f1.binomial.variable !== f2.binomial.variable) return null;
  if (f1.binomial.constant !== f2.binomial.constant) return null;

  return {
    variable: f1.binomial.variable,
    commonConstant: f1.binomial.constant,
    outside1: f1.outsideFactor,
    outside2: f2.outsideFactor
  };
}

function getSplitMiddleCandidates(model) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!sideAllowsFactoring(model, side)) continue;

    const otherSide = model.boundary ? oppositeSide(side) : null;
    const info = getQuadraticInfoForSide(model.sides[side]);
    if (!info) continue;

    if (info.a !== 1) {
      candidates.push({ side, otherSide, info, state: "conditional", reason: "Only monic quadratics are unlocked in v1.0.3." });
      continue;
    }

    const pair = findMonicIntegerFactorPair(info.b, info.c);
    if (!pair) {
      candidates.push({ side, otherSide, info, state: "conditional", reason: "No integer factor pair found." });
      continue;
    }

    candidates.push({ side, otherSide, info, pair, state: "available" });
  }

  return candidates;
}

function getGroupSplitMiddleCandidates(model) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!sideAllowsFactoring(model, side)) continue;

    const otherSide = model.boundary ? oppositeSide(side) : null;
    const info = getSplitMiddleInfoForSide(model.sides[side]);
    if (!info) continue;

    candidates.push({ side, otherSide, info, state: "available" });
  }

  return candidates;
}

function getFactorGroupedCandidates(model) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!sideAllowsFactoring(model, side)) continue;

    const otherSide = model.boundary ? oppositeSide(side) : null;
    const info = getGroupedQuadraticInfoForSide(model.sides[side]);
    if (!info) continue;

    candidates.push({ side, otherSide, info, state: "available" });
  }

  return candidates;
}

function getRevealCommonBinomialCandidates(model) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!sideAllowsFactoring(model, side)) continue;

    const otherSide = model.boundary ? oppositeSide(side) : null;
    const info = getFactoredGroupInfoForSide(model.sides[side]);
    if (!info) continue;

    candidates.push({ side, otherSide, info, state: "available" });
  }

  return candidates;
}

function splitMiddleTerm(candidateIndex) {
  if (!currentModel) return;

  const candidates = getSplitMiddleCandidates(currentModel).filter(c => c.state === "available");
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("No split-middle structure is available.", "warn");
    return;
  }

  const { side, info, pair } = candidate;
  const splitTiles = makeQuadraticSplitMiddleTiles({
    side,
    variable: info.variable,
    p: pair.p,
    q: pair.q
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? splitTiles : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? splitTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Split Middle Term"
  });

  clearSelection();
  history.push(`Split ${info.b}${info.variable} into ${pair.p}${info.variable} and ${pair.q}${info.variable}.`);
  setMessage("Middle term split. Highlight the first two terms or the last two terms to group them.", "good");
  renderModel(currentModel);
}

function groupSplitMiddleTerms(candidateIndex) {
  if (!currentModel) return;

  const candidates = getGroupSplitMiddleCandidates(currentModel);
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("No split-middle quadratic is ready to group.", "warn");
    return;
  }

  const { side, info } = candidate;
  const groupedTiles = makeGroupedSplitMiddleTiles({
    side,
    variable: info.variable,
    p: info.p,
    q: info.q
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? groupedTiles : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? groupedTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Group Split Middle Terms"
  });

  history.push("Grouped the split-middle quadratic into two parenthetical groups.");
  setMessage("Quadratic terms grouped. Now factor each group.", "good");
  renderModel(currentModel);
}

function factorGroupedQuadratic(candidateIndex) {
  if (!currentModel) return;

  const candidates = getFactorGroupedCandidates(currentModel);
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("No grouped quadratic is ready to factor.", "warn");
    return;
  }

  const { side, info } = candidate;

  const firstFactor = makeGroupedQuadraticPairTile({
    side,
    variable: info.variable,
    outsideFactor: 1,
    insideConstant: info.p
  });

  const secondFactor = makeGroupedQuadraticPairTile({
    side,
    variable: info.variable,
    outsideFactor: info.q,
    insideConstant: info.p
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? [firstFactor, secondFactor] : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? [firstFactor, secondFactor] : currentModel.sides.right) : []
    },
    lastTransformation: "Factor Each Group"
  });

  history.push(`Factored the groups into x(${binomialDisplay(info.variable, info.p)}) and ${info.q}(${binomialDisplay(info.variable, info.p)}).`);
  setMessage("Each group factored. Now reveal the common binomial structure.", "good");
  renderModel(currentModel);
}

function revealCommonBinomial(candidateIndex) {
  if (!currentModel) return;

  const candidates = getRevealCommonBinomialCandidates(currentModel);
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("No common binomial structure is ready to reveal.", "warn");
    return;
  }

  const { side, info } = candidate;
  const productTile = makeQuadraticProductTile({
    side,
    variable: info.variable,
    p: info.commonConstant,
    q: info.outside2
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? [productTile] : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? [productTile] : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Common Binomial"
  });

  history.push(`Revealed common binomial as (${binomialDisplay(info.variable, info.commonConstant)})(${binomialDisplay(info.variable, info.outside2)}).`);
  setMessage("Common binomial revealed as a product. Zero-product split is now available.", "good");
  renderModel(currentModel);
}


function sideAllowsFactoring(model, side) {
  if (!model) return false;

  // Factoring is a structure reveal, so it can happen inside expressions,
  // equations, or inequalities. It does NOT require the other side to be zero.
  // Only zero-product splitting requires a product equal to zero.
  if (!model.boundary) return side === "left";

  return side === "left" || side === "right";
}

function modelSideForExpression(model, side) {
  if (!model.boundary) return "expression";
  return side;
}

function getCandidateSidesForFactoring(model) {
  if (!model) return [];
  if (!model.boundary) return ["left"];
  return ["left", "right"];
}

function makeNumberFactorProductTile({ side, originalTile, factor, cofactor }) {
  const originalSign = originalTile.additiveCharge === "-" ? "-" : "+";
  const display = `${factor}·${cofactor}`;

  return withComputedFlags({
    id: `${side}-factored-number-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `${originalSign === "-" ? "-" : ""}${display}`,
    display,
    kind: "factoredNumber",
    identity: "factored-number",
    additiveCharge: originalSign,
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    structureType: "numberProduct",
    factorParts: [factor, cofactor],
    originalValue: signedAdditiveCount(originalTile),
    notes: [
      `${Math.abs(signedAdditiveCount(originalTile))} was expressed as ${factor}·${cofactor}.`,
      "This is a structure reveal, not an arithmetic operation."
    ]
  });
}

function factorOptionsForInteger(value) {
  const n = Math.abs(value);
  const options = [];

  if (!Number.isInteger(n) || n <= 1) return options;

  for (let f = 2; f <= n; f++) {
    if (n % f === 0) {
      options.push({ factor: f, cofactor: n / f });
    }
  }

  return options;
}

function getSelectedNumberFactorCandidate(model = currentModel) {
  const selected = getSelectedTilesOrdered(model);
  if (selected.length !== 1) return null;

  const { tile, side } = selected[0];
  const rational = rationalFromConstantLikeTile(tile);

  if (!rational || !rationalIsInteger(rational)) return null;
  if (Math.abs(rational.numerator) <= 1) return null;

  const options = factorOptionsForInteger(rational.numerator)
    .filter(option => !(option.factor === 1 && option.cofactor === Math.abs(rational.numerator)));

  if (!options.length) return null;

  return { tile, side, value: rational.numerator, options };
}

function revealSelectedNumberFactor(factor, cofactor) {
  const candidate = getSelectedNumberFactorCandidate();

  if (!candidate) {
    setMessage("Highlight one integer number tile to reveal a factor structure.", "warn");
    return;
  }

  const { tile, side } = candidate;
  const factoredTile = makeNumberFactorProductTile({
    side,
    originalTile: tile,
    factor,
    cofactor
  });

  const newSideTiles = currentModel.sides[side].map(t =>
    t.id === tile.id ? factoredTile : t
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Number Factor Structure"
  });

  clearSelection();
  history.push(`Revealed ${Math.abs(candidate.value)} as ${factor}·${cofactor}.`);
  setMessage(`Number factor structure revealed as ${factor}·${cofactor}.`, "good");
  renderModel(currentModel);
}

function getQuadraticFactorCandidates(model) {
  if (!model || model.boundary !== "=") return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    const otherSide = oppositeSide(side);

    if (!sideIsZero(model.sides[otherSide])) continue;

    const info = getQuadraticInfoForSide(model.sides[side]);
    if (!info) continue;

    if (info.a !== 1) {
      candidates.push({
        side,
        otherSide,
        info,
        state: "conditional",
        reason: "Only monic quadratics with leading tile +x^2 are unlocked in v1.0."
      });
      continue;
    }

    const pair = findMonicIntegerFactorPair(info.b, info.c);

    if (pair) {
      candidates.push({
        side,
        otherSide,
        info,
        pair,
        state: "available",
        reason: `Factor pair found: ${pair.p} and ${pair.q}.`
      });
    } else {
      candidates.push({
        side,
        otherSide,
        info,
        state: "conditional",
        reason: "No integer factor pair found yet. Later versions can use completing square/quadratic formula."
      });
    }
  }

  return candidates;
}

function revealQuadraticFactors(candidateIndex) {
  if (!currentModel) return;

  const candidates = getQuadraticFactorCandidates(currentModel)
    .filter(c => c.state === "available");
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("No available monic quadratic factor structure found.", "warn");
    return;
  }

  const { side, otherSide, info, pair } = candidate;
  const productTile = makeQuadraticProductTile({
    side,
    variable: info.variable,
    p: pair.p,
    q: pair.q
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? [productTile] : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? [productTile] : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Quadratic Factor Structure"
  });

  // Make sure the zero side stays as zero.
  currentModel.sides[otherSide] = currentModel.sides[otherSide];

  history.push(`Revealed quadratic factor structure as (${binomialDisplay(info.variable, pair.p)})(${binomialDisplay(info.variable, pair.q)}).`);
  setMessage("Quadratic factor structure revealed. Zero-product split is now available if the product equals zero.", "good");
  renderModel(currentModel);
}

function getZeroProductCandidates(model) {
  if (!model || model.boundary !== "=") return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    const otherSide = oppositeSide(side);
    if (!sideIsZero(model.sides[otherSide])) continue;

    const tiles = model.sides[side];
    if (tiles.length !== 1) continue;

    const tile = tiles[0];
    if (tile.kind === "product" && tile.structureType === "quadraticProduct" && tile.factors && tile.factors.length === 2) {
      candidates.push({ side, otherSide, productTile: tile });
    }
  }

  return candidates;
}

function makeZeroTileForSide(side) {
  return makeConstantTile({ side, index: 0, signedAdditiveCount: 0 });
}

function makeZeroProductBranchModels(productTile, side, otherSide) {
  return productTile.factors.map((factor, index) => {
    const factorTiles = parseSide(factor.raw, side);
    const zeroTiles = [makeZeroTileForSide(otherSide)];

    const sides = {
      left: side === "left" ? factorTiles : zeroTiles,
      right: side === "right" ? factorTiles : zeroTiles
    };

    return {
      title: `Zero Product Branch ${index + 1}`,
      note: `Set factor (${factor.display}) equal to zero.`,
      model: cleanupModelZeros({
        raw: `${factor.raw} = 0`,
        normalized: "",
        type: "relation",
        boundary: "=",
        sides,
        lastTransformation: `Zero Product Split: (${factor.display}) = 0`
      })
    };
  });
}

function splitZeroProduct(candidateIndex) {
  if (!currentModel) return;

  const candidates = getZeroProductCandidates(currentModel);
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("Zero-product split is locked until a product structure equals zero.", "warn");
    return;
  }

  currentBranches = makeZeroProductBranchModels(candidate.productTile, candidate.side, candidate.otherSide);
  history.push(`Split zero-product structure ${candidate.productTile.display} = 0 into two linear branches.`);
  setMessage("Zero-product branches created. Load a branch to keep solving.", "good");
  renderModel(currentModel);
}



function getSelectedQuadraticGroupingCandidate(model = currentModel) {
  const selected = getSelectedTilesOrdered(model);

  if (selected.length !== 2 || !selectedTilesAreSameSide(selected)) return null;

  const side = selected[0].side;
  const otherSide = model.boundary ? oppositeSide(side) : null;
  if (!sideAllowsFactoring(model, side)) return null;

  const indexes = selectedIndexes(selected);
  if (!indexesAreConsecutive(indexes)) return null;

  const tiles = selected.map(item => item.tile);

  const x2Tile = tiles.find(t => variableCompletionIs(t, 2, 1));
  const xTile = tiles.find(t => variableCompletionIs(t, 1, 1));
  const constantTile = tiles.find(t => {
    const r = rationalFromConstantLikeTile(t);
    return r && rationalIsInteger(r);
  });

  // First grouping: x^2 + px
  if (x2Tile && xTile && !constantTile && signedAdditiveCount(x2Tile) === 1) {
    const p = signedAdditiveCount(xTile);
    return {
      side,
      otherSide,
      selected,
      groupRole: "first",
      variable: x2Tile.identity,
      p,
      q: null,
      rawInside: `${x2Tile.identity}^2${p < 0 ? "" : "+"}${p}${x2Tile.identity}`,
      displayInside: `${x2Tile.identity}² ${p < 0 ? "- " + Math.abs(p) : "+ " + p}${x2Tile.identity}`
    };
  }

  // Second grouping: qx + qp
  if (xTile && constantTile && !x2Tile) {
    const q = signedAdditiveCount(xTile);
    const c = rationalFromConstantLikeTile(constantTile).numerator;

    if (q === 0 || c % q !== 0) return null;

    const p = c / q;

    return {
      side,
      otherSide,
      selected,
      groupRole: "second",
      variable: xTile.identity,
      p,
      q,
      rawInside: `${q}${xTile.identity}${c < 0 ? "" : "+"}${c}`,
      displayInside: `${q}${xTile.identity} ${c < 0 ? "- " + Math.abs(c) : "+ " + c}`
    };
  }

  return null;
}

function groupSelectedQuadraticTerms() {
  const candidate = getSelectedQuadraticGroupingCandidate();

  if (!candidate) {
    setMessage("Highlight exactly two neighboring quadratic terms that share a group structure.", "warn");
    return;
  }

  const { side, groupRole, variable, p, q, rawInside, displayInside } = candidate;
  const selectedIds = new Set(candidate.selected.map(item => item.tile.id));

  const groupTile = makeRawGroupTile({
    side,
    rawInside,
    displayInside,
    groupRole,
    p,
    q,
    variable
  });

  const newSideTiles = [];
  let groupInserted = false;

  currentModel.sides[side].forEach(tile => {
    if (selectedIds.has(tile.id)) {
      if (!groupInserted) {
        newSideTiles.push(groupTile);
        groupInserted = true;
      }
    } else {
      newSideTiles.push(tile);
    }
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Group Highlighted Quadratic Terms"
  });

  clearSelection();
  history.push(`Grouped highlighted tiles as (${displayInside}).`);
  setMessage("Highlighted tiles grouped. Now highlight that group to reveal its common factor.", "good");
  renderModel(currentModel);
}


function getSelectedRawQuadraticGroupCandidate(model = currentModel) {
  const selected = getSelectedTilesOrdered(model);

  if (selected.length !== 1) return null;

  const { tile, side } = selected[0];
  const otherSide = model.boundary ? oppositeSide(side) : null;

  if (!sideAllowsFactoring(model, side)) return null;
  if (tile.kind !== "composite" || tile.structureType !== "quadraticGroup") return null;

  if (tile.groupRole === "first") {
    return {
      side,
      otherSide,
      tile,
      variable: tile.variable,
      outsideFactor: 1,
      insideConstant: tile.p,
      displayFactor: `${tile.variable}`
    };
  }

  if (tile.groupRole === "second" && Number.isFinite(tile.q)) {
    return {
      side,
      otherSide,
      tile,
      variable: tile.variable,
      outsideFactor: tile.q,
      insideConstant: tile.p,
      displayFactor: String(tile.q)
    };
  }

  return null;
}



function revealFactorFromSelectedGroup() {
  const candidate = getSelectedRawQuadraticGroupCandidate();

  if (!candidate) {
    setMessage("Highlight one grouped quadratic tile, such as (x² + 2x), to reveal its common factor.", "warn");
    return;
  }

  const factoredTile = makeGroupedQuadraticPairTile({
    side: candidate.side,
    variable: candidate.variable,
    outsideFactor: candidate.outsideFactor,
    insideConstant: candidate.insideConstant
  });

  const newSideTiles = currentModel.sides[candidate.side].map(tile =>
    tile.id === candidate.tile.id ? factoredTile : tile
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (candidate.side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Factor From Highlighted Group"
  });

  clearSelection();
  history.push(`Revealed common factor ${candidate.displayFactor} from highlighted group.`);
  setMessage("Common factor revealed from the highlighted group. Repeat for the other group.", "good");
  renderModel(currentModel);
}



function getSelectedCommonBinomialCandidate(model = currentModel) {
  const selected = getSelectedTilesOrdered(model);

  if (selected.length !== 2 || !selectedTilesAreSameSide(selected)) return null;

  const side = selected[0].side;
  const otherSide = model.boundary ? oppositeSide(side) : null;

  if (!sideAllowsFactoring(model, side)) return null;

  const tiles = selected.map(item => item.tile);
  if (!tiles.every(t => t.kind === "factoredGroup" && t.binomial)) return null;

  const [a, b] = tiles;

  if (a.binomial.variable !== b.binomial.variable) return null;
  if (a.binomial.constant !== b.binomial.constant) return null;

  const first = tiles.find(t => t.outsideFactor === 1) || a;
  const second = tiles.find(t => t.id !== first.id) || b;

  return {
    side,
    otherSide,
    tiles,
    variable: first.binomial.variable,
    commonConstant: first.binomial.constant,
    outside2: second.outsideFactor
  };
}



function revealCommonBinomialFromSelection() {
  const candidate = getSelectedCommonBinomialCandidate();

  if (!candidate) {
    setMessage("Highlight the two factored groups that share the same binomial, such as x(x+2) and 3(x+2).", "warn");
    return;
  }

  const productTile = makeQuadraticProductTile({
    side: candidate.side,
    variable: candidate.variable,
    p: candidate.commonConstant,
    q: candidate.outside2
  });

  const selectedIds = new Set(candidate.tiles.map(tile => tile.id));
  const newSideTiles = [];
  let inserted = false;

  currentModel.sides[candidate.side].forEach(tile => {
    if (selectedIds.has(tile.id)) {
      if (!inserted) {
        newSideTiles.push(productTile);
        inserted = true;
      }
    } else {
      newSideTiles.push(tile);
    }
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (candidate.side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Common Binomial From Highlighted Groups"
  });

  clearSelection();
  history.push(`Revealed common binomial from highlighted groups as ${productTile.display}.`);
  setMessage("Common binomial revealed as a product. If this product equals zero, zero-product split can happen next.", "good");
  renderModel(currentModel);
}




function getSelectedTrinomialFactorCandidate(model = currentModel) {
  const selected = getSelectedTilesOrdered(model);

  if (selected.length !== 3 || !selectedTilesAreSameSide(selected)) return null;

  const side = selected[0].side;
  const otherSide = model.boundary ? oppositeSide(side) : null;

  if (!sideAllowsFactoring(model, side)) return null;

  const selectedTiles = selected.map(item => item.tile);
  const info = getQuadraticInfoForSide(selectedTiles);

  if (!info || info.a !== 1) return null;

  const pair = findMonicIntegerFactorPair(info.b, info.c);
  if (!pair) return null;

  return {
    side,
    otherSide,
    selected,
    selectedTiles,
    info,
    pair,
    isPerfectSquare: pair.p === pair.q
  };
}

function revealSelectedTrinomialFactors() {
  const candidate = getSelectedTrinomialFactorCandidate();

  if (!candidate) {
    setMessage("Highlight three neighboring tiles that form a monic factorable trinomial, such as x² - 8x + 16.", "warn");
    return;
  }

  const { side, selected, info, pair } = candidate;
  const selectedIds = new Set(selected.map(item => item.tile.id));

  const productTile = makeQuadraticProductTile({
    side,
    variable: info.variable,
    p: pair.p,
    q: pair.q
  });

  productTile.notes = [
    ...(productTile.notes || []),
    "Created from a highlighted three-term trinomial.",
    candidate.isPerfectSquare
      ? "This is a perfect-square trinomial structure."
      : "This is a selected trinomial factor structure."
  ];

  const newSideTiles = [];
  let inserted = false;

  currentModel.sides[side].forEach(tile => {
    if (selectedIds.has(tile.id)) {
      if (!inserted) {
        newSideTiles.push(productTile);
        inserted = true;
      }
    } else {
      newSideTiles.push(tile);
    }
  });

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: candidate.isPerfectSquare
      ? "Reveal Selected Perfect Square Trinomial"
      : "Reveal Selected Trinomial Factors"
  });

  clearSelection();
  history.push(`Revealed highlighted trinomial as ${productTile.display}.`);
  setMessage(`Highlighted trinomial factored as ${productTile.display}.`, "good");
  renderModel(currentModel);
}


function productTileHasRepeatedBinomial(productTile) {
  return productTile &&
    productTile.kind === "product" &&
    productTile.structureType === "quadraticProduct" &&
    productTile.factors &&
    productTile.factors.length === 2 &&
    productTile.factors[0].variable === productTile.factors[1].variable &&
    productTile.factors[0].constant === productTile.factors[1].constant;
}

function makeSquaredBinomialTile({ side, factor }) {
  return withComputedFlags({
    id: `${side}-squared-binomial-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `(${factor.raw})^2`,
    display: `(${factor.display})²`,
    kind: "squaredBinomial",
    identity: "squared-binomial",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 2, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    structureType: "squaredBinomial",
    baseFactor: structuredClone(factor),
    childrenRaw: factor.raw,
    notes: [
      `Repeated binomial product (${factor.display})(${factor.display}) was rewritten as (${factor.display})².`,
      "This is the completing-the-square structure reveal."
    ]
  });
}

function getRepeatedBinomialSquareCandidates(model = currentModel) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!model.sides[side]) continue;

    model.sides[side].forEach((tile, index) => {
      if (productTileHasRepeatedBinomial(tile)) {
        candidates.push({
          side,
          index,
          productTile: tile,
          factor: tile.factors[0]
        });
      }
    });
  }

  return candidates;
}

function getSelectedRepeatedBinomialSquareCandidate(model = currentModel) {
  const selected = getSelectedTilesOrdered(model);

  if (selected.length === 1) {
    const { tile, side, index } = selected[0];
    if (productTileHasRepeatedBinomial(tile)) {
      return {
        side,
        index,
        productTile: tile,
        factor: tile.factors[0]
      };
    }
  }

  return null;
}

function revealRepeatedBinomialSquareFromCandidate(candidate) {
  if (!candidate) {
    setMessage("Highlight a repeated binomial product like (x - 4)(x - 4) to rewrite it as a square.", "warn");
    return;
  }

  const squaredTile = makeSquaredBinomialTile({
    side: candidate.side,
    factor: candidate.factor
  });

  const newSideTiles = currentModel.sides[candidate.side].map(tile =>
    tile.id === candidate.productTile.id ? squaredTile : tile
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (candidate.side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Repeated Binomial as Square"
  });

  clearSelection();
  history.push(`Revealed repeated binomial ${candidate.productTile.display} as ${squaredTile.display}.`);
  setMessage(`Repeated binomial rewritten as ${squaredTile.display}.`, "good");
  renderModel(currentModel);
}

function revealSelectedRepeatedBinomialSquare() {
  const candidate = getSelectedRepeatedBinomialSquareCandidate();
  revealRepeatedBinomialSquareFromCandidate(candidate);
}

function revealRepeatedBinomialSquare(index) {
  const candidates = getRepeatedBinomialSquareCandidates();
  revealRepeatedBinomialSquareFromCandidate(candidates[index]);
}

function renderQuadraticButtons(model) {
  quadraticButtons.innerHTML = "";

  renderSelectionNote(quadraticButtons);


  const numberFactorCandidate = getSelectedNumberFactorCandidate(model);
  if (numberFactorCandidate) {
    const title = document.createElement("p");
    title.className = "note";
    title.textContent = `Selected number ${Math.abs(numberFactorCandidate.value)} can reveal these factor structures:`;
    quadraticButtons.appendChild(title);

    numberFactorCandidate.options.forEach(option => {
      const btn = document.createElement("button");
      btn.className = "move-action selected-action";
      btn.innerHTML = `Reveal <strong>${Math.abs(numberFactorCandidate.value)} = ${option.factor}·${option.cofactor}</strong>`;
      btn.addEventListener("click", () => revealSelectedNumberFactor(option.factor, option.cofactor));
      quadraticButtons.appendChild(btn);
    });
  }

  const splitCandidates = getSplitMiddleCandidates(model).filter(c => c.state === "available");
  splitCandidates.forEach((candidate, index) => {
    const { info, pair } = candidate;
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Step 1: Split middle term <strong>${info.b}${info.variable}</strong> into <strong>${pair.p}${info.variable}</strong> and <strong>${pair.q}${info.variable}</strong>`;
    btn.addEventListener("click", () => splitMiddleTerm(index));
    quadraticButtons.appendChild(btn);
  });

  const selectedGroupCandidate = getSelectedQuadraticGroupingCandidate(model);
  if (selectedGroupCandidate) {
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = `Group highlighted tiles as <strong>(${selectedGroupCandidate.displayInside})</strong>`;
    btn.addEventListener("click", groupSelectedQuadraticTerms);
    quadraticButtons.appendChild(btn);
  }

  const selectedRawGroupCandidate = getSelectedRawQuadraticGroupCandidate(model);
  if (selectedRawGroupCandidate) {
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = `Reveal factor <strong>${selectedRawGroupCandidate.displayFactor}</strong> from highlighted group`;
    btn.addEventListener("click", revealFactorFromSelectedGroup);
    quadraticButtons.appendChild(btn);
  }

  const commonBinomialCandidate = getSelectedCommonBinomialCandidate(model);
  if (commonBinomialCandidate) {
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = `Reveal common binomial <strong>(${binomialDisplay(commonBinomialCandidate.variable, commonBinomialCandidate.commonConstant)})(${binomialDisplay(commonBinomialCandidate.variable, commonBinomialCandidate.outside2)})</strong>`;
    btn.addEventListener("click", revealCommonBinomialFromSelection);
    quadraticButtons.appendChild(btn);
  }

  const selectedTrinomialCandidate = getSelectedTrinomialFactorCandidate(model);
  if (selectedTrinomialCandidate) {
    const { info, pair, isPerfectSquare } = selectedTrinomialCandidate;
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = isPerfectSquare
      ? `Reveal perfect-square trinomial <strong>(${binomialDisplay(info.variable, pair.p)})(${binomialDisplay(info.variable, pair.q)})</strong>`
      : `Reveal selected trinomial factors <strong>(${binomialDisplay(info.variable, pair.p)})(${binomialDisplay(info.variable, pair.q)})</strong>`;
    btn.addEventListener("click", revealSelectedTrinomialFactors);
    quadraticButtons.appendChild(btn);
  }


  const selectedRepeatedBinomialCandidate = getSelectedRepeatedBinomialSquareCandidate(model);
  if (selectedRepeatedBinomialCandidate) {
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = `Reveal repeated binomial as square <strong>${selectedRepeatedBinomialCandidate.productTile.display} → (${selectedRepeatedBinomialCandidate.factor.display})²</strong>`;
    btn.addEventListener("click", revealSelectedRepeatedBinomialSquare);
    quadraticButtons.appendChild(btn);
  } else {
    const repeatedCandidates = getRepeatedBinomialSquareCandidates(model);
    repeatedCandidates.forEach((candidate, index) => {
      const btn = document.createElement("button");
      btn.className = "move-action";
      btn.innerHTML = `Reveal repeated binomial as square <strong>${candidate.productTile.display} → (${candidate.factor.display})²</strong>`;
      btn.addEventListener("click", () => revealRepeatedBinomialSquare(index));
      quadraticButtons.appendChild(btn);
    });
  }


  const powerRevealCandidates = getPowerMultiplicationRevealCandidates(model);
  powerRevealCandidates.forEach((candidate, index) => {
    const squaredTile = candidate.tile.children[0];
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Reveal power multiplication <strong>${candidate.tile.display} → (${squaredTile.baseFactor.display})^(2·${powerDisplay(candidate.tile.power)})</strong>`;
    btn.addEventListener("click", () => revealPowerMultiplication(index));
    quadraticButtons.appendChild(btn);
  });

  const powerCombineCandidates = getPowerProductCombineCandidates(model);
  powerCombineCandidates.forEach((candidate, index) => {
    const combined = multiplyPowers(candidate.tile.innerPower, candidate.tile.outerPower);
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Combine multiplied powers <strong>${powerDisplay(candidate.tile.innerPower)}·${powerDisplay(candidate.tile.outerPower)} = ${powerDisplay(combined)}</strong>`;
    btn.addEventListener("click", () => combinePowerMultiplication(index));
    quadraticButtons.appendChild(btn);
  });


  const plusMinusCandidates = getPlusMinusNumberSideCandidates(model);
  const availablePlusMinus = plusMinusCandidates.filter(c => c.state === "available");
  availablePlusMinus.forEach((candidate, index) => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Reveal number-side ± <strong>${candidate.tile.display} → ±${numberPowerBaseDisplay(candidate.tile)}${powerSupDisplay(candidate.tile.power)}</strong>`;
    btn.addEventListener("click", () => revealPlusMinusNumberSide(index));
    quadraticButtons.appendChild(btn);
  });

  const imaginaryPlusMinus = plusMinusCandidates.filter(c => c.state === "imaginary");
  imaginaryPlusMinus.forEach((candidate, index) => {
    const value = numericValueFromPowerShell(candidate.tile);
    const magnitude = Math.abs(value.numerator);
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Reveal imaginary extension <strong>${candidate.tile.display} → ±i·${magnitude}${powerSupDisplay(candidate.tile.power)}</strong>`;
    btn.addEventListener("click", () => revealImaginaryPlusMinusNumberSide(index));
    quadraticButtons.appendChild(btn);
  });

  const plusMinusSplitCandidates = getPlusMinusSplitCandidates(model);
  plusMinusSplitCandidates.forEach((candidate, index) => {
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = `Split plus/minus into branches <strong>${candidate.tile.display}</strong>`;
    btn.addEventListener("click", () => splitPlusMinus(index));
    quadraticButtons.appendChild(btn);
  });

  const zeroProductCandidates = getZeroProductCandidates(model);

  if (zeroProductCandidates.length) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Zero-product split is available because a product structure equals zero.";
    quadraticButtons.appendChild(note);

    zeroProductCandidates.forEach((candidate, index) => {
      const btn = document.createElement("button");
      btn.className = "move-action";
      btn.innerHTML = `Split zero product <strong>${candidate.productTile.display} = 0</strong>`;
      btn.addEventListener("click", () => splitZeroProduct(index));
      quadraticButtons.appendChild(btn);
    });
  }
}



function detectTransformations(model) {
  const items = [];
  const allTiles = [...model.sides.left, ...model.sides.right];

  const hasExpandable = allTiles.some(hasExpandableComposite);
  items.push({
    name: "Expand",
    state: hasExpandable ? "available" : "locked",
    reason: hasExpandable
      ? "A parenthetical structure can open into its internal tiles."
      : "No parenthetical structure is ready to expand."
  });

  const canGroup = model.sides.left.length > 1 || (model.boundary && model.sides.right.length > 1);
  items.push({
    name: "Add Parentheses",
    state: canGroup ? "available" : "locked",
    reason: canGroup
      ? "A side has multiple tiles and can be grouped into one composite tile."
      : "Grouping requires at least two tiles on a side."
  });

  items.push({
    name: "Show / Hide Hidden /1",
    state: "available",
    reason: showHiddenOnes
      ? "Hidden denominator 1 structures are currently visible."
      : "Hidden denominator 1 structures are currently hidden."
  });

  const sideGroups = {};
  const constantLikeBySide = { left: 0, right: 0 };
  const fractionConstantLikeBySide = { left: 0, right: 0 };

  for (const tile of allTiles) {
    if (isConstantLikeTile(tile)) {
      constantLikeBySide[tile.side] = (constantLikeBySide[tile.side] || 0) + 1;
      if (tile.kind === "fraction") {
        fractionConstantLikeBySide[tile.side] = (fractionConstantLikeBySide[tile.side] || 0) + 1;
      }
      continue;
    }

    const key = tile.likeSignature;
    if (!key) continue;
    const fullKey = `${tile.side}|${key}`;
    sideGroups[fullKey] = (sideGroups[fullKey] || 0) + 1;
  }

  const hasLikeTerms =
    Object.values(sideGroups).some(count => count > 1) ||
    Object.values(constantLikeBySide).some(count => count > 1) ||
    Object.values(fractionConstantLikeBySide).some(count => count > 0);

  items.push({
    name: "Combine Like Terms",
    state: hasLikeTerms ? "available" : "locked",
    reason: hasLikeTerms
      ? "Matching like signatures or constant-like rational tiles exist on the same side."
      : "No matching like signatures or constant-like rational tiles detected on the same side."
  });

  if (model.boundary) {
    items.push({
      name: "Additive Boundary Crossing",
      state: "available",
      reason: "Any additive tile can cross the boundary. Its additive charge flips automatically."
    });

    items.push({
      name: "Add Same Tile to Both Sides",
      state: "available",
      reason: "A new additive tile can be placed on both sides without combining automatically."
    });

    items.push({
      name: "Raise Both Sides to a Power",
      state: model.boundary === "=" ? "available" : "conditional",
      reason: model.boundary === "="
        ? "The entire left side and entire right side can be wrapped in the same power shell. Even roots will preserve absolute-value/branch behavior."
        : "Powering both sides of inequalities requires sign/domain rules and is locked for now."
    });
  } else {
    items.push({
      name: "Additive Boundary Crossing",
      state: "locked",
      reason: "No equation or inequality boundary detected."
    });

    items.push({
      name: "Add Same Tile to Both Sides",
      state: "locked",
      reason: "Adding to both sides requires an equation or inequality boundary."
    });

    items.push({
      name: "Raise Both Sides to a Power",
      state: "locked",
      reason: "Powering both sides requires an equation boundary."
    });
  }

  const multiplicativeCandidates = getIsolatedMovableFactorTiles(model);
  items.push({
    name: "Multiplicative Boundary Crossing",
    state: multiplicativeCandidates.length ? "available" : "locked",
    reason: multiplicativeCandidates.length
      ? "An isolated variable or parenthetical composite tile has an outside factor greater than 1. That factor can cross as a denominator-position factor."
      : "Requires an isolated variable or parenthetical composite tile with additive count greater than 1."
  });

  const literalCandidates = getLiteralFactorMoveCandidates(model);

  literalCandidates.forEach(({ tile, factor, factorIndex, side }) => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    const target = oppositeSide(side);
    btn.innerHTML = `Move symbolic factor <strong>${factor.display || factor.raw}</strong> into denominator on ${target}`;
    btn.addEventListener("click", () => moveLiteralFactorAcross(tile.id, factorIndex));
    multiplicativeButtons.appendChild(btn);
  });

  const denominatorCandidates = getDenominatorCrossingCandidates(model);
  const hasBlockedVariableDenominatorInequality =
    isInequalityBoundary(model.boundary) &&
    allTiles.some(t => t.kind === "fraction" && !denominatorIsOne(t) && !denominatorKnownPositive(t.denominator));

  items.push({
    name: "Denominator Boundary Crossing",
    state: denominatorCandidates.length ? "available" : (hasBlockedVariableDenominatorInequality ? "conditional" : "locked"),
    reason: denominatorCandidates.length
      ? "An isolated denominator-position tile can cross into numerator position on the other side."
      : (hasBlockedVariableDenominatorInequality
        ? "Variable denominator in an inequality needs branching/conditions before crossing."
        : "Requires an isolated fraction tile with a non-1 denominator.")
  });

  const revealableFractionAvailable = allTiles.some(hasRevealableNumericFraction);
  items.push({
    name: "Reveal Common Factors",
    state: revealableFractionAvailable ? "available" : "locked",
    reason: revealableFractionAvailable
      ? "A numeric fraction has matching numerator/denominator factors available to reveal."
      : "No unrevealed common factors detected."
  });

  const cancellableRevealedFactorsAvailable = allTiles.some(hasCancellableRevealedFactors);
  items.push({
    name: "Cancel Revealed Factors",
    state: cancellableRevealedFactorsAvailable ? "available" : "locked",
    reason: cancellableRevealedFactorsAvailable
      ? "Matching factors have been revealed and can now be cancelled."
      : "No revealed matching factors are ready to cancel."
  });

  if (allTiles.some(t => t.kind === "fraction")) {
    items.push({
      name: "Fraction Position",
      state: "available",
      reason: "Numerator and denominator structures detected."
    });
  }

  const hasInequality = ["<", ">", "<=", ">="].includes(model.boundary);
  const hasNegativeMultiplicativeTile = allTiles.some(t =>
    t.additiveCharge === "-" && (t.kind === "variable" || t.kind === "fraction")
  );

  items.push({
    name: "Inequality Flip",
    state: hasInequality && hasNegativeMultiplicativeTile ? "conditional" : "locked",
    reason: hasInequality
      ? (hasNegativeMultiplicativeTile
        ? "Triggers automatically when a negative multiplicative factor crosses the inequality boundary."
        : "Inequality detected, but no negative multiplicative crossing has occurred.")
      : "No inequality boundary detected."
  });

  const relationEqualsZero = model.boundary === "=" &&
    ((model.sides.left.length === 1 && model.sides.left[0].kind === "constant" && model.sides.left[0].additiveCount === 0) ||
     (model.sides.right.length === 1 && model.sides.right[0].kind === "constant" && model.sides.right[0].additiveCount === 0));

  const hasCompositeOrQuadratic = allTiles.some(t =>
    t.kind === "composite" ||
    (t.kind === "variable" && t.multiplicativeCompletion.numerator === 2 && t.multiplicativeCompletion.denominator === 1) ||
    (t.kind === "fraction" && (t.numerator.kind === "composite" || t.denominator.kind === "composite"))
  );

  items.push({
    name: "Factor / Reveal Structure",
    state: hasCompositeOrQuadratic ? "available" : "locked",
    reason: hasCompositeOrQuadratic
      ? "Composite, quadratic-completion, or fraction structure detected."
      : "No factorable structure detected yet."
  });

  const splitCandidates = getSplitMiddleCandidates(model);
  const splitAvailable = splitCandidates.filter(c => c.state === "available");
  const splitConditional = splitCandidates.filter(c => c.state === "conditional");
  const groupAvailable = getGroupSplitMiddleCandidates(model);
  const factorGroupsAvailable = getFactorGroupedCandidates(model);
  const commonBinomialAvailable = getRevealCommonBinomialCandidates(model);
  const selectedTrinomialAvailable = getSelectedTrinomialFactorCandidate(model);

  items.push({
    name: "Quadratic Stepwise Factoring",
    state: (splitAvailable.length || groupAvailable.length || factorGroupsAvailable.length || commonBinomialAvailable.length || selectedTrinomialAvailable)
      ? "available"
      : (splitConditional.length ? "conditional" : "locked"),
    reason: selectedTrinomialAvailable
      ? "Highlighted three-term monic trinomial can reveal factor structure."
      : (splitAvailable.length
        ? "A monic quadratic can split its middle term."
        : (groupAvailable.length
          ? "Highlight neighboring split-middle tiles to group them."
          : (factorGroupsAvailable.length
            ? "Highlight a grouped tile to reveal its common factor."
            : (commonBinomialAvailable.length
              ? "Highlight both factored groups to reveal the common binomial product."
              : (splitConditional.length ? splitConditional[0].reason : "Requires a monic quadratic trinomial, highlighted factorable trinomial, or highlighted factorable number.")))))
  });


  const selectedRepeatedBinomialCandidate = getSelectedRepeatedBinomialSquareCandidate(model);
  if (selectedRepeatedBinomialCandidate) {
    const btn = document.createElement("button");
    btn.className = "move-action selected-action";
    btn.innerHTML = `Reveal repeated binomial as square <strong>${selectedRepeatedBinomialCandidate.productTile.display} → (${selectedRepeatedBinomialCandidate.factor.display})²</strong>`;
    btn.addEventListener("click", revealSelectedRepeatedBinomialSquare);
    quadraticButtons.appendChild(btn);
  } else {
    const repeatedCandidates = getRepeatedBinomialSquareCandidates(model);
    repeatedCandidates.forEach((candidate, index) => {
      const btn = document.createElement("button");
      btn.className = "move-action";
      btn.innerHTML = `Reveal repeated binomial as square <strong>${candidate.productTile.display} → (${candidate.factor.display})²</strong>`;
      btn.addEventListener("click", () => revealRepeatedBinomialSquare(index));
      quadraticButtons.appendChild(btn);
    });
  }

  const repeatedBinomialCandidates = getRepeatedBinomialSquareCandidates(model);
  items.push({
    name: "Repeated Binomial Square Reveal",
    state: repeatedBinomialCandidates.length ? "available" : "locked",
    reason: repeatedBinomialCandidates.length
      ? "A product contains two identical binomial factors and can be rewritten as a squared binomial."
      : "Requires a repeated binomial product such as (x - 4)(x - 4)."
  });


  const powerRevealCandidates = getPowerMultiplicationRevealCandidates(model);
  const powerCombineCandidates = getPowerProductCombineCandidates(model);
  items.push({
    name: "Power-to-Power Simplification",
    state: (powerRevealCandidates.length || powerCombineCandidates.length) ? "available" : "locked",
    reason: powerRevealCandidates.length
      ? "A power shell sits on top of another power structure, so power multiplication can be revealed."
      : (powerCombineCandidates.length
        ? "A visible power product can be multiplied into one power."
        : "Requires a power shell on a powered structure.")
  });


  const plusMinusCandidates = getPlusMinusNumberSideCandidates(model);
  const plusMinusAvailable = plusMinusCandidates.filter(c => c.state === "available");
  const plusMinusImaginary = plusMinusCandidates.filter(c => c.state === "imaginary");
  const plusMinusSplitCandidates = getPlusMinusSplitCandidates(model);
  items.push({
    name: "Number-Side Plus/Minus Reveal",
    state: (plusMinusAvailable.length || plusMinusImaginary.length || plusMinusSplitCandidates.length) ? "available" : "locked",
    reason: plusMinusSplitCandidates.length
      ? "A plus/minus tile can split into plus and minus branches."
      : (plusMinusAvailable.length
        ? "A numeric side is raised to an even fractional power, so the solving form needs ± on the number side."
        : (plusMinusImaginary.length
          ? "A negative number under an even fractional power can reveal an i-extension."
          : "Requires a numeric power shell with an even denominator, such as 20^(1/2)."))
  });

  const zeroProductCandidates = getZeroProductCandidates(model);
  items.push({
    name: "Zero Product Split",
    state: zeroProductCandidates.length ? "available" : "locked",
    reason: zeroProductCandidates.length
      ? "A product structure is equal to zero and can split into branches."
      : "Requires a product structure equal to zero."
  });

  items.push({
    name: "Branch",
    state: zeroProductCandidates.length ? "available" : (relationEqualsZero && hasCompositeOrQuadratic ? "conditional" : "locked"),
    reason: zeroProductCandidates.length
      ? "Zero-product branch split is available."
      : (relationEqualsZero
        ? "Branching will be legal only after the side opposite zero is a multiplication structure."
        : "Branching requires a product equal to the zero tile.")
  });

  const absTiles = allTiles.filter(t => t.kind === "absolute");
  const isolatedAbsTiles = getIsolatedAbsoluteValueCandidates(model);
  items.push({
    name: "Absolute Value Split",
    state: isolatedAbsTiles.length ? "available" : (absTiles.length ? "conditional" : "locked"),
    reason: isolatedAbsTiles.length
      ? "An absolute-value shell is isolated by itself on one side of an equation. Split is unlocked."
      : (absTiles.length
        ? "Absolute-value shell detected. Split unlocks only after the absolute-value tile is isolated."
        : "No absolute-value tile detected.")
  });

  return items;
}

function renderMoveButtons(model) {
  moveButtons.innerHTML = "";

  if (!model || !model.boundary) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = "Additive boundary crossing is locked because there is no boundary.";
    moveButtons.appendChild(note);
    return;
  }

  const allTiles = [...model.sides.left, ...model.sides.right];

  allTiles.forEach(tile => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Move <strong>${tileReadableLabel(tile)}</strong> from ${tile.side} to ${oppositeSide(tile.side)}`;
    btn.addEventListener("click", () => moveAdditiveTileAcross(tile.id));
    moveButtons.appendChild(btn);
  });
}


function renderMultiplicativeButtons(model) {
  multiplicativeButtons.innerHTML = "";

  const rowTitle = document.createElement("p");
  rowTitle.className = "note";
  rowTitle.textContent = "Multiplicative crossing appears for isolated outside factors and isolated fraction denominators.";
  multiplicativeButtons.appendChild(rowTitle);

  const candidates = getIsolatedMovableFactorTiles(model);

  candidates.forEach(tile => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    const target = oppositeSide(tile.side);
    const signedFactor = (tile.additiveCharge === "-" ? "-" : "") + tile.additiveCount;
    btn.innerHTML = `Move outside factor <strong>${signedFactor}</strong> from ${tileReadableLabel(tile)} into denominator on ${target}`;
    btn.addEventListener("click", () => moveMultiplicativeFactorAcross(tile.id));
    multiplicativeButtons.appendChild(btn);
  });

  const literalCandidates = getLiteralFactorMoveCandidates(model);

  literalCandidates.forEach(({ tile, factor, factorIndex, side }) => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    const target = oppositeSide(side);
    btn.innerHTML = `Move symbolic factor <strong>${factor.display || factor.raw}</strong> into denominator on ${target}`;
    btn.addEventListener("click", () => moveLiteralFactorAcross(tile.id, factorIndex));
    multiplicativeButtons.appendChild(btn);
  });

  const denominatorCandidates = getDenominatorCrossingCandidates(model);

  denominatorCandidates.forEach(({ tile, denominator, targetSide }) => {
    const btn = document.createElement("button");
    btn.className = "move-action";
    const factorLabel = factorReadableLabel(denominator);
    btn.innerHTML = `Move denominator <strong>${factorLabel}</strong> from ${tileReadableLabel(tile)} into numerator on ${targetSide}`;
    btn.addEventListener("click", () => moveDenominatorAcross(tile.id));
    multiplicativeButtons.appendChild(btn);
  });
}


function renderGroupButtons(model) {
  groupButtons.innerHTML = "";

  // v1.2.6: left-side whole-parentheses wrapping was removed from the
  // student interface because it was unnecessary and visually confusing.
  if (!model || !model.boundary) return;

  const side = "right";
  const tiles = model.sides[side];

  if (tiles && tiles.length > 1) {
    const btn = document.createElement("button");
    btn.className = "move-action";
    btn.innerHTML = `Add parentheses around <strong>right</strong> side`;
    btn.addEventListener("click", () => groupWholeSide(side));
    groupButtons.appendChild(btn);
  }
}

function renderTransformations(items) {
  transformations.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = `transform ${item.state}`;
    if (item.state === "locked") div.classList.add("locked");
    div.innerHTML = `<strong>${item.name}</strong><span>${item.state}</span><br><small>${item.reason}</small>`;
    transformations.appendChild(div);
  });
}

function renderHistory() {
  historyList.innerHTML = "";
  if (!history.length) {
    const li = document.createElement("li");
    li.textContent = "No transformations yet.";
    historyList.appendChild(li);
    return;
  }

  history.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    historyList.appendChild(li);
  });
}


function retagTileForSide(tile, side, index, label = "add-both") {
  return withComputedFlags({
    ...structuredClone(tile),
    id: `${side}-${label}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    side,
    parentId: null
  });
}

function parseSingleTileForSide(rawTileText, side) {
  const text = normalizeInput(rawTileText || "").trim();

  if (!text) {
    throw new Error("Enter one tile to add.");
  }

  const tiles = parseSide(text, side).filter(tile => !isZeroTile(tile) || text === "0" || text === "+0" || text === "-0");

  if (tiles.length !== 1) {
    throw new Error("Add-to-both-sides expects one tile. Use parentheses if you want one grouped tile, like (x+2).");
  }

  return retagTileForSide(tiles[0], side, 0, "added");
}

function addTileToBothSides() {
  if (!currentModel || !currentModel.boundary) {
    setMessage("Add-to-both-sides requires an equation or inequality boundary.", "warn");
    return;
  }

  const rawTileText = addBothInput.value.trim();

  try {
    const leftTile = parseSingleTileForSide(rawTileText, "left");
    const rightTile = parseSingleTileForSide(rawTileText, "right");

    const newLeft = cleanupZeroPlaceholders([...currentModel.sides.left, leftTile]);
    const newRight = cleanupZeroPlaceholders([...currentModel.sides.right, rightTile]);

    currentModel = cleanupModelZeros({
      ...currentModel,
      sides: {
        left: newLeft,
        right: newRight
      },
      lastTransformation: `Added ${rawTileText} to both sides`
    });

    clearSelection();
    currentBranches = [];
    history.push(`Added tile ${rawTileText} to both sides without combining.`);
    setMessage(`Added ${rawTileText} to both sides. Use Combine Like Terms when you want the tiles to merge.`, "good");
    renderModel(currentModel);
  } catch (err) {
    setMessage(err.message, "warn");
  }
}


function parsePowerInput(rawPowerText) {
  const text = normalizeInput(rawPowerText || "").trim();

  if (!text) {
    throw new Error("Enter a power such as 2, 1/2, 3/2, or -1.");
  }

  if (text.includes("/")) {
    const parts = text.split("/");
    if (parts.length !== 2) {
      throw new Error("Use one fraction bar for fractional powers, like 1/2 or 3/2.");
    }

    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);

    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
      throw new Error("Fractional powers must use integer numerator and nonzero denominator.");
    }

    const sign = denominator < 0 ? -1 : 1;
    const n = numerator * sign;
    const d = Math.abs(denominator);
    const g = gcd(Math.abs(n), Math.abs(d));

    return {
      numerator: n / g,
      denominator: d / g
    };
  }

  const whole = Number(text);

  if (!Number.isInteger(whole)) {
    throw new Error("Use an integer power or a fraction like 1/2.");
  }

  return {
    numerator: whole,
    denominator: 1
  };
}

function powerDisplay(power) {
  if (!power) return "";
  if (power.denominator === 1) return String(power.numerator);
  return `${power.numerator}/${power.denominator}`;
}

function powerSupDisplay(power) {
  if (!power) return "";
  if (power.denominator === 1) {
    const superscripts = {
      "0": "⁰",
      "1": "¹",
      "2": "²",
      "3": "³",
      "4": "⁴",
      "5": "⁵",
      "6": "⁶",
      "7": "⁷",
      "8": "⁸",
      "9": "⁹",
      "-": "⁻"
    };
    return String(power.numerator).split("").map(ch => superscripts[ch] || ch).join("");
  }

  return `^(${power.numerator}/${power.denominator})`;
}

function makePowerShellTile({ side, baseTiles, power }) {
  const baseRaw = sideExpressionDisplay(baseTiles);
  const baseDisplay = baseRaw;
  const display = `(${baseDisplay})${powerSupDisplay(power)}`;

  return withComputedFlags({
    id: `${side}-power-shell-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `(${baseRaw})^(${powerDisplay(power)})`,
    display,
    kind: "powerShell",
    identity: "power-shell",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: {
      numerator: power.numerator,
      denominator: power.denominator
    },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: structuredClone(baseTiles),
    structureType: "powerShell",
    baseRaw,
    baseDisplay,
    power: structuredClone(power),
    notes: [
      `The entire ${side} side was raised to the power ${powerDisplay(power)}.`,
      "This is a structure shell. It does not distribute, simplify, or branch automatically."
    ]
  });
}

function raiseBothSidesToPower() {
  if (!currentModel || currentModel.boundary !== "=") {
    setMessage("Raising both sides to a power is currently enabled for equations only.", "warn");
    return;
  }

  try {
    const power = parsePowerInput(powerBothInput.value);
    const leftPowerTile = makePowerShellTile({
      side: "left",
      baseTiles: currentModel.sides.left,
      power
    });

    const rightPowerTile = makePowerShellTile({
      side: "right",
      baseTiles: currentModel.sides.right,
      power
    });

    currentModel = cleanupModelZeros({
      ...currentModel,
      sides: {
        left: [leftPowerTile],
        right: [rightPowerTile]
      },
      lastTransformation: `Raised both sides to power ${powerDisplay(power)}`
    });

    clearSelection();
    currentBranches = [];
    history.push(`Raised both sides to power ${powerDisplay(power)}.`);
    setMessage(`Both sides raised to power ${powerDisplay(power)} as a structure move.`, "good");
    renderModel(currentModel);
  } catch (err) {
    setMessage(err.message, "warn");
  }
}


function multiplyPowers(a, b) {
  const n = a.numerator * b.numerator;
  const d = a.denominator * b.denominator;
  const g = gcd(Math.abs(n), Math.abs(d));

  return {
    numerator: n / g,
    denominator: d / g
  };
}

function powerEquals(power, numerator, denominator = 1) {
  return power &&
    power.numerator === numerator &&
    power.denominator === denominator;
}

function powerShellHasSquaredBinomialBase(tile) {
  return tile &&
    tile.kind === "powerShell" &&
    tile.children &&
    tile.children.length === 1 &&
    tile.children[0].kind === "squaredBinomial" &&
    tile.children[0].baseFactor;
}

function makePowerProductTile({ side, powerShellTile }) {
  const squaredTile = powerShellTile.children[0];
  const baseFactor = structuredClone(squaredTile.baseFactor);
  const innerPower = { numerator: 2, denominator: 1 };
  const outerPower = structuredClone(powerShellTile.power);

  return withComputedFlags({
    id: `${side}-power-product-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `(${baseFactor.raw})^(${powerDisplay(innerPower)}*${powerDisplay(outerPower)})`,
    display: `(${baseFactor.display})^(${powerDisplay(innerPower)}·${powerDisplay(outerPower)})`,
    kind: "powerProduct",
    identity: "power-product",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: multiplyPowers(innerPower, outerPower),
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [],
    structureType: "powerProduct",
    baseFactor,
    innerPower,
    outerPower,
    notes: [
      `Power-to-power structure revealed: (${baseFactor.display})² raised to ${powerDisplay(outerPower)}.`,
      `Power multiplication shown as ${powerDisplay(innerPower)}·${powerDisplay(outerPower)}.`
    ]
  });
}

function getPowerMultiplicationRevealCandidates(model = currentModel) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!model.sides[side]) continue;

    model.sides[side].forEach((tile, index) => {
      if (powerShellHasSquaredBinomialBase(tile)) {
        candidates.push({ side, index, tile });
      }
    });
  }

  return candidates;
}

function revealPowerMultiplication(index) {
  const candidates = getPowerMultiplicationRevealCandidates();
  const candidate = candidates[index];

  if (!candidate) {
    setMessage("No power-to-power structure is ready to reveal.", "warn");
    return;
  }

  const productTile = makePowerProductTile({
    side: candidate.side,
    powerShellTile: candidate.tile
  });

  const newSideTiles = currentModel.sides[candidate.side].map(tile =>
    tile.id === candidate.tile.id ? productTile : tile
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (candidate.side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Reveal Power Multiplication"
  });

  clearSelection();
  history.push(`Revealed power multiplication as ${productTile.display}.`);
  setMessage("Power-to-power multiplication is now visible. Next combine the multiplied powers.", "good");
  renderModel(currentModel);
}


function originalPowerWasEvenRootOfEvenPower(sourceTile) {
  if (!sourceTile || sourceTile.kind !== "powerProduct") return false;

  return sourceTile.innerPower &&
    sourceTile.outerPower &&
    sourceTile.innerPower.denominator === 1 &&
    Math.abs(sourceTile.innerPower.numerator) % 2 === 0 &&
    sourceTile.outerPower.denominator % 2 === 0;
}

function makeAbsoluteValueTileFromBaseFactor({ side, baseFactor, sourceTile }) {
  const baseRaw = baseFactor.raw;
  const baseDisplay = baseFactor.display || baseFactor.raw;
  const innerTiles = parseSide(baseRaw, side);

  return withComputedFlags({
    id: `${side}-absolute-from-even-root-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `|${baseRaw}|`,
    display: `|${baseDisplay}|`,
    kind: "absolute",
    identity: "absolute-value",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: { numerator: 1, denominator: 1 },
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: innerTiles,
    childrenRaw: baseRaw,
    structureType: "absolute",
    notes: [
      `Even root of an even power creates absolute value: ((${baseDisplay})²) = |${baseDisplay}|.`,
      "This preserves the plus/minus behavior for the next branch step."
    ]
  });
}



function makeTileFromBaseFactorAndPower({ side, baseFactor, power, sourceTile = null }) {
  const baseRaw = baseFactor.raw;
  const baseDisplay = baseFactor.display || baseFactor.raw;

  if (powerEquals(power, 1, 1)) {
    const parsed = parseSide(baseRaw, side);

    if (parsed.length === 1) {
      const collapsed = retagTileForSide(parsed[0], side, 0, "power-one-collapse");
      collapsed.notes = [
        ...(collapsed.notes || []),
        "Power product simplified to power 1, so the variable-side structure collapsed to the base.",
        "The plus/minus behavior belongs on the number side for this solving path."
      ];
      return collapsed;
    }

    return withComputedFlags({
      id: `${side}-power-one-group-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      raw: baseRaw,
      display: `(${baseDisplay})`,
      kind: "composite",
      identity: `(${baseRaw})`,
      additiveCharge: "+",
      additiveCount: 1,
      multiplicativeCompletion: { numerator: 1, denominator: 1 },
      multiplicativePosition: "numerator",
      side,
      parentId: null,
      children: parsed,
      childrenRaw: baseRaw,
      structureType: "group",
      notes: [
        "Power product simplified to power 1, so the variable-side structure collapsed to the base.",
        "The plus/minus behavior belongs on the number side for this solving path."
      ]
    });
  }

  return withComputedFlags({
    id: `${side}-combined-power-shell-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `(${baseRaw})^(${powerDisplay(power)})`,
    display: `(${baseDisplay})${powerSupDisplay(power)}`,
    kind: "powerShell",
    identity: "power-shell",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: structuredClone(power),
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: parseSide(baseRaw, side),
    structureType: "powerShell",
    baseRaw,
    baseDisplay,
    power: structuredClone(power),
    notes: [
      `Power multiplication simplified to ${powerDisplay(power)}.`
    ]
  });
}

function getPowerProductCombineCandidates(model = currentModel) {
  if (!model) return [];

  const candidates = [];

  for (const side of getCandidateSidesForFactoring(model)) {
    if (!model.sides[side]) continue;

    model.sides[side].forEach((tile, index) => {
      if (tile.kind === "powerProduct" && tile.innerPower && tile.outerPower && tile.baseFactor) {
        candidates.push({ side, index, tile });
      }
    });
  }

  return candidates;
}

function combinePowerMultiplication(index) {
  const candidates = getPowerProductCombineCandidates();
  const candidate = candidates[index];

  if (!candidate) {
    setMessage("No visible power product is ready to combine.", "warn");
    return;
  }

  const combinedPower = multiplyPowers(candidate.tile.innerPower, candidate.tile.outerPower);
  const simplifiedTile = makeTileFromBaseFactorAndPower({
    side: candidate.side,
    baseFactor: candidate.tile.baseFactor,
    power: combinedPower,
    sourceTile: candidate.tile
  });

  const newSideTiles = currentModel.sides[candidate.side].map(tile =>
    tile.id === candidate.tile.id ? simplifiedTile : tile
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: currentModel.boundary ? (candidate.side === "right" ? newSideTiles : currentModel.sides.right) : []
    },
    lastTransformation: "Combine Power Multiplication"
  });

  clearSelection();
  history.push(`Combined powers ${powerDisplay(candidate.tile.innerPower)}·${powerDisplay(candidate.tile.outerPower)} = ${powerDisplay(combinedPower)}.`);
  setMessage(`Power multiplication combined to ${powerDisplay(combinedPower)}. Variable side can stay as the base; put ± on the number side.`, "good");
  renderModel(currentModel);
}


function powerIsEvenRoot(power) {
  return power && power.denominator && Math.abs(power.denominator) % 2 === 0;
}

function isNumericPowerShell(tile) {
  return tile &&
    tile.kind === "powerShell" &&
    tile.children &&
    tile.children.length === 1 &&
    rationalFromConstantLikeTile(tile.children[0]) !== null &&
    tile.power;
}

function numericValueFromPowerShell(tile) {
  if (!isNumericPowerShell(tile)) return null;
  return rationalFromConstantLikeTile(tile.children[0]);
}

function numberPowerBaseDisplay(tile) {
  if (tile.baseDisplay) return tile.baseDisplay;
  if (tile.baseRaw) return tile.baseRaw;
  return sideExpressionDisplay(tile.children || []);
}

function makePlusMinusTileFromPowerShell({ side, powerShellTile }) {
  const baseDisplay = numberPowerBaseDisplay(powerShellTile);
  const magnitudeDisplay = `${baseDisplay}${powerSupDisplay(powerShellTile.power)}`;

  return withComputedFlags({
    id: `${side}-plus-minus-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `±(${baseDisplay})^(${powerDisplay(powerShellTile.power)})`,
    display: `±${magnitudeDisplay}`,
    kind: "plusMinus",
    identity: "plus-minus",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: structuredClone(powerShellTile.power),
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: structuredClone(powerShellTile.children || []),
    structureType: "plusMinus",
    magnitudeRaw: powerShellTile.raw,
    magnitudeDisplay,
    magnitudePower: structuredClone(powerShellTile.power),
    notes: [
      `Even root on the number side creates two possibilities: +${magnitudeDisplay} and -${magnitudeDisplay}.`,
      "No square-root symbol is used; the magnitude stays as a fractional exponent."
    ]
  });
}

function getPlusMinusNumberSideCandidates(model = currentModel) {
  if (!model || model.boundary !== "=") return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    model.sides[side].forEach((tile, index) => {
      if (!isNumericPowerShell(tile) || !powerIsEvenRoot(tile.power)) return;

      const value = numericValueFromPowerShell(tile);
      if (!value) return;

      if (value.numerator < 0) {
        candidates.push({
          side,
          index,
          tile,
          state: "imaginary",
          reason: "Even fractional power of a negative number can reveal an i-extension."
        });
      } else {
        candidates.push({
          side,
          index,
          tile,
          state: "available"
        });
      }
    });
  }

  return candidates;
}

function revealPlusMinusNumberSide(index) {
  const candidates = getPlusMinusNumberSideCandidates().filter(c => c.state === "available");
  const candidate = candidates[index];

  if (!candidate) {
    setMessage("No positive numeric even-root power is ready to become ±.", "warn");
    return;
  }

  const pmTile = makePlusMinusTileFromPowerShell({
    side: candidate.side,
    powerShellTile: candidate.tile
  });

  const newSideTiles = currentModel.sides[candidate.side].map(tile =>
    tile.id === candidate.tile.id ? pmTile : tile
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: candidate.side === "right" ? newSideTiles : currentModel.sides.right
    },
    lastTransformation: "Reveal Plus-Minus on Number Side"
  });

  clearSelection();
  history.push(`Revealed number-side plus/minus as ${pmTile.display}.`);
  setMessage(`Number side is now ${pmTile.display}. Fractional exponent notation preserved.`, "good");
  renderModel(currentModel);
}

function makeImaginaryPlusMinusTileFromPowerShell({ side, powerShellTile }) {
  const value = numericValueFromPowerShell(powerShellTile);
  const absValue = Math.abs(value.numerator);
  const baseDisplay = String(absValue);
  const magnitudeDisplay = `i·${baseDisplay}${powerSupDisplay(powerShellTile.power)}`;

  const positiveBase = makeConstantTile({
    side,
    index: 0,
    signedAdditiveCount: absValue
  });

  return withComputedFlags({
    id: `${side}-imaginary-plus-minus-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: `±i*(${baseDisplay})^(${powerDisplay(powerShellTile.power)})`,
    display: `±${magnitudeDisplay}`,
    kind: "plusMinus",
    identity: "plus-minus",
    additiveCharge: "+",
    additiveCount: 1,
    multiplicativeCompletion: structuredClone(powerShellTile.power),
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: [positiveBase],
    structureType: "plusMinusImaginary",
    magnitudeRaw: `i*(${baseDisplay})^(${powerDisplay(powerShellTile.power)})`,
    magnitudeDisplay,
    magnitudePower: structuredClone(powerShellTile.power),
    includesImaginaryUnit: true,
    notes: [
      `Negative number under an even fractional power reveals imaginary unit i.`,
      `No square-root symbol is used: ±${magnitudeDisplay}.`
    ]
  });
}

function revealImaginaryPlusMinusNumberSide(index) {
  const candidates = getPlusMinusNumberSideCandidates().filter(c => c.state === "imaginary");
  const candidate = candidates[index];

  if (!candidate) {
    setMessage("No negative numeric even-root power is ready to reveal an i-extension.", "warn");
    return;
  }

  const pmTile = makeImaginaryPlusMinusTileFromPowerShell({
    side: candidate.side,
    powerShellTile: candidate.tile
  });

  const newSideTiles = currentModel.sides[candidate.side].map(tile =>
    tile.id === candidate.tile.id ? pmTile : tile
  );

  currentModel = cleanupModelZeros({
    ...currentModel,
    sides: {
      left: candidate.side === "left" ? newSideTiles : currentModel.sides.left,
      right: candidate.side === "right" ? newSideTiles : currentModel.sides.right
    },
    lastTransformation: "Reveal Imaginary Plus-Minus on Number Side"
  });

  clearSelection();
  history.push(`Revealed imaginary number-side plus/minus as ${pmTile.display}.`);
  setMessage(`Imaginary extension revealed as ${pmTile.display}. Fractional exponent notation preserved.`, "good");
  renderModel(currentModel);
}

function makePlusMinusMagnitudeTile(pmTile, side, sign, label) {
  return withComputedFlags({
    id: `${side}-pm-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    raw: pmTile.magnitudeRaw || pmTile.raw,
    display: pmTile.magnitudeDisplay || pmTile.display.replace(/^±/, ""),
    kind: pmTile.includesImaginaryUnit ? "imaginaryRoot" : "powerShell",
    identity: pmTile.includesImaginaryUnit ? "imaginary-root" : "power-shell",
    additiveCharge: sign,
    additiveCount: 1,
    multiplicativeCompletion: structuredClone(pmTile.magnitudePower || pmTile.multiplicativeCompletion || { numerator: 1, denominator: 1 }),
    multiplicativePosition: "numerator",
    side,
    parentId: null,
    children: structuredClone(pmTile.children || []),
    structureType: pmTile.includesImaginaryUnit ? "imaginaryRoot" : "powerShell",
    power: structuredClone(pmTile.magnitudePower || pmTile.multiplicativeCompletion || { numerator: 1, denominator: 1 }),
    baseRaw: pmTile.magnitudeRaw,
    baseDisplay: pmTile.magnitudeDisplay,
    magnitudeDisplay: pmTile.magnitudeDisplay,
    notes: [
      sign === "+" ? "Positive plus/minus branch." : "Negative plus/minus branch."
    ]
  });
}

function getPlusMinusSplitCandidates(model = currentModel) {
  if (!model || model.boundary !== "=") return [];

  const candidates = [];

  for (const side of ["left", "right"]) {
    model.sides[side].forEach((tile, index) => {
      if (tile.kind === "plusMinus") {
        candidates.push({ side, index, tile });
      }
    });
  }

  return candidates;
}

function makePlusMinusBranchModels(candidate) {
  const { side, index, tile } = candidate;

  const makeBranchSides = (sign, label) => {
    const leftTiles = currentModel.sides.left.map((t, i) =>
      side === "left" && i === index
        ? makePlusMinusMagnitudeTile(tile, "left", sign, label)
        : withComputedFlags({
            ...structuredClone(t),
            id: `left-pm-${label}-${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`,
            side: "left",
            parentId: null
          })
    );

    const rightTiles = currentModel.sides.right.map((t, i) =>
      side === "right" && i === index
        ? makePlusMinusMagnitudeTile(tile, "right", sign, label)
        : withComputedFlags({
            ...structuredClone(t),
            id: `right-pm-${label}-${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`,
            side: "right",
            parentId: null
          })
    );

    return {
      left: leftTiles,
      right: rightTiles
    };
  };

  return [
    {
      title: "Plus Branch",
      note: "Replace ± with +.",
      model: cleanupModelZeros({
        raw: "plus branch",
        normalized: "",
        type: "relation",
        boundary: "=",
        sides: makeBranchSides("+", "plus"),
        lastTransformation: "Plus-Minus Split: Plus Branch"
      })
    },
    {
      title: "Minus Branch",
      note: "Replace ± with -.",
      model: cleanupModelZeros({
        raw: "minus branch",
        normalized: "",
        type: "relation",
        boundary: "=",
        sides: makeBranchSides("-", "minus"),
        lastTransformation: "Plus-Minus Split: Minus Branch"
      })
    }
  ];
}

function splitPlusMinus(candidateIndex) {
  const candidates = getPlusMinusSplitCandidates();
  const candidate = candidates[candidateIndex];

  if (!candidate) {
    setMessage("No plus/minus tile is ready to split.", "warn");
    return;
  }

  currentBranches = makePlusMinusBranchModels(candidate);
  history.push(`Split ${candidate.tile.display} into plus and minus branches.`);
  setMessage("Plus/minus branches created. Load a branch to keep solving.", "good");
  renderModel(currentModel);
}



function renderModel(model) {
  tileView.innerHTML = "";

  if (model.boundary) {
    tileView.appendChild(renderSide("Left Side", model.sides.left));
    tileView.appendChild(renderBoundary(model.boundary));
    tileView.appendChild(renderSide("Right Side", model.sides.right));
  } else {
    tileView.appendChild(renderSide("Expression", model.sides.left));
  }

  const detected = detectTransformations(model);
  renderTransformations(detected);
  renderMoveButtons(model);
  renderMultiplicativeButtons(model);
  renderGroupButtons(model);
  renderAbsoluteButtons(model);
  renderQuadraticButtons(model);
  renderBranches();
  renderHistory();
  debugOutput.textContent = JSON.stringify(model, null, 2);

  toggleOnesBtn.textContent = showHiddenOnes ? "Hide Hidden /1s" : "Reveal Hidden /1s";

  const expandState = detected.find(t => t.name === "Expand")?.state;
  expandBtn.disabled = expandState !== "available";

  const removeState = detected.find(t => t.name === "Remove Parentheses")?.state;
  if (removeParenthesesBtn) removeParenthesesBtn.disabled = removeState !== "available";

  const combineState = detected.find(t => t.name === "Combine Like Terms")?.state;
  combineBtn.disabled = combineState !== "available";

  const revealFactorsState = detected.find(t => t.name === "Reveal Common Factors")?.state;
  revealFactorsBtn.disabled = revealFactorsState !== "available";

  const cancelFactorsState = detected.find(t => t.name === "Cancel Revealed Factors")?.state;
  cancelFactorsBtn.disabled = cancelFactorsState !== "available";

  addBothBtn.disabled = !model.boundary;
  powerBothBtn.disabled = model.boundary !== "=";
}

function setMessage(text, tone = "") {
  message.textContent = text;
  message.className = `message ${tone}`;
}

function parseAndRender() {
  try {
    currentModel = parseMath(input.value);
    history = [];
    currentBranches = [];
    clearSelection();
    setMessage("Parsed successfully. Boundary crossing buttons are available when legal.", "good");
    renderModel(currentModel);
  } catch (err) {
    currentModel = null;
    tileView.innerHTML = `<div class="side"><strong>Parser error:</strong> ${err.message}</div>`;
    transformations.innerHTML = "";
    moveButtons.innerHTML = "";
    multiplicativeButtons.innerHTML = "";
    groupButtons.innerHTML = "";
    absoluteButtons.innerHTML = "";
    quadraticButtons.innerHTML = "";
    branchView.innerHTML = "";
    historyList.innerHTML = "";
    expandBtn.disabled = true;
    if (removeParenthesesBtn) removeParenthesesBtn.disabled = true;
    combineBtn.disabled = true;
    revealFactorsBtn.disabled = true;
    cancelFactorsBtn.disabled = true;
    addBothBtn.disabled = true;
    powerBothBtn.disabled = true;
    setMessage("Parser error. Try a simpler expression.", "warn");
    debugOutput.textContent = String(err.stack || err);
  }
}

parseBtn.addEventListener("click", parseAndRender);
toggleOnesBtn.addEventListener("click", toggleHiddenOnes);
expandBtn.addEventListener("click", expandCompositeTiles);
if (removeParenthesesBtn) removeParenthesesBtn.addEventListener("click", removeUnneededParentheses);
combineBtn.addEventListener("click", combineLikeTerms);
revealFactorsBtn.addEventListener("click", revealCommonFactors);
cancelFactorsBtn.addEventListener("click", cancelRevealedFactors);
addBothBtn.addEventListener("click", addTileToBothSides);
powerBothBtn.addEventListener("click", raiseBothSidesToPower);
if (literalModeToggle) {
  literalModeToggle.addEventListener("change", () => {
    literalMode = literalModeToggle.checked;
    parseAndRender();
  });
}

input.addEventListener("keydown", event => {
  if (event.key === "Enter") parseAndRender();
});

addBothInput.addEventListener("keydown", event => {
  if (event.key === "Enter") addTileToBothSides();
});

powerBothInput.addEventListener("keydown", event => {
  if (event.key === "Enter") raiseBothSidesToPower();
});

document.querySelectorAll(".example").forEach(btn => {
  btn.addEventListener("click", () => {
    input.value = btn.dataset.expression;
    parseAndRender();
  });
});

parseAndRender();

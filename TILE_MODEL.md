# Tileify Tile Model v1.1.3

Every visible term becomes a tile object.

## Core tile properties

```js
Tile {
  id,

  kind,
  identity,

  additiveCharge,
  additiveCount,

  multiplicativeCompletion,
  multiplicativePosition,

  side,

  parentId,
  children,
  structureType,

  likeSignature,

  isAtomic,
  isMovable,
  isIsolated
}
```

## v0.3 transformation rule

### Additive Boundary Crossing

If a tile crosses the boundary as an additive object:

```txt
additiveCharge flips
side changes
```

Examples:

```txt
+5 on left  ->  -5 on right
-4 on left  ->  +4 on right
+2x on right -> -2x on left
```

The boundary itself does not change during additive crossing.

For inequalities, the boundary only flips during negative multiplicative crossing, which is not part of v0.3 yet.


## v0.3.1 zero rule

A zero tile may appear as a placeholder when one side of a relation becomes empty.

However:

```txt
0 + A
```

is not a valid visible collection.

If any nonzero tile appears on the same side, the zero placeholder is automatically removed.


## v0.4 multiplicative crossing rule

If an isolated variable tile has an additive count greater than 1, that count may cross the boundary as a multiplicative factor.

```txt
3x = 15
```

becomes

```txt
x = 15/3
```

Internally:

- source tile additiveCount changes from 3 to 1
- target side becomes a fraction structure
- crossed factor becomes a denominator-position constant

If the crossed factor is negative and the boundary is an inequality, the boundary reverses direction automatically.


## v0.4.1 factor cancellation rule

Tileify does not simplify fractions by invisible division.

Instead, it reveals matching multiplicative structure.

Example:

```txt
15/3
```

becomes structurally:

```txt
(5*3)/(1*3)
```

The matching `3` factor in numerator and denominator cancels.

The remaining structure is:

```txt
5/1
```

This matters because the denominator position does not vanish magically; it is completed by the `1` tile.


## v0.4.2 negative factor rule

When an isolated tile has a negative additive count, the sign is part of the multiplicative factor that crosses.

Example:

```txt
-3x < 12
```

The crossing factor is:

```txt
-3
```

The remaining isolated variable is:

```txt
+x
```

not

```txt
-x
```

The inequality boundary flips because a negative multiplicative factor crossed the boundary.


## v0.5 parenthetical group rule

A parenthetical expression is a composite tile.

Example:

```txt
3(x + 2)
```

Hidden structure:

```js
kind: "composite"
identity: "(x+2)"
additiveCount: 3
structureType: "group"
childrenRaw: "x+2"
```

The additive count tells Tileify how many copies of the inside structure exist.

## Expansion rule

Expansion reveals those copies.

```txt
3(x+2)
```

reveals:

```txt
x + 2 + x + 2 + x + 2
```

If the parent composite tile has negative additive charge, each child tile's additive charge flips during expansion.


## v0.5.1 canonical group order rule

Tileify accepts either order:

```txt
4(x+2)
(x+2)4
```

but internally stores both as:

```txt
4(x+2)
```

The constant/additive count comes first because it represents how many copies of the parenthetical composite tile exist.


## v0.5.2 composite display rule

A composite tile's visible label must include its additive count.

Example hidden structure:

```js
kind: "composite"
additiveCount: 4
childrenRaw: "x+2"
```

Visible label:

```txt
+4(x+2)
```

not:

```txt
+(x+2)
```


## v0.6 composite factor crossing rule

If an isolated parenthetical composite tile has additive count greater than 1, the outside factor may cross the boundary as a denominator-position factor.

Example:

```txt
4(x+2)=20
```

can become:

```txt
(x+2)=20/4
```

Internally:

- source composite additiveCount changes from 4 to 1
- source composite additiveCharge becomes positive
- target side becomes a fraction structure
- crossed factor becomes a denominator-position constant

This gives the student two legal approaches:

1. Expand the composite tile.
2. Move the outside factor across the boundary.


## v0.7 hidden denominator rule

All visible tiles have an implied denominator-position `1`.

Normal view may hide it:

```txt
x
```

Structure view may reveal it:

```txt
x/1
```

This is a display choice. It does not change the hidden tile object.

## v0.7 parentheses tools

### Remove Parentheses

A single composite group with additive count 1 may unwrap into its internal additive tiles.

```txt
(x+2) -> x + 2
```

### Add Parentheses

A side with multiple tiles may be grouped into one composite tile.

```txt
x + 2 -> (x+2)
```

This does change the visible structure, but preserves the mathematical object.


## v0.7.1 fraction sign rule

When a signed multiplicative factor crosses the boundary, the sign of the new fraction comes from both:

- the numerator-side sign
- the denominator/crossed-factor sign

Examples:

```txt
12 / -3  -> negative fraction
-12 / 3  -> negative fraction
-12 / -3 -> positive fraction
```

The app now folds these signs into the fraction tile charge instead of leaving a false negative charge.


## v0.8 denominator crossing rule

A fraction tile has numerator-position and denominator-position children.

Example:

```txt
3/x = 9
```

The denominator child is:

```txt
x
```

When it crosses the relation boundary, it moves into numerator position on the opposite side:

```txt
3/1 = 9x
```

This is the reciprocal movement to the earlier rule where an outside numerator-position factor crosses and becomes a denominator-position factor on the other side.

For inequalities, moving a variable denominator requires branch/condition logic and is not unlocked yet.


## v0.8.1 rational constant normalization

Every constant-like tile is treated as a rational structure during combination.

Examples:

```txt
5       -> 5/1
-2      -> -2/1
5/1 - 2 -> 3/1
```

This means a visible constant tile and a numeric fraction tile with denominator `1` are no longer different types for combining.

The denominator should normalize positive whenever possible:

```txt
5/-1 -> -5/1
-5/-1 -> 5/1
```

The sign belongs to the numerator/fraction charge, not the denominator `1`.


## v0.8.2 nested fraction flattening

A fraction should not become the numerator child of another fraction when the structure is numeric.

Bad structure:

```txt
(14/1)/4
```

Flattened structure:

```txt
14/(1*4)
```

Displayed structure:

```txt
14/4
```

This keeps all constants behaving as rational structures instead of nested fraction boxes.


## v0.8.3 structural movement rule

Boundary movement creates structure. It does not perform arithmetic division.

Example:

```txt
7x = 18
```

Moving the `7` creates:

```txt
x = 18/7
```

The engine must not check divisibility or reduce automatically.

Flattening also preserves structure:

```txt
(14/1)/4 -> 14/4
```

not:

```txt
7/2
```

Cancellation is a separate transformation.


## v0.9 absolute value split rule

An absolute-value tile can split only when it is isolated.

Example isolated form:

```txt
|A| = B
```

Split branches:

```txt
A = B
A = -B
```

Tileify interpretation:

- The absolute-value shell is removed.
- The inside structure becomes the left branch structure.
- The original other side stays as the positive branch.
- The original other side is negated for the negative branch.

If the absolute-value tile is not alone on one side, split remains locked.


## v0.9.1 reveal before cancel rule

Fraction simplification is now two transformations.

### Reveal

```txt
15/3 -> (5·3)/(1·3)
```

This only reveals shared multiplicative structure.

### Cancel

```txt
(5·3)/(1·3) -> 5/1
```

This removes the matching numerator/denominator factor.

The app should not hide these as one step.


## v1.0 quadratic factoring rule

A monic quadratic trinomial equal to zero can reveal a product structure.

Example:

```txt
x^2 + 5x + 6 = 0
```

Hidden factor pair:

```txt
2 + 3 = 5
2 · 3 = 6
```

Revealed structure:

```txt
(x + 2)(x + 3) = 0
```

This creates a product tile with two factor children:

```js
kind: "product"
structureType: "quadraticProduct"
factors: ["x+2", "x+3"]
```

## v1.0 zero-product split rule

If a product tile equals zero, it can split into branches.

```txt
(A)(B) = 0
```

becomes:

```txt
A = 0
B = 0
```

Each branch is loaded as its own equation so the existing linear tools can solve it.


## v1.0.1 stepwise quadratic factoring

Quadratic factoring should not jump directly to the product tile.

The required Tileify sequence is:

```txt
x^2 + 5x + 6
```

Split:

```txt
x^2 + 2x + 3x + 6
```

Group:

```txt
(x^2 + 2x) + (3x + 6)
```

Factor each group:

```txt
x(x + 2) + 3(x + 2)
```

Reveal common binomial:

```txt
(x + 2)(x + 3)
```

Then split zero product when equal to zero.


## v1.0.2 selection-based factoring

Factoring is now driven by highlighted tile structure.

Selection states do not change the math object. They only tell the app which structure the student wants to inspect.

Valid selections:

```txt
x^2 and 2x -> group -> (x^2 + 2x)
3x and 6 -> group -> (3x + 6)
(x^2 + 2x) -> reveal factor -> x(x + 2)
(3x + 6) -> reveal factor -> 3(x + 2)
x(x + 2), 3(x + 2) -> reveal common binomial -> (x + 2)(x + 3)
```

This is closer to Tileify's philosophy: the student highlights structure and the app reveals the factor if it exists.


## v1.0.3 expression factoring

Factoring does not require an equation. It can operate on expression structure.

```txt
x^2 + 5x + 6
```

may reveal:

```txt
(x + 2)(x + 3)
```

without needing an equality boundary.

## v1.0.3 number factor reveal

A constant tile can reveal a selected factor structure.

```txt
6 -> 2·3
6 -> 3·2
6 -> 6·1
```

This creates a `factoredNumber` tile.

```js
kind: "factoredNumber"
structureType: "numberProduct"
factorParts: [2, 3]
```

This is a structural reveal, not evaluation.


## v1.0.4 expression group factor fix

A grouped expression tile may reveal its factor even when no equation boundary exists.

```txt
(x^2 + 2x) -> x(x + 2)
```

The zero side check is only required for zero-product splitting, not for expression factoring.


## v1.0.5 add-to-both-sides rule

A typed additive tile can be appended to both sides of a relation.

```txt
A = B
```

Add tile `T`:

```txt
A + T = B + T
```

No crossing occurs and no automatic combining occurs. It is a balancing construction.

This is valid for equation solving and for future completing-square behavior.


## v1.0.6 selected trinomial factor rule

A selected three-term monic trinomial can reveal factor structure.

```txt
x^2 - 8x + 16
```

has factor pair:

```txt
-4 and -4
```

So the selected structure can become:

```txt
(x - 4)(x - 4)
```

This is allowed inside an equation, inequality, or expression because it is a structure reveal, not a zero-product split.


## v1.0.7 factoring versus zero-product splitting

Factoring is a structure reveal and can happen on either side of an equation.

```txt
x^2 - 8x + 16 = 20
```

may become:

```txt
(x - 4)(x - 4) = 20
```

Zero-product branching is different:

```txt
(A)(B) = 0
```

is the only case where the product may split into:

```txt
A = 0
B = 0
```


## v1.0.8 repeated binomial square rule

A product tile with identical binomial factors can reveal a squared-binomial structure.

```txt
(A)(A) -> (A)^2
```

Example:

```txt
(x - 4)(x - 4) -> (x - 4)^2
```

Tile model:

```js
kind: "squaredBinomial"
structureType: "squaredBinomial"
baseFactor: { raw: "x-4", display: "x - 4" }
multiplicativeCompletion: { numerator: 2, denominator: 1 }
```

This is a structure reveal used in completing the square.


## v1.0.9 power shell rule

An equation may be raised to a power by wrapping the entire left side and entire right side in matching power shells.

```txt
A = B
```

Raise both sides to power `p/q`:

```txt
(A)^(p/q) = (B)^(p/q)
```

Tile model:

```js
kind: "powerShell"
structureType: "powerShell"
baseRaw: "A"
power: { numerator: p, denominator: q }
multiplicativeCompletion: { numerator: p, denominator: q }
```

This is a structural wrapper. It does not distribute, simplify, or branch automatically.


## v1.1.0 power-to-power rule

Power shells can reveal the product of powers.

```txt
(A^m)^n
```

Reveal:

```txt
A^(m·n)
```

Then combine:

```txt
A^(mn)
```

Tile model intermediate:

```js
kind: "powerProduct"
structureType: "powerProduct"
baseFactor: A
innerPower: m
outerPower: n
```

When the combined power is `1`, the power shell collapses to the base.

```txt
A^1 -> A
```


## v1.1.1 even root absolute-value rule

When an even root is applied to an even power, the result is absolute value.

```txt
(A^2)^(1/2) -> |A|
```

More generally, if the outside power has an even denominator and the inside power is even, collapsing to power `1` must preserve absolute value.

This keeps completing the square correct:

```txt
((x - 4)^2)^(1/2) -> |x - 4|
```

The absolute-value tile can then split into plus/minus branches after it is isolated.


## v1.1.2 plus/minus number-side rule

When solving by applying an even fractional power to both sides, the variable side may collapse to the base while the numeric side carries the plus/minus structure.

```txt
((x - 4)^2)^(1/2) = 20^(1/2)
```

becomes:

```txt
x - 4 = ±20^(1/2)
```

Tile model:

```js
kind: "plusMinus"
structureType: "plusMinus"
magnitudeDisplay: "20^(1/2)"
```

Tileify avoids square-root notation and uses fractional exponents instead.


## v1.1.3 plus/minus branch order

When a constant crosses onto a side containing a plus/minus tile, it is inserted before the plus/minus tile.

```txt
x = ±a + 4
```

is displayed structurally as:

```txt
x = 4 ±a
```

The plus/minus tile can split into two branch models.

```txt
4 ±a -> 4 + a
4 ±a -> 4 - a
```

## v1.1.3 imaginary extension

For negative numeric bases under even fractional powers, Tileify may reveal the imaginary unit.

```txt
(-a)^(1/2) -> ±i·a^(1/2)
```

Fractional exponent notation remains preferred over square-root notation.


## v1.2.1 denominator joining rule

When a multiplicative factor crosses onto a side that is already a fraction tile, the incoming factor joins the existing denominator.

```txt
A/B
```

then outside factor `c` crosses into denominator position:

```txt
A/(B·c)
```

The structure should not become:

```txt
(A/B)/c
```

## v1.2.1 parenthetical opening rule

Student-facing language should use:

```txt
Expand / Open Parentheses
```

for both repeated parenthetical expansion and opening a single grouped parenthetical tile.


## v1.2.2 right-click property reveal

Tile properties are hidden from the default student view.

A right-click toggles the tile's property view.

This separates:

```txt
student-facing visible tile
```

from:

```txt
teacher/developer hidden structure
```

while keeping both available in the same interface.


## v1.2.3 layout note

Tile layout is part of the learning model.

Tiles should preserve left-to-right structure when possible. On small screens, horizontal scrolling is preferred over stacking because stacking can hide the algebraic relationship between terms.


## v1.2.4 interface wording

The student-facing phrase should be:

```txt
Transformations Allowed
```

This reinforces that Tileify is showing legal structure moves connected to the current tile state.


## v1.2.5 student-facing tile rule

Individual tile properties should not appear in the student-facing tile cards.

The visible tile should prioritize the mathematical object only.

```txt
+3x
```

not:

```txt
kind: variable
identity: x
add count: 3
...
```

The internal structure remains available to the engine and debug output.


## v1.2.6 interface simplification

The student-facing interface should not offer unnecessary whole-left-side parentheses wrapping.

The goal is to keep Transformations Allowed focused on moves that advance the algebraic structure.


## v1.3.0 drag model

Drag interactions are a physical layer over the existing legal transformations.

A drag should not invent a new math rule.

Instead, a drag gesture maps to an existing Tileify transformation:

```txt
drag whole tile across additive boundary
→ moveAdditiveTileAcross
```

```txt
drag outside factor handle to denominator zone
→ moveMultiplicativeFactorAcross
```

The visual action should feel concrete, but the transformation still comes from the hidden legal model.


## v1.3.1 drag-combine model

Drag-combine maps a concrete gesture onto the existing like-term model.

```txt
drag one like term onto a matching like term
→ combine their additive counts
```

Constants combine as rational constants.

Variables combine only when their identity, completion, and multiplicative position match.

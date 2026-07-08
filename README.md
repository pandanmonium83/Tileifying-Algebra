# Tileify v1.3.1 Drag-Combine Like Terms Sandbox

This build is a more user-friendly presentation of the current Tileify sandbox.

## What changed

- Added a cleaner classroom-facing header
- Added Math With Dan branding
- Added a direct website link to **https://mathwithdan.com**
- Added a Quick Start section for students
- Simplified the overall page flow:
  1. Enter math
  2. Choose a legal move
  3. Watch the tiles
- Kept Branch Results, Legal Transformations, and History visible
- Moved the debug output into a collapsible **Advanced / Debug View**

## Branding note

The exact uploaded Math With Dan logo file was not present in this workspace, so this build uses a clean branded badge:
- `mathwithdan_brand_badge.svg`

If you want, we can easily swap this for your exact logo file later.

## Main idea

Tileify is still the same engine underneath:
- additive crossing
- multiplicative crossing
- factoring
- cancellation
- absolute value splits
- quadratic factoring
- power moves
- plus/minus branching
- fractional-exponent notation
- optional `i` extension for certain imaginary cases

This version simply presents everything in a cleaner way for students and classroom use.


## v1.2.1 patch

### Parentheses language cleanup

The visible **Remove Parentheses** button was removed.

Tileify now treats **Expand / Open Parentheses** as the single student-facing action for opening parenthetical structure.

This means a group created by:

```txt
Add parentheses around left side
```

can be opened again by:

```txt
Expand / Open Parentheses
```

### Existing fraction denominator fix

When a side is already a fraction and an outside factor crosses into denominator position, the crossed factor now joins the existing denominator.

Instead of creating a nested fraction like:

```txt
(20/4)/3
```

Tileify now creates a joined denominator structure like:

```txt
20/(4·3)
```

This better matches the Tileify idea that multiplicative movement creates denominator structure rather than hiding it.


## v1.2.2 patch

### Tile properties hidden by default

The visible tiles now show the mathematical tile label first, without showing the internal properties.

Students can right-click a tile to reveal its properties:

- kind
- identity
- additive count
- completion
- numerator / denominator position
- factor notes when available

Right-clicking the same tile again hides the properties.

This keeps the student experience cleaner while still preserving the deeper Tileify model for debugging, teacher explanation, and discovery.


## v1.2.3 patch

### Tiles no longer stack vertically

The tile view now keeps tiles in a horizontal row and uses side-scrolling when the row is too wide.

This preserves the visual algebra structure better than allowing the tiles to wrap into multiple rows.

### Responsive tile sizing

Tiles now shrink more gracefully on smaller screens:

- smaller min-width on mobile
- responsive font sizing
- horizontal scrolling inside each side
- right-click/long-press properties still available

### Mobile landscape recommendation

A mobile tip banner appears on small screens, especially in portrait orientation:

```txt
Mobile tip: Tileify works best in landscape mode so the tiles can stay in a row.
```

This should make phone use more realistic without distorting the algebra structure.


## v1.2.4 patch

### Suggested Moves renamed

The student-facing action area is now called:

```txt
Transformations Allowed
```

instead of:

```txt
Suggested Moves
```

This is more accurate because Tileify is showing legal transformations, not just hints.

### Transformations moved closer to the tiles

The context-specific transformation buttons now appear directly below the visible tile field.

This is especially important on phones because students need to see the current tile structure and the allowed moves together.


## v1.2.5 patch

### Tile properties removed from the student interface

Tile properties are no longer revealable by right-click.

The tile view is now fully student-facing:

```txt
math label only
```

The deeper model still exists internally and in the Advanced / Debug View, but individual tiles no longer expose their properties.

### Tile field moved above the action workflow

The main workspace now appears in this order:

```txt
Tile field
Transformations Allowed
Core Actions
Extra Tools
```

This puts the tile field and the buttons students need closest together, especially on phones.

### Core actions moved closer

Frequently used buttons now sit close to the tile field:

- Reveal Hidden /1s
- Expand / Open Parentheses
- Combine Like Terms
- Reveal Common Factors
- Cancel Revealed Factors

### Extra tools moved lower

Less frequent structure-building tools are lower in the same workspace:

- Add the same tile to both sides
- Raise both sides to a power


## v1.2.6 patch

### Removed left-side add-parentheses action

The app no longer shows the transformation for adding parentheses around the left side.

This keeps the student interface cleaner and avoids an unnecessary move.


## v1.3.0 major patch

### Drag-and-snap manipulation

Tileify now has a first drag-based manipulative layer.

Students can still use the transformation buttons, but they can also physically drag tiles.

### Additive movement

Drag a whole tile from one side of the boundary to the other side.

When the tile crosses into the opposite side, the drag preview flips its charge. When dropped, Tileify performs the additive boundary crossing and snaps the tile into place.

### Multiplicative denominator movement

For isolated tiles with an outside factor, Tileify now shows a small factor handle.

Drag that handle to the denominator drop zone on the opposite side.

Example idea:

```txt
3x = 15
```

Drag the `grab 3` handle to the right denominator zone:

```txt
x = 15/3
```

### Guided mode remains

The old transformation buttons remain under:

```txt
Transformations Allowed
```

This keeps the app usable for students who prefer clicking or need guided moves.


## v1.3.1 patch

### Drag-combine like terms

Students can now drag one like term onto another matching like term on the same side.

When the target can legally combine, it highlights with a **combine** marker.

Dropping the tile snaps the terms together and combines them.

Examples:

```txt
2x + 5x
```

Drag `2x` onto `5x`:

```txt
7x
```

```txt
3 + 4
```

Drag `3` onto `4`:

```txt
7
```

### Button still remains

The regular **Combine Like Terms** button remains available as guided mode.

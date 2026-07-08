# Tileify v1.2.3 Mobile Landscape Tile Layout Sandbox

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

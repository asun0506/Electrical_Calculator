# Schematic Editing Improvements Design

## Purpose and scope

Make the existing offline schematic editor more useful for engineering drawings: add a legend note, safer wire deletion, movable/resizable drawing information frames, smaller simple components with readable labels, and a twisted-pair symbol and color-order control matching the user's reference image. This is an extension of the current static HTML/classic-JavaScript application, not a new backend or drawing engine. Existing drawings and exports must continue to load.

The approved interaction clarification is important: clicking a twisted-pair line opens the existing wire-property popover. **It does not swap colors immediately.** The popover contains a separate “交换两芯颜色顺序” button; pressing it swaps only that wire's two rendered core colors. Dragging a wire segment continues to adjust its route.

## Existing boundaries

- `js/schematic/model.js` owns defaults, normalization, and saved drawing compatibility.
- `js/schematic/geometry.js` owns component minimum sizes, pin coordinates, grid snapping, and paper dimensions.
- `js/schematic/routing.js` owns route and branch geometry.
- `js/calc-schematic.js` currently owns SVG markup, canvas interactions, the wire/legend popovers, the workspace controls, and import/export validation.
- `tests/schematic-core.cjs`, `tests/schematic-layout.cjs`, `tests/schematic-browser.cjs`, and `tests/schematic-wire-editor.cjs` protect those flows.

Keep changes within those existing boundaries. Do not bundle the deferred controller extraction from the earlier foundation-hardening plan into this feature.

## User interactions and rendering

### Legend note

Add a single-line free-text “自定义备注” field below the existing legend-type fields in the legend popover. Store it as `meta.legendNote`. Render its value as one additional line below the legend entries, with an appropriately taller legend hit area. Empty text omits the note line; existing drawings retain the current legend appearance until a note is entered. Escape the note in SVG/HTML and keep it in JSON, draft storage, SVG, and PDF output. Limit entry length to 200 characters and constrain display to the legend width without altering the stored text.

### Wire deletion and twisted-pair colors

Add a danger-style “删除线路” action to the wire popover. It uses the same connection-group deletion semantics as the workspace row action: deleting a parent also deletes its descendant junction branches; deleting a child removes that child and its descendants, not unrelated siblings. A confirmation dialog states the number of affected connection records. Cancel leaves state and popover unchanged; confirm records an undo snapshot, removes the affected wires, closes the popover, and redraws the workspace and canvas. Apply the same confirmation behavior to the workspace delete button for consistency. This operation does not delete components, Pin definitions, or junction components; any now-unused junctions remain editable.

For twisted-pair wires only, show “交换两芯颜色顺序” in the popover. Store `colorOrderSwapped` as a boolean on the connection record, defaulting to false. Pressing the button toggles it and immediately redraws the pair while keeping the popover usable. All branches rendered from that connection use the same ordering; separate connection records, including junction child wires, may have independent ordering. The two endpoint identities, signal names, line type, routing, and legend colors do not change. Exported JSON and restored drafts preserve the flag; SVG/PDF reflect it.

Replace the current paired-line marker in both actual wires and the legend with the shape shown in the supplied image: one vertical stroke crossing both parallel cores and a short diagonal return at its top-right and bottom-left. Rotate the same geometry for vertical paired runs. This is an image-based rendering requirement; the design does not claim an unverified standards designation.

### Title and revision frames

The title block and revision-history block become separately draggable on the editable SVG. A visible bottom-right resize handle on each appears only in editing mode and never in SVG/PDF output. Pointer movement uses the existing paper-coordinate and grid-snap behavior; Alt bypasses snapping. Position and size are clamped inside the sheet. Old drawings without custom frame geometry use today's computed defaults, including the revision block's height based on displayed records.

Persist custom frame rectangles as flat, bounded metadata fields (`titleBlockX/Y/W/H` and `revisionBlockX/Y/W/H`) to avoid accepting arbitrary nested imported objects. Missing fields use the current sheet-relative positions (`title: cw−360, ch−82, 342×64`; `revision: cw−360, 24, 342×max(54, 18+18×displayedRows)`). The frame interior uses proportional column positions and text placement derived from its rectangle rather than hard-coded sheet coordinates. Minimum title dimensions are 280×64; revision dimensions are at least 280×`max(54, 18+18×displayedRows)`, so up to four displayed rows remain legible. Resizing must never silently discard or mutate the underlying title or revision data. Where text is longer than its cell, clip/ellipsize only the visual text. Undo and JSON import/export cover frame changes.

### Component size and drawing fonts

For ordinary components or containers with no placed Pin or embedded device, the base minimum becomes `5 × gridSize` wide and `2 × gridSize` high (e.g. 50 × 20 at the default 10-pixel grid). Existing content-driven minimums remain higher when connectors or embedded devices need space; standalone device and junction minimums retain their specialized rules. Geometry for sparse Pin layouts must not put a Pin outside the smaller boundary.

Add drawing-level settings (`componentNameFontSize`, `pinNameFontSize`) for a unified component-name font size and Pin-label font size. Defaults preserve the current 22-pixel regular component title and 8-pixel Pin label appearance for existing drawings; the compact-component title continues to scale below the configured regular size. Bound the controls to 8–32 and 6–20 pixels, respectively, and make the settings affect both canvas and SVG/PDF export. A component name that does not fit inside its box is rendered just below the outside edge, centered and given a readable background/halo; it remains associated with the component when moved or resized. Text measurement is for visual placement only and never changes saved component names.

## Data compatibility and validation

Normalize all new metadata and the twisted-pair color-order flag to safe defaults without changing legacy drawing semantics. Extend the schematic import validator only for the explicit new fields, with finite-number bounds for frame coordinates/dimensions and font sizes, a bounded string for the note, and a boolean for color order. Reject malformed or hostile values before replacing the current drawing. Keep the existing maximum JSON file size and shared safety checks. If a new field is absent, use the old rendering default.

## Verification

Follow red/green tests before implementation. Cover:

1. Legend note edit, empty/default behavior, escaping, draft and JSON round trip, SVG/PDF presence.
2. Wire popover deletion cancel/confirm, parent-versus-child scope, undo, and unchanged Pin/component data.
3. Twisted-pair click opening the popover, button-only color swap, independent wire state, JSON round trip, and SVG color order; symbol geometry in wire and legend for horizontal and vertical runs.
4. Title/revision frame move and resize, clamping, persistence, paper-size defaults, edit-only handles, and exported geometry.
5. Empty component 5×2 minimum, content-driven growth, outside-name placement, global font controls, and old drawing defaults.
6. Run focused schematic tests, then the complete `pnpm test` suite under `file://`, and visually inspect representative canvas and exported SVG/PDF output.

Do not publish or push as part of this feature unless separately requested. The user requested implementation in the local calculator.

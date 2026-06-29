# Function Completion Round 5 - Graphics Designer Completion

Round 5 focuses on making the Graphics Designer usable as a real editor workflow, not a static mockup.

## Completed

- Graphic create / update / delete / set default continues to save through `window.energylink.graphics`.
- Object tools now use an active tool mode: select a tool and click the canvas to place the object.
- Canvas object drag/move logic added.
- Grid 20px snapping added and can be toggled.
- Keyboard controls added:
  - Arrow keys move selected object.
  - Shift + Arrow moves by 20px.
  - Delete removes selected object.
  - Ctrl + D duplicates selected object.
- Object duplicate added.
- Bring front / send back layer logic added.
- Align left / center / right / top / middle / bottom added.
- Object style editing added:
  - text color
  - background color
  - border color
  - font size
- Visible / locked logic added.
- Validation added before saving:
  - graphic name required
  - minimum graphic size
  - duplicate object name detection
  - object boundary detection
  - value/gauge/trend/alarm should be bound to a real tag
- Export Graphic JSON added.
- No simulator, no fake value, no random runtime value.

## Runtime data rule

Graphics objects can bind to tags, but they do not create runtime values. Runtime values must still come from real Engine/device reads only.

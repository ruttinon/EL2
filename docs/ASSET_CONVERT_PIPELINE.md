# Asset Convert Pipeline (FBX / OBJ → GLB)

Editor **Setup → Assets** imports GLB/GLTF directly. For FBX, OBJ, STL, or DAE sources, stage the file and convert offline (or via your own CI), then import the resulting GLB.

## Engine staging API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/assets/convert` | Pipeline info and supported formats |
| POST | `/api/assets/convert` | Stage source file (base64 body) |

### POST body example

```json
{
  "filename": "pump.fbx",
  "dataBase64": "<base64 bytes>",
  "target": "glb"
}
```

Response includes `savedPath` under `%ProgramData%/EnergyLink/images/incoming-3d/` (see Engine folders API).

## Conversion options

### Blender (batch)

```bash
blender --background --python your_export_script.py -- "incoming-3d/pump.fbx"
```

Export as **glTF Binary (.glb)** with Y-up and applied transforms.

### assimp

```bash
assimp export pump.fbx pump.glb
```

### FBX2glTF (Autodesk)

```bash
FBX2glTF -i pump.fbx -o pump.glb
```

## Editor import

1. Convert to `.glb`.
2. **Setup → Assets → Import** (or drag onto Graphics canvas).
3. Assign to **viewport3d** (sceneBuildMode `glb`) or equipment with GLB face.
4. Use **Auto GLB ports** in properties for `port_*` / `socket_*` node names.

## Future

Native in-engine conversion may be added later; staging + documented tooling keeps deployments predictable without heavy native deps on the Engine service.

/** Blender MCC template — ดาวน์โหลดจาก editor */
export const BLENDER_MCC_PYTHON = `# Blender — ตู้ MCC → export GLB (ฟรี)
# Blender → Scripting → Run → File → Export glTF 2.0

import bpy

WIDTH_M = 0.8
HEIGHT_M = 2.0
DEPTH_M = 0.6
BREAKER_ROWS = 8
COLOR = (0.28, 0.33, 0.39, 1.0)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.mesh.primitive_cube_add(size=1, location=(WIDTH_M / 2, HEIGHT_M / 2, DEPTH_M / 2))
cabinet = bpy.context.active_object
cabinet.name = 'MCC_Cabinet'
cabinet.scale = (WIDTH_M, HEIGHT_M, DEPTH_M)
bpy.ops.object.transform_apply(scale=True)

mat = bpy.data.materials.new(name='CabinetMat')
mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = COLOR
cabinet.data.materials.append(mat)

slot_h = HEIGHT_M * 0.85 / BREAKER_ROWS
for i in range(BREAKER_ROWS):
    y = 0.08 * HEIGHT_M + i * slot_h + slot_h / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(WIDTH_M / 2, y, DEPTH_M + 0.01))
    slot = bpy.context.active_object
    slot.name = f'BreakerSlot_{i + 1}'
    slot.scale = (WIDTH_M * 0.7, slot_h * 0.85, 0.02)
    bpy.ops.object.transform_apply(scale=True)

print('Done — Export GLB from File menu')
`;

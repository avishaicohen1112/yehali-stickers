"""Procedural gothic architecture kit for Blender backgrounds."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix
import bl

def join(objs, name='joined'):
    objs = [o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.object; o.name = name; return o

def apply_mods(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception: pass
    return o

def pointed_arch_curve(w, h_spring, h_apex, n=24):
    """2D outline points (x,z) of a pointed (lancet) arch opening, from bottom-left around to bottom-right."""
    r = w * 0.85  # radius of each arc (equilateral-ish)
    pts = [(-w / 2, 0), (-w / 2, h_spring)]
    # left arc: center at (-w/2 + r, h_spring)
    cxl = -w / 2 + r; cxr = w / 2 - r
    # apex where arcs meet: x=0
    apex_z = h_spring + math.sqrt(max(r * r - cxl * cxl, 0.0001))
    a0 = math.pi; a1 = math.atan2(apex_z - h_spring, 0 - cxl)
    for i in range(1, n + 1):
        a = a0 + (a1 - a0) * i / n; pts.append((cxl + r * math.cos(a), h_spring + r * math.sin(a)))
    b0 = math.atan2(apex_z - h_spring, 0 - cxr); b1 = 0
    for i in range(1, n + 1):
        a = b0 + (b1 - b0) * i / n; pts.append((cxr + r * math.cos(a), h_spring + r * math.sin(a)))
    pts.append((w / 2, 0))
    return pts, apex_z

def arch_wall(name, w, h, depth, open_w, spring, mat, frame=None):
    """A wall slab (w x h, thickness depth) with a pointed arch opening, centered at x=0, base z=0, facing -Y."""
    pts, apex = pointed_arch_curve(open_w, spring, 0)
    bm = bmesh.new()
    # outer rectangle + inner arch as polygon with hole -> build by triangle fill of edges
    outer = [(-w / 2, 0), (-w / 2, h), (w / 2, h), (w / 2, 0)]
    vo = [bm.verts.new((x, 0, z)) for x, z in outer]
    vi = [bm.verts.new((x, 0, z)) for x, z in pts]
    edges = []
    # boundary: outer bottom-left -> inner left bottom ... inner right bottom -> outer bottom-right, top
    loop = [vo[0]] + vi + [vo[3], vo[2], vo[1]]
    for i in range(len(loop)): edges.append(bm.edges.new((loop[i], loop[(i + 1) % len(loop)])))
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    so = o.modifiers.new('s', 'SOLIDIFY'); so.thickness = depth; so.offset = 0
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = min(0.06, depth * 0.2); bv.segments = 2; bv.limit_method = 'ANGLE'
    o.data.materials.append(mat)
    if frame:  # moulding along arch
        fpts = [(x * 1.0, -depth * 0.5 - 0.02, z) for x, z in pts[1:-1]]
        t = bl.tube(name + '_f', fpts, [frame] * len(fpts), bevel_res=3, res=2)
        t.data.materials.append(mat)
    return o, apex

def column(name, x, y, z0, h, r, mat, cap_mat=None, ribs=8):
    """Clustered gothic pier: core + ribs + base + capital."""
    objs = []
    objs.append(bl.cyl(name, (x, y, z0 + h / 2), r, h, verts=24))
    for k in range(ribs):
        a = k / ribs * 2 * math.pi
        objs.append(bl.cyl(name + 'r', (x + math.cos(a) * r * 0.95, y + math.sin(a) * r * 0.95, z0 + h / 2), r * 0.28, h, verts=10))
    objs.append(bl.cyl(name + 'b', (x, y, z0 + r * 0.4), r * 1.45, r * 0.8, verts=16))
    objs.append(bl.cyl(name + 'b2', (x, y, z0 + r * 0.9), r * 1.25, r * 0.25, verts=16))
    objs.append(bl.cyl(name + 'c', (x, y, z0 + h + r * 0.15), r * 1.5, r * 0.3, verts=16, r2=r * 1.1))
    o = join(objs, name)
    o.data.materials.clear(); o.data.materials.append(mat)
    return o

def rib_vault(name, x0, x1, y, z, h, mat, r=0.08):
    """Pointed rib arc between two columns in the XZ plane at depth y."""
    w = x1 - x0; pts, apex = pointed_arch_curve(w, 0, 0, n=14)
    p3 = [(x0 + w / 2 + px, y, z + pz * (h / max(apex, 0.01))) for px, pz in pts[1:-1]]
    t = bl.tube(name, p3, [r] * len(p3), bevel_res=3, res=3); t.data.materials.append(mat)
    return t

def rose_window(name, x, y, z, R, frame_mat, glass_mats, petals=12, rot=(math.pi / 2, 0, 0)):
    """Rose window: emissive stained glass disc + radial stone tracery. Faces -Y."""
    objs = []
    # glass segments (wedges with different colours)
    glass = []
    for k in range(petals * 2):
        a0 = k / (petals * 2) * 2 * math.pi; a1 = (k + 1) / (petals * 2) * 2 * math.pi
        bm = bmesh.new(); c = bm.verts.new((0, 0, 0)); vs = [c]
        for i in range(6):
            a = a0 + (a1 - a0) * i / 5; vs.append(bm.verts.new((math.cos(a) * R, 0, math.sin(a) * R)))
        for i in range(1, 6): bm.faces.new((c, vs[i + 1], vs[i]))
        me = bpy.data.meshes.new('g'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('g', me); bpy.context.collection.objects.link(o); o.location = (x, y + 0.05, z)
        o.data.materials.append(glass_mats[k % len(glass_mats)]); glass.append(o)
    # tracery
    rings = [R, R * 0.62, R * 0.28, R * 0.12]
    for rr in rings:
        t = bl.tube('ring', [(x + math.cos(a) * rr, y, z + math.sin(a) * rr) for a in [i / 32 * 2 * math.pi for i in range(32)]], [0.04 * R + 0.02] * 32, bevel_res=2, res=2)
        t.data.splines[0].use_cyclic_u = True; objs.append(t)
    for k in range(petals):
        a = k / petals * 2 * math.pi
        objs.append(bl.tube('sp', [(x + math.cos(a) * R * 0.12, y, z + math.sin(a) * R * 0.12), (x + math.cos(a) * R, y, z + math.sin(a) * R)], [0.03 * R + 0.015] * 2, bevel_res=2, res=2))
        # trefoil petals between rings
        a2 = a + math.pi / petals; cxp, czp = x + math.cos(a2) * R * 0.8, z + math.sin(a2) * R * 0.8
        objs.append(bl.tube('pt', [(cxp + math.cos(b) * R * 0.13, y, czp + math.sin(b) * R * 0.13) for b in [i / 16 * 2 * math.pi for i in range(16)]], [0.02 * R + 0.01] * 16, bevel_res=2, res=2))
        objs[-1].data.splines[0].use_cyclic_u = True
    for o in objs: o.data.materials.append(frame_mat)
    return objs + glass

def lancet_window(name, x, y, z, w, h, frame_mat, glass_mat):
    pts, apex = pointed_arch_curve(w, h - w * 0.75, 0)
    bm = bmesh.new(); vs = [bm.verts.new((px, 0, pz)) for px, pz in pts]
    bm.faces.new(vs); me = bpy.data.meshes.new('lw'); bm.to_mesh(me); bm.free()
    g = bpy.data.objects.new('lw', me); bpy.context.collection.objects.link(g); g.location = (x, y + 0.03, z); g.data.materials.append(glass_mat)
    f = bl.tube('lwf', [(x + px, y, z + pz) for px, pz in pts], [w * 0.06] * len(pts), bevel_res=2, res=2); f.data.materials.append(frame_mat)
    m = bl.tube('lwm', [(x, y, z), (x, y, z + apex * 0.92)], [w * 0.04] * 2, bevel_res=2, res=2); m.data.materials.append(frame_mat)
    return [g, f, m]

def candle(x, y, z, h, r, wax, flame, light=True, energy=2.0):
    objs = [bl.cyl('cd', (x, y, z + h / 2), r, h, verts=12)]
    objs[0].data.materials.append(wax)
    f = bl.sphere('fl', (x, y, z + h + r * 1.2), (r * 0.55, r * 0.55, r * 1.4), seg=8, rings=6); f.data.materials.append(flame)
    if light:
        L = bl.light('POINT', (x, y - r * 2, z + h + r * 2), energy, (1, 0.62, 0.3), size=r)
    return objs + [f]

def fog_volume(center, size, density, color=(1, 1, 1), anis=0.3, emission=None):
    o = bl.cube('fog', center, (size[0] / 2, size[1] / 2, size[2] / 2))
    m = bpy.data.materials.new('fogm'); nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    v = nt.nodes.new('ShaderNodeVolumePrincipled'); v.inputs['Density'].default_value = density
    v.inputs['Color'].default_value = (*color, 1); v.inputs['Anisotropy'].default_value = anis
    if emission: v.inputs['Emission Color'].default_value = (*emission[0], 1); v.inputs['Emission Strength'].default_value = emission[1]
    nt.links.new(v.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    o.data.materials.append(m); return o

def emis(name, col, strength):
    return bl.mat(name, col, emit=col, emit_strength=strength)

def stone_mat(name, c1, c2, scale=3.0, bump=0.4, rough=0.75):
    m = bl.mat(name, c1, rough=rough)
    bl.color_noise(m, c1, c2, scale=scale, detail=6)
    bl.noise_bump(m, scale=scale * 4, strength=bump)
    return m

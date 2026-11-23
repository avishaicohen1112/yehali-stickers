"""Blender helper library for The Last Wick asset pipeline (Cycles, headless)."""
import bpy, bmesh, math, os, random
from mathutils import Vector, Euler

def reset(samples=24, res=(256,256), transparent=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.cycles.max_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast' if 'AgX - Medium High Contrast' in [l for l in dir()] else 'None'
    w = bpy.data.worlds.new('W'); sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.02, 0.025, 0.04, 1)
    bg.inputs[1].default_value = 1.0
    return sc

def world_color(c, s=1.0):
    bg = bpy.context.scene.world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*c, 1); bg.inputs[1].default_value = s

def mat(name, color, rough=0.5, metal=0.0, sss=0.0, sss_radius=(1,0.4,0.2), sss_scale=0.1,
        emit=None, emit_strength=0.0, spec=0.5, coat=0.0, sheen=0.0, alpha=1.0, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Subsurface Radius'].default_value = sss_radius
    p.inputs['Subsurface Scale'].default_value = sss_scale
    if emit is not None:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = emit_strength
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Sheen Weight'].default_value = sheen
    p.inputs['Alpha'].default_value = alpha
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = ior
    return m

def noise_bump(m, scale=8.0, strength=0.3, detail=6.0, distance=0.02):
    """Add procedural bump to material."""
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = strength; b.inputs['Distance'].default_value = distance
    nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m

def color_noise(m, c1, c2, scale=5.0, detail=4.0, rough_lo=None):
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].color = (*c1, 1); r.color_ramp.elements[1].color = (*c2, 1)
    r.color_ramp.elements[0].position = 0.35; r.color_ramp.elements[1].position = 0.7
    nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    return m

def assign(obj, m):
    obj.data.materials.clear(); obj.data.materials.append(m); return obj

def smooth(obj, subsurf=2):
    for f in obj.data.polygons: f.use_smooth = True
    if subsurf:
        md = obj.modifiers.new('sub', 'SUBSURF'); md.levels = subsurf; md.render_levels = subsurf
    return obj

def sphere(name, loc=(0,0,0), scale=(1,1,1), seg=32, rings=16, rot=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = scale
    for f in o.data.polygons: f.use_smooth = True
    return o

def cube(name, loc=(0,0,0), scale=(1,1,1), rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = scale; return o

def cyl(name, loc=(0,0,0), r=1, depth=1, rot=(0,0,0), verts=32, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    for f in o.data.polygons: f.use_smooth = True
    return o

def tube(name, pts, radii, bevel_res=8, res=16, cyclic=False):
    """Tapered tube along a poly-bezier through pts with per-point radius."""
    cd = bpy.data.curves.new(name, 'CURVE'); cd.dimensions = '3D'
    cd.resolution_u = res; cd.bevel_depth = 1.0; cd.bevel_resolution = bevel_res
    cd.use_fill_caps = True
    sp = cd.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
    for bp, p, r in zip(sp.bezier_points, pts, radii):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = r
    sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, cd); bpy.context.collection.objects.link(o)
    return o

def to_mesh(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH'); return bpy.context.object

def displace(o, strength=0.1, scale=1.0, kind='CLOUDS', subsurf=0, coords='LOCAL'):
    if subsurf:
        md = o.modifiers.new('sd', 'SUBSURF'); md.levels = subsurf; md.render_levels = subsurf
    t = bpy.data.textures.new(o.name+'_t', kind)
    if kind in ('CLOUDS',): t.noise_scale = scale
    if kind == 'VORONOI': t.noise_scale = scale
    md = o.modifiers.new('disp', 'DISPLACE'); md.texture = t; md.strength = strength
    md.texture_coords = coords
    return md

def empty(name, loc=(0,0,0), parent=None):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o.location = loc
    if parent: o.parent = parent
    return o

def parent(child, par, keep=False):
    mw = child.matrix_world.copy(); child.parent = par
    if keep: child.matrix_parent_inverse = par.matrix_world.inverted()
    return child

def light(kind, loc, energy, color=(1,1,1), size=1.0, rot=(0,0,0), name=None):
    ld = bpy.data.lights.new(name or kind, kind); ld.energy = energy; ld.color = color
    if kind in ('AREA',): ld.size = size
    if kind in ('POINT','SPOT'): ld.shadow_soft_size = size
    if kind == 'SUN': ld.angle = size
    o = bpy.data.objects.new(name or kind, ld); bpy.context.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot
    return o

def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def ortho_cam(center, width, dist=20, height=None):
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = width
    cd.clip_end = 500
    o = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(o)
    o.location = (center[0], -dist, center[1]); o.rotation_euler = (math.pi/2, 0, 0)
    bpy.context.scene.camera = o
    return o

def persp_cam(loc, target, lens=35):
    cd = bpy.data.cameras.new('cam'); cd.lens = lens; cd.clip_end = 2000
    o = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(o)
    o.location = loc; look_at(o, target); bpy.context.scene.camera = o
    return o

def key(obj, frame, **kw):
    """Keyframe loc/rot/scale on obj: key(o, 1, loc=(..), rot=(..), scale=(..))"""
    if 'loc' in kw: obj.location = kw['loc']; obj.keyframe_insert('location', frame=frame)
    if 'rot' in kw: obj.rotation_euler = kw['rot']; obj.keyframe_insert('rotation_euler', frame=frame)
    if 'scale' in kw: obj.scale = kw['scale']; obj.keyframe_insert('scale', frame=frame)

def render(path):
    sc = bpy.context.scene; sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def rim_rig(center=(0,0,0), key_e=300, rim_e=900, fill_e=80, key_col=(1,.9,.8), rim_col=(.6,.75,1)):
    cx, cy, cz = center
    k = light('AREA', (cx-3, cy-6, cz+5), key_e, key_col, size=4, name='key'); look_at(k, center)
    r = light('AREA', (cx+4, cy+5, cz+3), rim_e, rim_col, size=3, name='rim'); look_at(r, center)
    r2 = light('AREA', (cx-4, cy+5, cz+2), rim_e*0.6, rim_col, size=3, name='rim2'); look_at(r2, center)
    f = light('AREA', (cx, cy-8, cz-2), fill_e, (0.7,0.75,1), size=6, name='fill'); look_at(f, center)
    return k, r, r2, f

def ribbon(name, pts, widths, thickness=0.02, sub=1):
    """Flat strip in XZ plane along pts (x,y,z) with widths (along local normal in XZ)."""
    me = bpy.data.meshes.new(name)
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    set_ribbon(o, pts, widths, first=True)
    if thickness:
        so = o.modifiers.new('sol', 'SOLIDIFY'); so.thickness = thickness
    if sub:
        sm = o.modifiers.new('sub', 'SUBSURF'); sm.levels = sub; sm.render_levels = sub
    return o

def set_ribbon(o, pts, widths, first=False):
    import mathutils
    n = len(pts); co = []
    for i in range(n):
        a = Vector(pts[max(i-1, 0)]); b = Vector(pts[min(i+1, n-1)])
        d = (b - a); d.y = 0
        if d.length < 1e-6: d = Vector((1, 0, 0))
        d.normalize(); nrm = Vector((-d.z, 0, d.x))
        p = Vector(pts[i]); w = widths[i] * 0.5
        co.append(p + nrm * w); co.append(p - nrm * w)
    me = o.data
    if first:
        faces = [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(n-1)]
        me.from_pydata([tuple(c) for c in co], [], faces); me.update()
        for f in me.polygons: f.use_smooth = True
    else:
        for v, c in zip(me.vertices, co): v.co = c
        me.update()

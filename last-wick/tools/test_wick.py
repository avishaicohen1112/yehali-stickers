import sys; sys.path.insert(0, '.')
import bl, wick_model, math
sc = bl.reset(samples=48, res=(512, 512))
m = wick_model.build(); wick_model.lights()
for o in m['needle']: o.hide_render = True
bl.ortho_cam((0, 1.05), 2.6)
m['head'].rotation_euler = (0, 0, 0.35)
bl.render('/tmp/claude-0/-home-user-yehali-stickers/4108e445-a820-59df-aeea-25641abca8d7/scratchpad/t/wick.png')

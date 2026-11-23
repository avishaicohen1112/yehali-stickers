# art_src — original images from the image model
File names = the ID from ART_BRIEF (any extension: png/webp/jpg):
- Hero: `A00`, `A01`, `A02`, `A03`
- NPCs: `B01`..`B07`
- Enemies (4x4 sheet, one row per enemy): `C-A`, `C-B`, `C-C`, `C-D`, `C-E`
- Bosses: `D01_art` (full illustration), `D01_poses` (4x2 sheet), `D01_parts` (parts sheet) ... `D13_*`
- Areas: `E1`..`E8`, `F1`..`F8`, `G*`, `H*`, `I*`, `K*`, `L*`, `M*`, `N*`, `O*`, `P*`
- General: `J01`..`J06`
Integration:
- Pose sheets (A02/A03, C-*, D*_poses): `python3 tools/posesheet.py --all --debug <dir>` (recipes in tools/sheets/)
- Areas: `python3 tools/area.py E --rooms` (backgrounds, elements, ground kit, texture, props)
- Then: `cd tools && python3 build_data.py`

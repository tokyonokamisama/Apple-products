#!/bin/sh
# opt.sh in.glb out.glb [texsize]
set -e
T=${3:-1024}
tmp=$(mktemp -d)
gltf-transform dedup "$1" $tmp/a.glb >/dev/null
gltf-transform prune "$tmp/a.glb" $tmp/b.glb >/dev/null
gltf-transform resize $tmp/b.glb $tmp/c.glb --width $T --height $T >/dev/null
gltf-transform webp $tmp/c.glb $tmp/d.glb --quality 86 >/dev/null
gltf-transform meshopt $tmp/d.glb "$2" --level medium >/dev/null
rm -rf $tmp

"""USDZ (Apple AR Quick Look) -> GLB converter.

Usage: python3 usd2glb.py out.glb spec.json
spec: {"sources": [{"file": "a.usdz", "variant": "Silver", "select": {"Color": "Silver", "Pose": "Open"}}, ...]}
Every source is one colour variant of the same geometry. The first source defines the geometry;
the others contribute materials via KHR_materials_variants (matched by prim path, or by traversal order
when the sources are different files).
"""
import sys, json, struct, zipfile, io, hashlib, re
import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom, UsdShade, UsdSkel, Sdf, Gf

MAX_TEX = 2048


def open_stage(path, select):
    st = Usd.Stage.Open(path, Usd.Stage.LoadAll)
    st.SetEditTarget(st.GetSessionLayer())
    if select:
        # 变体可能嵌套，多轮设置直到稳定
        for _ in range(4):
            for p in st.Traverse():
                vsets = p.GetVariantSets()
                for n in vsets.GetNames():
                    if n in select and select[n] in vsets.GetVariantSet(n).GetVariantNames():
                        if vsets.GetVariantSet(n).GetVariantSelection() != select[n]:
                            vsets.GetVariantSet(n).SetVariantSelection(select[n])
    try:
        if any(p.IsA(UsdSkel.Root) for p in st.Traverse()):
            UsdSkel.BakeSkinning(st.Traverse())
    except Exception as e:  # noqa
        print('  skel bake failed:', e)
    return st


class TexStore:
    def __init__(self):
        self.zips = {}
        self.cache = {}

    def load(self, resolved):
        m = re.match(r'^(.*\.usdz)\[(.*)\]$', resolved)
        if not m:
            return Image.open(resolved)
        z = self.zips.get(m.group(1))
        if not z:
            z = self.zips[m.group(1)] = zipfile.ZipFile(m.group(1))
        inner = m.group(2)
        # 嵌套 usdz 的路径形如 a.usdz[b.usdz[c.png]]，此处只处理一层
        data = z.read(inner)
        im = Image.open(io.BytesIO(data))
        im.load()
        return im

    def channel(self, t):
        key = (t['path'], t['ch'], tuple(t.get('scale') or ()), tuple(t.get('bias') or ()))
        if key in self.cache:
            return self.cache[key]
        im = self.load(t['path'])
        if im.mode in ('P', 'LA', 'I;16', 'I', 'F', 'L', '1'):
            im = im.convert('RGBA' if 'A' in im.mode or im.mode == 'P' else 'RGB')
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA')
        if max(im.size) > MAX_TEX:
            im.thumbnail((MAX_TEX, MAX_TEX), Image.LANCZOS)
        arr = np.asarray(im).astype(np.float32) / 255.0
        if arr.ndim == 2:
            arr = arr[:, :, None].repeat(3, 2)
        ch = t['ch']
        idx = {'r': [0], 'g': [1], 'b': [2], 'a': [3], 'rgb': [0, 1, 2], 'rgba': [0, 1, 2, 3]}.get(ch, [0, 1, 2])
        if max(idx) >= arr.shape[2]:
            idx = [min(i, arr.shape[2] - 1) for i in idx] if ch != 'a' else None
            if idx is None:
                out = np.ones(arr.shape[:2] + (1,), np.float32)
                self.cache[key] = out
                return out
        out = arr[:, :, idx]
        sc, bi = t.get('scale'), t.get('bias')
        if sc is not None:
            out = out * np.array([sc[i] for i in idx], np.float32)
        if bi is not None:
            out = out + np.array([bi[i] for i in idx], np.float32)
        self.cache[key] = out
        return out


def shader_of(inp):
    if not inp or not inp.HasConnectedSource():
        return None, None
    src, name, _ = inp.GetConnectedSource()
    return UsdShade.Shader(src.GetPrim()), name


def tex_of(inp):
    sh, outname = shader_of(inp)
    if not sh or sh.GetIdAttr().Get() != 'UsdUVTexture':
        return None
    f = sh.GetInput('file')
    if not f:
        return None
    ap = f.Get()
    path = ap.resolvedPath or ap.path
    if not path:
        return None
    g = lambda n: (sh.GetInput(n).Get() if sh.GetInput(n) else None)
    t = {'path': path, 'ch': outname, 'scale': g('scale'), 'bias': g('bias'), 'var': 'st', 'wrapS': g('wrapS'), 'wrapT': g('wrapT'), 'xf': None}
    rd, _ = shader_of(sh.GetInput('st'))
    if rd is not None:
        if rd.GetIdAttr().Get() == 'UsdTransform2d':
            t['xf'] = {'s': list(rd.GetInput('scale').Get()) if rd.GetInput('scale') and rd.GetInput('scale').Get() is not None else None,
                       't': list(rd.GetInput('translation').Get()) if rd.GetInput('translation') and rd.GetInput('translation').Get() is not None else None,
                       'r': rd.GetInput('rotation').Get() if rd.GetInput('rotation') else None}
            rd, _ = shader_of(rd.GetInput('in'))
        if rd is not None and rd.GetInput('varname'):
            v = rd.GetInput('varname').Get()
            if v:
                t['var'] = str(v)
    return t


def material_desc(mat):
    if not mat:
        return {'const': {'diffuseColor': [0.8, 0.8, 0.8]}, 'tex': {}}
    sh = mat.ComputeSurfaceSource()[0]
    if not sh or sh.GetIdAttr().Get() != 'UsdPreviewSurface':
        for o in mat.GetSurfaceOutputs():
            s2, _ = shader_of(o)
            if s2 and s2.GetIdAttr().Get() == 'UsdPreviewSurface':
                sh = s2
                break
    d = {'const': {}, 'tex': {}, 'name': mat.GetPrim().GetName()}
    if not sh:
        # 只有 RealityKit / MaterialX 定义（发光、阴影等特效），网页里跳过
        d['skip'] = True
        return d
    for n in ['diffuseColor', 'emissiveColor', 'metallic', 'roughness', 'normal', 'occlusion', 'opacity', 'opacityThreshold', 'clearcoat', 'clearcoatRoughness', 'ior']:
        inp = sh.GetInput(n)
        if not inp:
            continue
        t = tex_of(inp)
        if t:
            d['tex'][n] = t
        elif not inp.HasConnectedSource():
            v = inp.Get()
            if v is not None:
                d['const'][n] = list(v) if hasattr(v, '__len__') else float(v)
    return d


def expand(values, interp, counts, idx, nfaces):
    v = np.asarray(values)
    if interp == 'faceVarying':
        return v
    if interp in ('vertex', 'varying'):
        return v[idx]
    if interp == 'uniform':
        return np.repeat(v, counts, axis=0)
    if interp == 'constant':
        return np.repeat(v[:1], len(idx), axis=0)
    return v[idx]


def extract(stage, verbose=False):
    t = Usd.TimeCode.EarliestTime()
    xc = UsdGeom.XformCache(t)
    up = UsdGeom.GetStageUpAxis(stage)
    prims = []
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        img = UsdGeom.Imageable(prim)
        if img.ComputeVisibility(t) == UsdGeom.Tokens.invisible:
            continue
        if img.ComputePurpose() in (UsdGeom.Tokens.guide, UsdGeom.Tokens.proxy):
            continue
        mesh = UsdGeom.Mesh(prim)
        pts = mesh.GetPointsAttr().Get(t)
        counts = mesh.GetFaceVertexCountsAttr().Get(t)
        idx = mesh.GetFaceVertexIndicesAttr().Get(t)
        if not pts or not counts or not idx:
            continue
        pts = np.array(pts, np.float64)
        counts = np.array(counts, np.int64)
        idx = np.array(idx, np.int64)
        M = np.array(xc.GetLocalToWorldTransform(prim), np.float64)
        R = M[:3, :3]
        P = pts @ R + M[3, :3]
        nfaces = len(counts)
        pv = UsdGeom.PrimvarsAPI(prim)
        # 法线
        N = None
        pn = pv.GetPrimvar('normals')
        if pn and pn.HasValue():
            N = expand(pn.ComputeFlattened(t), pn.GetInterpolation(), counts, idx, nfaces)
        elif mesh.GetNormalsAttr().HasValue():
            N = expand(mesh.GetNormalsAttr().Get(t), mesh.GetNormalsInterpolation(), counts, idx, nfaces)
        Pc = P[idx]
        if N is not None and len(N) == len(idx):
            Rn = np.linalg.inv(R).T
            N = np.asarray(N, np.float64) @ Rn
            ln = np.linalg.norm(N, axis=1, keepdims=True)
            N = N / np.maximum(ln, 1e-12)
        else:
            N = None
        # UV 集
        uvs = {}
        for p in pv.GetPrimvars():
            tn = p.GetTypeName()
            if tn in (Sdf.ValueTypeNames.TexCoord2f, Sdf.ValueTypeNames.Float2, Sdf.ValueTypeNames.TexCoord2fArray, Sdf.ValueTypeNames.Float2Array) or str(tn).startswith('texCoord2f') or str(tn) == 'float2[]':
                if not p.HasValue():
                    continue
                vals = p.ComputeFlattened(t)
                if vals is None or len(vals) == 0:
                    continue
                arr = expand(vals, p.GetInterpolation(), counts, idx, nfaces)
                if len(arr) == len(idx):
                    uvs[p.GetPrimvarName()] = np.asarray(arr, np.float64)
        # 三角化（扇形）
        starts = np.concatenate([[0], np.cumsum(counts)[:-1]])
        tri_face, tri_a, tri_b, tri_c = [], [], [], []
        for k in range(3, int(counts.max()) + 1):
            sel = np.where(counts >= k)[0]
            if len(sel) == 0:
                continue
            s = starts[sel]
            tri_face.append(sel)
            tri_a.append(s)
            tri_b.append(s + k - 2)
            tri_c.append(s + k - 1)
        tri_face = np.concatenate(tri_face)
        tris = np.stack([np.concatenate(tri_a), np.concatenate(tri_b), np.concatenate(tri_c)], 1)
        flip = (mesh.GetOrientationAttr().Get() == UsdGeom.Tokens.leftHanded) ^ (np.linalg.det(R) < 0)
        if flip:
            tris = tris[:, [0, 2, 1]]
        # 缺失或零长度的法线：用三角面法线补齐
        fa, fb, fc = Pc[tris[:, 0]], Pc[tris[:, 1]], Pc[tris[:, 2]]
        fn = np.cross(fb - fa, fc - fa)
        fn = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
        if N is None:
            N = np.zeros_like(Pc)
        bad = np.linalg.norm(N, axis=1) < 0.5
        if bad.any():
            for k in range(3):
                sel = bad[tris[:, k]]
                N[tris[sel, k]] = fn[sel]
            N[np.linalg.norm(N, axis=1) < 0.5] = [0, 1, 0]
        ds = mesh.GetDoubleSidedAttr().Get()
        # 材质子集
        mb = UsdShade.MaterialBindingAPI(prim)
        groups = []
        subsets = UsdShade.MaterialBindingAPI(prim).GetMaterialBindSubsets()
        assigned = np.zeros(nfaces, bool)
        for sub in subsets:
            fidx = np.array(sub.GetIndicesAttr().Get(t) or [], np.int64)
            fidx = fidx[fidx < nfaces]
            if len(fidx) == 0:
                continue
            assigned[fidx] = True
            m = UsdShade.MaterialBindingAPI(sub.GetPrim()).ComputeBoundMaterial()[0]
            groups.append((sub.GetPrim().GetName(), fidx, m))
        rest = np.where(~assigned)[0]
        if len(rest):
            groups.append(('', rest, mb.ComputeBoundMaterial()[0]))
        for gname, fidx, mat in groups:
            mask = np.isin(tri_face, fidx)
            T = tris[mask]
            if len(T) == 0:
                continue
            md = material_desc(mat if mat and mat.GetPrim().IsValid() else None)
            if ds:
                md['doubleSided'] = True
            if md.get('skip'):
                print('  skip effect material', md.get('name'))
            prims.append({'key': str(prim.GetPath()) + '|' + gname, 'P': Pc, 'N': N, 'UV': uvs, 'T': T, 'mat': md})
    return prims, up


def mat_hash(md):
    return hashlib.md5(json.dumps(md, sort_keys=True, default=str).encode()).hexdigest()


class GLB:
    def __init__(self):
        self.bin = bytearray()
        self.j = {'asset': {'version': '2.0', 'generator': 'guoxuan-usd2glb'}, 'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [],
                  'materials': [], 'textures': [], 'images': [], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
                  'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}], 'extensionsUsed': []}
        self.tex = TexStore()
        self.img_cache = {}
        self.mat_cache = {}

    def view(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin += data
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target:
            bv['target'] = target
        self.j['bufferViews'].append(bv)
        return len(self.j['bufferViews']) - 1

    def accessor(self, arr, typ, comp, target=34962, minmax=False):
        arr = np.ascontiguousarray(arr)
        bv = self.view(arr.tobytes(), target)
        a = {'bufferView': bv, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
        if minmax:
            a['min'] = arr.min(0).tolist()
            a['max'] = arr.max(0).tolist()
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1

    def image(self, arr, key):
        if key in self.img_cache:
            return self.img_cache[key]
        arr = np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)
        im = Image.fromarray(arr)
        b = io.BytesIO()
        if arr.shape[2] == 4:
            im.save(b, 'PNG', optimize=False)
            mime = 'image/png'
        else:
            im.save(b, 'JPEG', quality=92)
            mime = 'image/jpeg'
        bv = self.view(b.getvalue())
        self.j['images'].append({'bufferView': bv, 'mimeType': mime})
        self.j['textures'].append({'source': len(self.j['images']) - 1, 'sampler': 0})
        ti = len(self.j['textures']) - 1
        self.img_cache[key] = ti
        return ti

    def material(self, md, uvmap):
        h = mat_hash(md)
        if h in self.mat_cache:
            return self.mat_cache[h]
        c, t = md['const'], md['tex']
        pbr = {}
        m = {'name': md.get('name', ''), 'pbrMetallicRoughness': pbr}
        tc = lambda tt: {'texCoord': uvmap.get(tt['var'], 0)}
        # 透明度
        op = c.get('opacity', 1.0)
        op_tex = t.get('opacity')
        thr = c.get('opacityThreshold', 0.0)
        # 基础色
        if 'diffuseColor' in t:
            rgb = self.tex.channel(t['diffuseColor'])
            if op_tex:
                a = self.tex.channel(op_tex)
                if a.shape[:2] != rgb.shape[:2]:
                    a = np.asarray(Image.fromarray((a[:, :, 0] * 255).astype(np.uint8)).resize(rgb.shape[1::-1]), np.float32)[:, :, None] / 255
                img = np.concatenate([rgb[:, :, :3], a[:, :, :1]], 2)
            else:
                img = rgb[:, :, :3]
            pbr['baseColorTexture'] = dict(index=self.image(img, ('bc', t['diffuseColor']['path'], op_tex['path'] if op_tex else '')), **tc(t['diffuseColor']))
            pbr['baseColorFactor'] = [1, 1, 1, 1 if op_tex else op]
        else:
            dc = c.get('diffuseColor', [0.18, 0.18, 0.18])
            if op_tex:
                a = self.tex.channel(op_tex)
                img = np.concatenate([np.ones(a.shape[:2] + (3,), np.float32), a[:, :, :1]], 2)
                pbr['baseColorTexture'] = dict(index=self.image(img, ('op', op_tex['path'], op_tex['ch'])), **tc(op_tex))
                pbr['baseColorFactor'] = list(dc) + [1]
            else:
                pbr['baseColorFactor'] = list(dc) + [op]
        # 金属度 / 粗糙度
        rt, mt = t.get('roughness'), t.get('metallic')
        if rt or mt:
            ref = self.tex.channel(rt or mt)
            h_, w_ = ref.shape[:2]

            def ch(tt, const):
                if tt:
                    a = self.tex.channel(tt)[:, :, 0]
                    if a.shape != (h_, w_):
                        a = np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((w_, h_)), np.float32) / 255
                    return a
                return np.full((h_, w_), const, np.float32)
            img = np.stack([np.ones((h_, w_), np.float32), ch(rt, c.get('roughness', 0.5)), ch(mt, c.get('metallic', 0.0))], 2)
            pbr['metallicRoughnessTexture'] = dict(index=self.image(img, ('mr', rt['path'] if rt else '', rt['ch'] if rt else '', mt['path'] if mt else '', mt['ch'] if mt else '')), **tc(rt or mt))
            pbr['metallicFactor'] = 1.0
            pbr['roughnessFactor'] = 1.0
        else:
            pbr['metallicFactor'] = float(c.get('metallic', 0.0))
            pbr['roughnessFactor'] = float(c.get('roughness', 0.5))
        if 'normal' in t:
            n = self.tex.channel(t['normal'])
            # USD 法线贴图通常已带 scale=2 bias=-1，转回 [0,1]
            if t['normal'].get('scale') is not None and abs(t['normal']['scale'][0] - 2) < 0.01:
                n = (n + 1) / 2
            m['normalTexture'] = dict(index=self.image(n[:, :, :3], ('n', t['normal']['path'])), **tc(t['normal']))
        if 'occlusion' in t:
            o = self.tex.channel(t['occlusion'])[:, :, :1]
            m['occlusionTexture'] = dict(index=self.image(np.repeat(o, 3, 2), ('o', t['occlusion']['path'], t['occlusion']['ch'])), **tc(t['occlusion']))
        if 'emissiveColor' in t:
            e = self.tex.channel(t['emissiveColor'])[:, :, :3]
            m['emissiveTexture'] = dict(index=self.image(e, ('e', t['emissiveColor']['path'])), **tc(t['emissiveColor']))
            m['emissiveFactor'] = [1, 1, 1]
        elif 'emissiveColor' in c and max(c['emissiveColor']) > 0:
            m['emissiveFactor'] = [min(1, x) for x in c['emissiveColor']]
        if op_tex or op < 0.999:
            if thr and thr > 0:
                m['alphaMode'] = 'MASK'
                m['alphaCutoff'] = float(thr)
            else:
                m['alphaMode'] = 'BLEND'
        if md.get('doubleSided') or m.get('alphaMode') == 'BLEND':
            m['doubleSided'] = True
        cc = c.get('clearcoat', 0.0) if 'clearcoat' not in t else 0.5
        if cc and cc > 0:
            m.setdefault('extensions', {})['KHR_materials_clearcoat'] = {'clearcoatFactor': float(cc), 'clearcoatRoughnessFactor': float(c.get('clearcoatRoughness', 0.05))}
            if 'KHR_materials_clearcoat' not in self.j['extensionsUsed']:
                self.j['extensionsUsed'].append('KHR_materials_clearcoat')
        if 'ior' in c and abs(c['ior'] - 1.5) > 0.01:
            pass
        self.j['materials'].append(m)
        mi = len(self.j['materials']) - 1
        self.mat_cache[h] = mi
        return mi

    def write(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j['buffers'][0]['byteLength'] = len(self.bin)
        if not self.j['extensionsUsed']:
            del self.j['extensionsUsed']
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js
        out += struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)


def build(spec, out):
    passes = []
    for s in spec['sources']:
        st = open_stage(s['file'], s.get('select'))
        prims, up = extract(st)
        passes.append((s.get('variant'), prims, up))
        print(f"  {s.get('variant')}: {len(prims)} primitives")
    base_name, base, up = passes[0]
    # 隐藏极度透明的“光泽层”（RealityKit 专用，glTF 中无法只显示高光）
    def visible(md):
        if md.get('skip'):
            return False
        return not (md['const'].get('opacity', 1.0) < 0.05 and 'opacity' not in md['tex'])
    g = GLB()
    variants = [p[0] for p in passes] if len(passes) > 1 else []
    if variants:
        g.j['extensionsUsed'].append('KHR_materials_variants')
        g.j['extensions'] = {'KHR_materials_variants': {'variants': [{'name': v} for v in variants]}}
    # 用于跨文件匹配：按 key，失败则按顺序 + 三角形数量
    maps = []
    for vi, (vname, prims, _) in enumerate(passes):
        bykey = {p['key']: p for p in prims}
        if vi == 0 or all(p['key'] in bykey for p in base):
            maps.append(lambda bp, bk=bykey: bk.get(bp['key']))
        else:
            ok = len(prims) == len(base) and all(len(a['T']) == len(b['T']) for a, b in zip(prims, base))
            if not ok:
                print('  WARN: variant', vname, 'geometry mismatch; materials matched by order where possible')
            maps.append(lambda bp, pl=prims, bl=base: pl[bl.index(bp)] if bl.index(bp) < len(pl) else None)
    hidden = None
    rot = None
    if up == 'Z':
        rot = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], np.float64)
    for bp in base:
        mats = []
        for vi, (vname, prims, _) in enumerate(passes):
            vp = maps[vi](bp)
            mats.append(vp['mat'] if vp else None)
        if not any(m and visible(m) for m in mats):
            continue
        # UV 集映射
        used = sorted({tt['var'] for m in mats if m for tt in m['tex'].values()})
        uvmap = {}
        attrs = {}
        T = bp['T']
        corners = np.unique(T.reshape(-1))
        remap = np.full(len(bp['P']), -1, np.int64)
        remap[corners] = np.arange(len(corners))
        P = bp['P'][corners]
        if rot is not None:
            P = P @ rot
        cols = [P]
        N = bp['N'][corners] if bp['N'] is not None else None
        if N is not None:
            if rot is not None:
                N = N @ rot
            cols.append(N)
        uv_list = []
        for vname_ in used:
            if vname_ in bp['UV']:
                uvmap[vname_] = len(uv_list)
                uv = bp['UV'][vname_][corners].copy()
                uv[:, 1] = 1 - uv[:, 1]
                uv_list.append(uv)
        if not uv_list and bp['UV']:
            first = next(iter(bp['UV']))
            uv = bp['UV'][first][corners].copy()
            uv[:, 1] = 1 - uv[:, 1]
            uv_list.append(uv)
            uvmap.setdefault('st', 0)
        for u in uv_list:
            cols.append(u)
        # 焊接重复顶点
        big = np.concatenate(cols, 1)
        rounded = np.round(big, 6)
        uniq, inv = np.unique(rounded, axis=0, return_inverse=True)
        inv = inv.reshape(-1)
        Tn = inv[remap[T]]
        firsts = np.zeros(len(uniq), np.int64)
        firsts[inv] = np.arange(len(inv))
        big = big[firsts]
        off = 0
        P = big[:, 0:3].astype(np.float32); off = 3
        attrs['POSITION'] = g.accessor(P, 'VEC3', 5126, minmax=True)
        if N is not None:
            attrs['NORMAL'] = g.accessor(big[:, off:off + 3].astype(np.float32), 'VEC3', 5126); off += 3
        for i in range(len(uv_list)):
            attrs[f'TEXCOORD_{i}'] = g.accessor(big[:, off:off + 2].astype(np.float32), 'VEC2', 5126); off += 2
        ind = g.accessor(Tn.reshape(-1).astype(np.uint32), 'SCALAR', 5125, target=34963)
        mi = [g.material(m, uvmap) if (m and visible(m)) else None for m in mats]
        if mi[0] is None:
            # 默认变体中不可见：给一个全透明材质
            mi[0] = g.material({'const': {'opacity': 0.0, 'diffuseColor': [0, 0, 0]}, 'tex': {}, 'name': 'hidden'}, {})
        prim = {'attributes': attrs, 'indices': ind, 'material': mi[0], 'mode': 4}
        if variants:
            hid = None
            mappings = []
            for vi, m in enumerate(mi):
                if m is None:
                    if hid is None:
                        hid = g.material({'const': {'opacity': 0.0, 'diffuseColor': [0, 0, 0]}, 'tex': {}, 'name': 'hidden'}, {})
                    m = hid
                mappings.append((m, vi))
            groups = {}
            for m, vi in mappings:
                groups.setdefault(m, []).append(vi)
            prim['extensions'] = {'KHR_materials_variants': {'mappings': [{'material': m, 'variants': vs} for m, vs in groups.items()]}}
        g.j['meshes'].append({'name': bp['key'].split('/')[-1], 'primitives': [prim], 'extras': {'path': bp['key'].split('|')[0]}})
        g.j['nodes'].append({'mesh': len(g.j['meshes']) - 1})
        g.j['scenes'][0]['nodes'].append(len(g.j['nodes']) - 1)
    g.write(out)
    print('  wrote', out, len(g.j['meshes']), 'meshes', len(g.j['materials']), 'materials', len(g.j['images']), 'images', f"{len(g.bin) / 1e6:.1f}MB")


if __name__ == '__main__':
    build(json.load(open(sys.argv[2])), sys.argv[1])

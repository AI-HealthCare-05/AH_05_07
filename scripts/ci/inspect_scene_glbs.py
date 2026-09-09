"""Read-only, hash-pinned inventory of the 22 approved companion GLBs.

Only public immutable URLs in the existing evidence are read. Binary cache lives
outside the repository; this script never uploads or modifies a source asset.
"""

import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import struct
import subprocess


def inspect_glb(data):
    magic, version, length = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or length != len(data):
        raise ValueError('Invalid GLB header')
    offset, document, binary = 12, None, b''
    while offset < length:
        size, kind = struct.unpack_from('<II', data, offset)
        offset += 8
        chunk = data[offset:offset + size]
        if len(chunk) != size:
            raise ValueError('Truncated GLB chunk')
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += size
    if document is None:
        raise ValueError('Missing glTF document')
    accessors = document.get('accessors', [])
    primitives = [p for m in document.get('meshes', []) for p in m['primitives']]
    clips = []
    for animation in document.get('animations', []):
        durations = []
        for sampler in animation['samplers']:
            accessor = accessors[sampler['input']]
            if 'max' in accessor:
                durations.append(accessor['max'][0])
            elif accessor.get('componentType') == 5126:
                view = document['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
                stride = view.get('byteStride', 4)
                durations.extend(struct.unpack_from('<f', binary, start + i * stride)[0] for i in range(accessor['count']))
        clips.append({'name': animation.get('name'), 'duration_seconds': max(durations, default=None),
                      'channels': len(animation['channels']),
                      'translation_targets': sorted({c['target']['node'] for c in animation['channels'] if c['target']['path'] == 'translation'})})
    triangles = 0
    for primitive in primitives:
        if primitive.get('mode', 4) != 4:
            raise ValueError('Non-triangle primitive requires explicit accounting')
        accessor = accessors[primitive['indices']] if 'indices' in primitive else accessors[primitive['attributes']['POSITION']]
        triangles += accessor['count'] // 3
    return {'mesh_count': len(document.get('meshes', [])), 'primitive_count': len(primitives),
            'unique_geometry_triangles': triangles, 'node_count': len(document.get('nodes', [])),
            'material_count': len(document.get('materials', [])), 'texture_count': len(document.get('textures', [])),
            'image_count': len(document.get('images', [])), 'skin_count': len(document.get('skins', [])),
            'animation_clips': clips, 'extensions_required': document.get('extensionsRequired', []),
            'external_dependencies': [x['uri'] for k in ('buffers', 'images') for x in document.get(k, []) if 'uri' in x],
            'notes': 'Geometry count is unique primitive geometry, not rendered draw calls or instanced triangle count. Translation channels alone do not prove root motion. GPU memory and decode cost remain unmeasured.'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', required=True, type=pathlib.Path)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    args = parser.parse_args()
    root = pathlib.Path(__file__).resolve().parents[2]
    evidence = json.loads((root / 'docs/evidence/companion-r2-v1.json').read_text())
    origin = evidence['runtime_delivery']['custom_domain']
    args.cache.mkdir(parents=True, exist_ok=True)

    def examine(asset):
        path = args.cache / (asset['sha256'] + '.glb')
        if not path.exists():
            data = subprocess.run(
                ['curl', '--fail', '--silent', '--show-error', '--max-time', '45',
                 origin + '/' + asset['r2_object_key']], check=True, capture_output=True,
            ).stdout
            if hashlib.sha256(data).hexdigest() != asset['sha256'] or len(data) != asset['bytes']:
                raise ValueError('Asset identity mismatch: ' + asset['asset_id'])
            path.write_bytes(data)
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != asset['sha256'] or len(data) != asset['bytes']:
            raise ValueError('Cached asset identity mismatch: ' + asset['asset_id'])
        return {key: asset[key] for key in ('asset_id', 'species', 'variant', 'sha256', 'bytes')} | inspect_glb(data)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(examine, evidence['objects']))
    unique_clips = {(a['species'], c['name']) for a in results for c in a['animation_clips']}
    if len(results) != 22 or len(unique_clips) != 77:
        raise ValueError('Inventory cardinality mismatch')
    report = {'schema_version': 1, 'source_commit': '9361983ea00afa244da560ac62f0d533e9f9e942',
              'status': 'HASH_VERIFIED_STRUCTURE_INSPECTED', 'asset_count': len(results),
              'unique_species_clip_count': len(unique_clips), 'binary_mutations': 0,
              'runtime_performance': 'NOT_MEASURED', 'assets': results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'assets'}))


if __name__ == '__main__':
    main()

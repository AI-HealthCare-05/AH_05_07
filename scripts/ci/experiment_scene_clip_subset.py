"""Offline clip-subset experiment; preserves every retained accessor byte.

Writes a review-only derivative outside Git and an evidence report. No asset is
published, selected by the renderer, or substituted for an immutable source.
"""
import argparse
import copy
import gzip
import hashlib
import json
import pathlib
import struct


def unpack(data):
    magic, version, length = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and length == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    document = json.loads(data[20:20 + size])
    start = 20 + size
    binary_size, kind = struct.unpack_from('<II', data, start)
    assert kind == 0x004E4942
    return document, data[start + 8:start + 8 + binary_size]


def accessor_references(document):
    references = []
    for mesh in document.get('meshes', []):
        for primitive in mesh['primitives']:
            if 'indices' in primitive:
                references.append((primitive, 'indices'))
            references.extend((primitive['attributes'], key) for key in primitive['attributes'])
            for target in primitive.get('targets', []):
                references.extend((target, key) for key in target)
    for skin in document.get('skins', []):
        if 'inverseBindMatrices' in skin:
            references.append((skin, 'inverseBindMatrices'))
    for animation in document.get('animations', []):
        for sampler in animation['samplers']:
            references.extend([(sampler, 'input'), (sampler, 'output')])
    return references


def subset(data, names):
    source, binary = unpack(data)
    assert len(source['buffers']) == 1 and not source.get('images')
    assert not source.get('extensionsUsed') and not source.get('extensionsRequired')
    assert all('sparse' not in a for a in source['accessors'])
    document = copy.deepcopy(source)
    document['animations'] = [a for a in document['animations'] if a['name'] in names]
    assert {a['name'] for a in document['animations']} == set(names)
    references = accessor_references(document)
    used_accessors = sorted({parent[key] for parent, key in references})
    used_views = sorted({source['accessors'][i]['bufferView'] for i in used_accessors})
    accessor_map = {old: new for new, old in enumerate(used_accessors)}
    view_map = {old: new for new, old in enumerate(used_views)}
    for parent, key in references:
        parent[key] = accessor_map[parent[key]]
    packed = bytearray()
    views = []
    for index in used_views:
        view = copy.deepcopy(source['bufferViews'][index])
        assert view.get('buffer', 0) == 0
        start = view.get('byteOffset', 0)
        chunk = binary[start:start + view['byteLength']]
        assert len(chunk) == view['byteLength']
        packed.extend(b'\0' * ((-len(packed)) % 4))
        view['byteOffset'] = len(packed)
        packed.extend(chunk)
        views.append(view)
    document['bufferViews'] = views
    document['accessors'] = [copy.deepcopy(source['accessors'][i]) for i in used_accessors]
    for accessor in document['accessors']:
        accessor['bufferView'] = view_map[accessor['bufferView']]
    document['buffers'] = [{'byteLength': len(packed)}]
    # Exact comparison of retained accessor metadata and referenced view bytes.
    for old, new in accessor_map.items():
        before = dict(source['accessors'][old])
        after = dict(document['accessors'][new])
        bv = source['bufferViews'][before.pop('bufferView')]
        av = document['bufferViews'][after.pop('bufferView')]
        assert before == after
        assert binary[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']] == packed[av['byteOffset']:av['byteOffset'] + av['byteLength']]
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    packed.extend(b'\0' * ((-len(packed)) % 4))
    result = struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(packed))
    result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    result += struct.pack('<II', len(packed), 0x004E4942) + packed
    return result, len(used_accessors)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=pathlib.Path, required=True)
    parser.add_argument('--derivative', type=pathlib.Path, required=True)
    parser.add_argument('--report', type=pathlib.Path, required=True)
    args = parser.parse_args()
    data = args.source.read_bytes()
    source_hash = hashlib.sha256(data).hexdigest()
    assert source_hash == '7960a83fc11ffb57943227172caebe0dbabbd78a84f302d69df50e8ddcbc4874'
    result, count = subset(data, ['idle', 'rest', 'celebrate'])
    args.derivative.write_bytes(result)
    report = {'status': 'OFFLINE_EXPERIMENT_NOT_FOR_RUNTIME', 'source_sha256': source_hash,
              'derivative_sha256': hashlib.sha256(result).hexdigest(),
              'source_bytes': len(data), 'derivative_bytes': len(result),
              'saved_bytes': len(data) - len(result), 'retained_clips': ['idle', 'rest', 'celebrate'],
              'retained_accessor_count': count, 'retained_accessor_bytes_and_metadata_identical': True,
              'estimated_source_gzip_bytes': len(gzip.compress(data, mtime=0)),
              'estimated_derivative_gzip_bytes': len(gzip.compress(result, mtime=0)),
              'visual_parity': 'NOT_MEASURED', 'runtime_decode': 'NOT_MEASURED',
              'immutable_sources_modified': 0, 'runtime_selection_changed': False}
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()

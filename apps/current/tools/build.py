#!/usr/bin/env python3
"""Assemble the portable page from readable sources. No third-party build tools."""
from pathlib import Path
import base64

root = Path(__file__).resolve().parent.parent
template = (root / 'src/index.template.html').read_text()
water = base64.b64encode((root / 'assets/current-water.webp').read_bytes()).decode()
css = (root / 'src/styles.css').read_text().replace('@@WATER_IMAGE@@', 'data:image/webp;base64,' + water)
template = template.replace('/* CURRENT_STYLES */', css)
for marker, filename in [('CURRENT_STATE', 'state.js'), ('CURRENT_ENGINE', 'engine.js'), ('CURRENT_APP', 'app.js')]:
    source = (root / 'src' / filename).read_text()
    if '</script' in source.lower():
        raise ValueError(f'Unsafe script closing tag in {filename}')
    template = template.replace(f'/* {marker} */', source)
(root / 'index.html').write_text(template)
print(f'Built index.html: {len(template.encode()):,} bytes, no runtime dependencies.')

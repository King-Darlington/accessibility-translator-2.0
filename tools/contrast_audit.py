import re
import os
import json

ROOT = os.path.dirname(os.path.dirname(__file__))
CSS_GLOB = []

var_regex = re.compile(r"--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);")
color_decl = re.compile(r"color\s*:\s*([^;]+);", re.IGNORECASE)
background_decl = re.compile(r"background(?:-color)?\s*:\s*([^;]+);", re.IGNORECASE)
var_use = re.compile(r"var\(--([a-zA-Z0-9-_]+)\)")
hex_color = re.compile(r"#([0-9a-fA-F]{3,6})")
name_to_hex = {
    'white': '#ffffff',
    'black': '#000000'
}


def expand_hex(h):
    h = h.lstrip('#')
    if len(h) == 3:
        return '#' + ''.join(c*2 for c in h)
    return '#' + h


def hex_to_rgb(h):
    h = expand_hex(h)
    return tuple(int(h[i:i+2],16) for i in (1,3,5))


def relative_luminance(rgb):
    srgb = [v/255.0 for v in rgb]
    def f(c):
        return c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    r,g,b = [f(c) for c in srgb]
    return 0.2126*r + 0.7152*g + 0.0722*b


def contrast_ratio(hex1, hex2):
    try:
        l1 = relative_luminance(hex_to_rgb(hex1))
        l2 = relative_luminance(hex_to_rgb(hex2))
    except Exception:
        return None
    lighter = max(l1,l2)
    darker = min(l1,l2)
    return (lighter+0.05)/(darker+0.05)


def parse_vars_from_file(path):
    vars = {}
    try:
        with open(path,'r',encoding='utf-8') as f:
            text = f.read()
    except Exception:
        return vars
    # crude parse: look for :root { ... }
    root_match = re.search(r":root\s*\{([\s\S]*?)\}", text)
    if root_match:
        body = root_match.group(1)
        for m in var_regex.finditer(body):
            name = m.group(1)
            val = m.group(2).strip()
            vars[name] = val
    # also global vars anywhere
    for m in var_regex.finditer(text):
        name = m.group(1)
        val = m.group(2).strip()
        vars.setdefault(name,val)
    return vars


def normalize_color(val, vars_map):
    if not val: return None
    val = val.strip()
    # if var(--name)
    vm = var_use.search(val)
    if vm:
        vn = vm.group(1)
        resolved = vars_map.get(vn)
        if resolved:
            return normalize_color(resolved, vars_map)
    # if hex
    mh = hex_color.search(val)
    if mh:
        return expand_hex('#'+mh.group(1))
    # named color
    low = val.lower()
    if low in name_to_hex:
        return name_to_hex[low]
    # rgba/hsla - try extract rgb numbers
    rgba = re.search(r"rgba?\s*\(([^)]+)\)", val)
    if rgba:
        parts = rgba.group(1).split(',')
        try:
            r = int(parts[0].strip())
            g = int(parts[1].strip())
            b = int(parts[2].strip())
            return '#{0:02x}{1:02x}{2:02x}'.format(r,g,b)
        except Exception:
            return None
    return None


def scan_css_files():
    css_files = []
    for dirpath,dirnames,filenames in os.walk(ROOT):
        for fn in filenames:
            if fn.endswith('.css'):
                css_files.append(os.path.join(dirpath,fn))
    all_vars = {}
    # parse vars from main-styles.css first if present
    main = os.path.join(ROOT,'css','main-styles.css')
    if os.path.exists(main):
        all_vars.update(parse_vars_from_file(main))
    # also parse popup.css
    popup = os.path.join(ROOT,'extension','styles','popup.css')
    if os.path.exists(popup):
        all_vars.update(parse_vars_from_file(popup))
    # fallback parse all css for vars
    for f in css_files:
        all_vars.update(parse_vars_from_file(f))

    reports = []
    for path in css_files:
        with open(path,'r',encoding='utf-8') as f:
            lines = f.readlines()
        for i,line in enumerate(lines):
            if 'var(--accent)' in line or '#FFC20A' in line.upper() or 'var(--accent-dark)' in line:
                # collect context
                start = max(0,i-8)
                end = min(len(lines),i+8)
                context = ''.join(lines[start:end])
                # look for nearby color declarations
                fg = None
                bg = None
                # search within the same rule approx: from start to end
                for l in lines[start:end]:
                    cd = color_decl.search(l)
                    if cd:
                        fg = cd.group(1).strip()
                    bd = background_decl.search(l)
                    if bd:
                        bg = bd.group(1).strip()
                # normalize
                fg_norm = normalize_color(fg, all_vars) if fg else None
                bg_norm = normalize_color(bg, all_vars) if bg else None
                reports.append({
                    'file': os.path.relpath(path,ROOT),
                    'line': i+1,
                    'snippet': line.strip(),
                    'fg_raw': fg,
                    'bg_raw': bg,
                    'fg': fg_norm,
                    'bg': bg_norm
                })
    return reports, all_vars

if __name__ == '__main__':
    reports, vars_map = scan_css_files()
    # compute contrasts where possible
    results = []
    for r in reports:
        fg = r['fg']
        bg = r['bg']
        if not fg:
            # if the var usage was in background (accent used as background), assume text color nearby is white
            # if raw snippet contains 'var(--accent)' and nearby 'color: white' earlier we already captured fg
            pass
        ratio = None
        status = 'unknown'
        if fg and bg:
            ratio = contrast_ratio(fg,bg)
            if ratio:
                status = 'PASS' if ratio>=4.5 else 'FAIL'
        else:
            # attempt to detect common pattern: white text over accent background
            if r['snippet'] and ('var(--accent)' in r['snippet'] or '#FFC20A' in r['snippet'].upper()):
                # check if nearby context had color:white
                # search snippet context for color: white
                if r['fg_raw'] and ('white' in r['fg_raw'].lower() or '#fff' in (r['fg_raw'] or '').lower()):
                    # compute accent vs white
                    accent = normalize_color('var(--accent)', vars_map)
                    ratio = contrast_ratio(accent, normalize_color('white', vars_map))
                    if ratio:
                        status = 'PASS' if ratio>=4.5 else 'FAIL'
                else:
                    # check if nearby had color: white within snippet (already if fg_raw)
                    pass
        r['contrast'] = ratio
        r['status'] = status
        results.append(r)

    out = {
        'vars': vars_map,
        'findings': results
    }
    print(json.dumps(out, indent=2))

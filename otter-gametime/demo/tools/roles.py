"""一次性迁移：把源样式里写死的白色薄底 / 描边换成表面角色令牌（:root 与 body.light 各有一套值），
并删掉 light.auto.css 里对同一选择器、同一属性的逐条翻译 —— 那些翻译会按加载顺序盖住令牌。

角色见 index.html :root「表面角色」。用法：python3 tools/roles.py（在 docs/mockup 下）。
"""
import re

SRC = ['v3.css', 'me2.css', 'expr.css', 'share.css', 'compose.css', 'alive.css', 'battle.css',
       'mine.css', 'memory.css', 'brand.css', 'pet.css', 'scroll.css', 'empty.css']

RAISE = {
    '.ib', '.slab.ghost', '.chip', '.ex-dock .pill.ghost', '.ai-pre button', '.ct-brief .k button',
    '.ct-stk button', '.tk-plan .ops button', '.me-mem .mm-go button', '.pa-card .acts .no',
    '.pa-card .feel button, .pa-card .opts button', '.pa-in button', '.pa-skin .grid button',
    '.lf-stage .btns .sec', '.sx-acts .ib', '.xp-grid button', '.ex-pick .xp-grid button',
    '.cp-link.empty .ic', '.df-card', '.tr-row', '.lk-row', '.pa-hd .skin',
}
TRACK = {
    '.h3-split .bar', '.g3-realm', '.sw3', '.ct-in', '.sc-cap textarea', '.pa-in textarea', '.gm-bar',
    '.tk-plan .bar', '.sc-seg', '.st-bar', '.sh-search', '.m3-week .budget',
}
WELL = {
    '.g3-foot .heat i', '.m3-week .b.empty .col', '.ft-year i', '.cp-media > div', '.gm3 .add .bx',
    '.h3-week .d .f', '.sh3 .grp', '.td-list .pr', '.lm-ring .c .mood', '.cal-gd .c.on', '.cn-eye',
    '.sh-hd .r', '.si.av, .si.logo', '.ct-day span', '#ctModel.off', '.cp-link .ic', '.cp-link .sw',
    '.tk-done .chips span', '.al-chips span', '.ca-rec', '.mm-doors .heat i', '.mm-doors .dots i',
    '.fp-lg i', '.mn-rhythm .wk i', '.me2 .nums .n', '.ntv', '.ai-pre .cu .cn-lg', '#ntSnd .pl.mute',
    '.cp-link.empty', '.lf-stage .rows div', '.df-card .cv', '.mn-mood .seg i.rest',
}
PRESS = {
    '.m3-row:active', '.md-list .md-row:active', ':is(.s3,.sh3) .rw[role="button"]:active',
    '.df-card:active, .df-card.pick',
}
SEP = {'.g3-chips .sep'}
# 有色 hero：渐变收尾的白 .02/.03 → --wash（日间透明，交给玻璃）
WASH = {'.shot3.note', '.ca-hero', '#calDay.rich', '.pf-card', '.gm-top', '.mn-first', '.cn-prev',
        '.cp-link', '.tr-hero', '.rd-feel'}

WHITE = r'rgba\(255, ?255, ?255, ?\.?\d*\)'
touched = {}  # selector -> set(props)


def norm(sel):
    return ' '.join(sel.split())


def convert(sel, body):
    kind = ('raise' if sel in RAISE else 'track' if sel in TRACK else 'well' if sel in WELL
            else 'press' if sel in PRESS else 'sep' if sel in SEP else 'wash' if sel in WASH else None)
    if not kind:
        return body
    decls = [d for d in body.split(';')]
    props = {d.split(':', 1)[0].strip() for d in decls if ':' in d}
    out, done = [], set()
    for d in decls:
        if ':' not in d:
            out.append(d)
            continue
        k, v = d.split(':', 1)
        p = k.strip()
        if not re.search(WHITE, v):
            out.append(d)
            continue
        lead = k[:len(k) - len(k.lstrip())]
        if kind == 'wash' and p == 'background':
            v2 = re.sub(r'rgba\(255, ?255, ?255, ?\.0[23]\)', 'var(--wash)', v)
            if v2 != v:
                out.append(f'{k}:{v2}')
                done.add(p)
                continue
            out.append(d)
            continue
        if p in ('background', 'background-color'):
            role = {'raise': 'var(--raise)', 'track': 'var(--well)', 'well': 'var(--well)',
                    'press': 'var(--press)', 'sep': 'var(--sep)'}[kind]
            out.append(f'{lead}background:{role}')
            done.add('background')
        elif p in ('border', 'border-color'):
            dashed = 'dashed' in v
            role = ('var(--dash)' if dashed else 'var(--raise-edge)' if kind == 'raise'
                    else 'var(--sep)')
            out.append(f'{k}:' + re.sub(WHITE, role, v))
            done.add('border')
        else:
            out.append(d)
    if kind == 'raise':
        if 'box-shadow' not in props:
            out.insert(len(out) - (1 if out and not out[-1].strip() else 0), ' box-shadow:var(--raise-sh)')
            done.add('box-shadow')
        if 'backdrop-filter' not in props:
            out.insert(len(out) - (1 if out and not out[-1].strip() else 0),
                       ' -webkit-backdrop-filter:var(--raise-blur); backdrop-filter:var(--raise-blur)')
            done.add('backdrop-filter')
    if kind == 'track' and 'box-shadow' not in props:
        out.insert(len(out) - (1 if out and not out[-1].strip() else 0), ' box-shadow:var(--well-sh)')
        done.add('box-shadow')
    if done:
        touched.setdefault(sel, set()).update(done)
    return ';'.join(out)


def surfaces():
    for f in SRC:
        s = open(f).read()

        def rep(m):
            sel = norm(m.group(1))
            return m.group(1) + '{' + convert(sel, m.group(2)) + '}'
        s2 = re.sub(r'(?<=[}\n/])([^{}/]+?)\{([^{}]*)\}', rep, s)
        if s2 != s:
            open(f, 'w').write(s2)

    # light.auto.css：删同选择器同属性的翻译
    auto = open('light.auto.css').read()
    DROP = {'background': ('background', 'background-color'), 'border': ('border', 'border-color'),
            'box-shadow': ('box-shadow',), 'backdrop-filter': ('backdrop-filter', '-webkit-backdrop-filter')}
    removed = 0


    def strip_auto(m):
        nonlocal removed
        sel = norm(m.group(1)).replace(':where(body.light) ', '')
        if sel not in touched:
            return m.group(0)
        kill = {x for p in touched[sel] for x in DROP.get(p, (p,))}
        keep = []
        for d in m.group(2).split(';'):
            if ':' in d and d.split(':', 1)[0].strip() in kill:
                removed += 1
                continue
            keep.append(d)
        body = ';'.join(keep).strip().strip(';').strip()
        return '' if not body else m.group(1) + '{' + body + '}'


    def strip_line(m):
        out = strip_auto(m)
        return out + '\n' if out and m.group(0).endswith('\n') else out


    auto = re.sub(r'(:where\(body\.light\)[^{}]+)\{([^{}]*)\}\n?', strip_line, auto)
    open('light.auto.css', 'w').write(auto)
    print('selectors', len(touched), 'auto decls removed', removed)
    missing = (RAISE | TRACK | WELL | PRESS | SEP | WASH) - set(touched)
    print('not found', sorted(missing))




def text_mix():
    """信号色作字：把 light.auto.css 里的 `color-mix(C 60%, #1A1726)` 收回源样式，写成两主题同一公式。"""
    auto = open('light.auto.css').read()
    rx = re.compile(r'color-mix\(in srgb, ?rgba\((var\([^)]*\)|[^()]*?),1\) 60%, ?#1A1726\)')
    want = {}  # selector -> {prop: inner}
    for m in re.finditer(r':where\(body\.light\) ([^{}]+)\{([^{}]*)\}', auto):
        for d in m.group(2).split(';'):
            if ':' in d and rx.search(d):
                p, v = d.split(':', 1)
                want.setdefault(norm(m.group(1)), {})[p.strip()] = v.strip()
    hit = set()
    for f in SRC:
        s = open(f).read()

        def rep(m):
            sel = norm(m.group(1))
            if sel not in want:
                return m.group(0)
            out = []
            for d in m.group(2).split(';'):
                if ':' in d and d.split(':', 1)[0].strip() in want[sel]:
                    k, _ = d.split(':', 1)
                    v = rx.sub(lambda x: f'color-mix(in srgb, rgb({x.group(1)}) var(--tx-mix), var(--hi))',
                               want[sel][k.strip()])
                    out.append(f'{k}:{v}')
                    hit.add((sel, k.strip()))
                else:
                    out.append(d)
            return m.group(1) + '{' + ';'.join(out) + '}'
        s2 = re.sub(r'(?<=[}\n/])([^{}/]+?)\{([^{}]*)\}', rep, s)
        if s2 != s:
            open(f, 'w').write(s2)

    def strip(m):
        sel = norm(m.group(1)).replace(':where(body.light) ', '')
        keep = [d for d in m.group(2).split(';')
                if not (':' in d and (sel, d.split(':', 1)[0].strip()) in hit)]
        body = ';'.join(keep).strip().strip(';').strip()
        return (m.group(1) + '{' + body + '}' + ('\n' if m.group(0).endswith('\n') else '')) if body else ''
    auto = re.sub(r'(:where\(body\.light\)[^{}]+)\{([^{}]*)\}\n?', strip, auto)
    open('light.auto.css', 'w').write(auto)
    print('text-mix moved', len(hit), 'of', sum(len(v) for v in want.values()))


if __name__ == '__main__':
    import sys
    {'surfaces': surfaces, 'text': text_mix}[sys.argv[1]]()

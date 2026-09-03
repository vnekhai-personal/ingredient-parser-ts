"""Parse ad-hoc lines with the BRILL-trained model (repo package, model swapped in,
tags supplied from natural's Brill via BRILL_TAGS_FILE)."""
import sys
sys.path.insert(0, 'ip-repo')
from ingredient_parser import parse_ingredient

for line in open('bluegill-lines.txt'):
    line = line.strip()
    if not line: continue
    p = parse_ingredient(line)
    print('LINE:', line)
    print('  names:  ', [(n.text, round(n.confidence, 2)) for n in p.name])
    print('  amounts:', [(str(a.quantity), str(a.unit), 'approx' if a.APPROXIMATE else '') for a in p.amount] or '-')
    print('  prep:   ', p.preparation.text if p.preparation else '-')
    print('  comment:', p.comment.text if p.comment else '-')
    print('  purpose:', p.purpose.text if p.purpose else '-')
    print()

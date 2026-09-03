"""Deep-evaluation input generator: out-of-distribution / adversarial ingredient lines built by
mutating corpus sentences plus hand-written trap families. Deterministic (seed 42).
Usage: python training/gen-fuzz-lines.py [n_mutations=4000] > fuzz-lines.txt
"""
import random, sqlite3, sys
random.seed(42)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 4000
db = sqlite3.connect('training/data/training.sqlite3')
corpus = [s for (s,) in db.execute('select sentence from en')]
random.shuffle(corpus)

UNI_FRAC = "½ ⅓ ⅔ ¼ ¾ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞".split()
HTML = ["&frac12;", "&frac14;", "&frac34;", "&amp;", "&nbsp;", "&#189;", "&#x00BD;", "&deg;", "&frac12", "&notanentity;", "&amp", "&#0;", "&#xD800;"]
DASHES = ["-", "–", "—", "‑", "−"]
WS = [" ", "  ", "\t", " ", " ", "　"]
NUMS = ["1", "1.5", "1,5", "1/2", "1 1/2", "1-2", "1–2", "1 to 2", "1 or 2", "1x", "2 x", "1e3", "١٢", "1_000", "0x10", ".5", "5.", "1/0", "80/20", "70/30", "00", "007", "3½", "1¼", "1 ½", "twelve", "a dozen", "half", "one and a half", "1 and 1/2", "two-three", "2-to-3", "1 - 2", "0.25  -0.5"]
UNITS = ["cup", "cups", "c", "C", "tbsp", "tbsp.", "Tbsp", "tablespoons", "tsp.", "TSP", "g", "G", "kg", "ml", "mL", "l", "L", "fl oz", "fl. oz.", "oz", "ounces", "lb", "lbs.", "pinch", "clove", "cloves", "can", "cans", "stick", "unit", "bar", "tin", "pint", "pints", "qt", "gal", "inch", "in", "cm", "mm", "each", "x", "%"]
FOODS = ["olive oil", "Olive Oil", "OLIVE OIL", "jalapeño", "crème fraîche", "Gruyère", "purée", "naïve tofu", "café au lait", "chilli", "chili", "courgette", "aubergine", "coriander", "cilantro", "salt", "sea salt", "flour", "all-purpose flour", "eggs", "egg", "butter", "sugar", "rice", "dill", "pepper", "black pepper", "flat-leaf parsley", "thumb-sized ginger", "medium-length carrots", "100% cocoa", "tomatoes (canned)", "beef (or lamb)", "chicken thighs, boneless and skinless", "\U0001f345 tomatoes", "tomatoes \U0001f345", "\U0001d495omatoes", "ｔomatoes"]
TRAPS = [
    "", " ", "\t", "   ", ".", ",", "(", ")", "()", "((", "))", "[", "]", "{", "}", "-", "--", "---", "/", "//", "*", "~", "!", "?", ":", ";", "&", "\"", "'", "''", "…", "°", "°F", "°C",
    "1", "1/2", "½", "2 cups", "cups", "Cups", "CUPS", "a", "A", "an", "the", "of", "and", "or", "and/or", "and / or", "plus", "minus", "less", "or so", "each",
    "2 tbsp (30 ml) olive oil, plus more", "2 tbsp/30ml olive oil", "2tbsp olive oil", "2Tbsp olive oil", "2 TBSP OLIVE OIL", "2 tbsps olive oil", "2 tbsp. olive oil.", "2 tbsp olive oil..", "2 tbsp olive oil ...", "2 tbsp olive oil (see note)", "2 tbsp olive oil (see note", "2 tbsp olive oil see note)", "2 tbsp olive oil ($1.99)", "2 tbsp olive oil (£1.50*)", "2 tbsp olive oil ( € 2 )",
    "1 (15-ounce) can chickpeas", "1 15 oz can chickpeas", "1 15oz can chickpeas", "15 oz. can chickpeas", "one 15-oz can chickpeas", "1 x 400g can tomatoes", "2 x 400 g cans tomatoes", "400g can chopped tomatoes", "400 g / 14 oz can tomatoes", "1 lb 2 oz flour", "1 pint 2 fl oz milk", "1 pint 2 floz milk", "1 cup plus 2 tablespoons flour", "1 cup + 2 tbsp flour", "1 cup, plus 2 tablespoons flour", "1 cup minus 2 tbsp flour", "1 cup less 2 tbsp flour", "1 cup and 2 tbsp flour",
    "1/4 to 1/2 teaspoon salt", "¼–½ tsp salt", "1/4-1/2 tsp salt", "1/4 - 1/2 tsp salt", "1 to 2 cups", "1 or 2 cups", "5- or 6-large apples", "3–4 sirloin steaks", "3 - 4 sirloin steaks", "8 x 450g/1lb live lobsters", "0.5 c to 1 cup shelled pistachios", "227 g - 283.5 g/8-10 oz duck breast", "400-500 g/14 oz - 17 oz rhubarb",
    "about 2 cups flour", "approx. 2 cups flour", "approximately 2 cups flour", "roughly 2 cups", "~2 cups flour", "2 generous cups flour", "2 cups or so flour", "2 cups flour or so", "each nearly 200 g potatoes", "5 lbs or so each", "to yield 2 cups", "to make about 250 g",
    "salt to taste", "salt, to taste", "salt and pepper to taste", "salt & pepper", "Salt", "SALT", "sea salt flakes", "flaky sea salt, for finishing", "kosher salt, plus more for seasoning",
    "juice of 1 lemon", "zest and juice of 2 limes", "1 lemon, juiced", "a squeeze of lemon", "a handful of parsley", "A mess of greens", "a few sprigs thyme", "several cloves garlic", "some flour", "plenty of oil",
    "2 tablespoon (tbsp) butter", "1 teaspoon (tsp) salt", "teaspoon (tsp) black pepper", "1 unit shallot", "3 large eggs", "3 eggs, large", "3 medium-large eggs", "3 extra-large eggs", "1 large onion, thinly sliced", "1 onion, thinly sliced (about 1 cup)", "Onion, thinly sliced (about 1 cup)", "1 cup sifted flour", "100 g sifted flour", "1 cup flour, sifted",
    "For the sauce", "For the sauce:", "FOR THE SAUCE", "Not included in your delivery", "Serves 4", "Ingredients", "Method", "Preheat the oven to 180C", "1 cup (250 ml) whole milk, at room temperature, divided", "1 cup whole milk (or half-and-half, or a mix)",
    "naan or rice, to serve", "naan breads or cooked basmati rice, to serve", "1 red or green pepper", "1 red, yellow or green pepper", "butter or olive oil, or a mix", "chicken and/or beef stock", "beef and / or chicken stock",
    "½ x 250g block feta", "1/2 x 250 g block feta", "2 × 400 g cans", "1 lb (450g) ground beef", "1 lb/450 g ground beef", "1lb/450g ground beef", "100g/3½oz gammon", "100 g/3 ½ oz gammon", "2 3/4 lb boneless leg of lamb", "1 (3 1/2) pound leg of lamb", "1 4- to 5-pound leg of lamb", "12-ounce jar", "12 ounce jar", "one 12-ounce jar",
    "1 cup flour\t(sifted)", " 1 cup flour", "﻿1 cup flour", "1 cup flour​", "1 cup  flour", "1 cup flour", "1　cup flour",
    "2 tbsp olive oil" * 20, "very " * 60 + "long sentence of flour", ("1 cup flour, " * 40).rstrip(", "),
    "1 cup flour (Contains: Wheat)", "1 cup flour (contains: wheat, gluten)", "1 cup flour ( Contains : Wheat )", "1 cup flour [gluten-free ok]", "1 cup flour {optional}", "1 cup flour <optional>", "1 cup flour <b>optional</b>", "1 cup flour &lt;optional&gt;",
]

def mutate(s):
    r = random.random()
    if r < 0.12: return s.upper()
    if r < 0.22: return s.lower()
    if r < 0.30: return s.title()
    if r < 0.38: return s.replace(" ", random.choice(WS))
    if r < 0.46: return s.replace("-", random.choice(DASHES))
    if r < 0.54: return s.replace("1/2", random.choice(UNI_FRAC)).replace("1/4", random.choice(UNI_FRAC))
    if r < 0.60: return random.choice(HTML) + " " + s
    if r < 0.66: return s + random.choice(["", ".", "..", " .", "!", "?", ",", " ,", ")", " (", "*", " *", ";", ":", "…"])
    if r < 0.72: return random.choice(NUMS) + " " + random.choice(UNITS) + " " + s
    if r < 0.78: return s.replace(" ", "") if len(s) < 25 else s
    if r < 0.84: return " ".join(random.sample(s.split(), len(s.split()))) if s.split() else s
    if r < 0.90: return s + " " + random.choice(FOODS)
    if r < 0.95:
        i = random.randrange(len(s) + 1); return s[:i] + random.choice(["(", ")", ",", "/", "-", "&", "'", "\"", "½", "°", "é", "\U0001f345", " x ", " to ", " or "]) + s[i:]
    return random.choice(NUMS) + random.choice(["", " "]) + random.choice(UNITS) + " " + random.choice(FOODS)

out = list(TRAPS)
for n in NUMS:
    for u in random.sample(UNITS, 6):
        out.append(f"{n} {u} {random.choice(FOODS)}")
        out.append(f"{n}{u} {random.choice(FOODS)}")
for s in corpus[:N]:
    out.append(mutate(s))
seen = set(); uniq = []
for s in out:
    s = s.replace("\r", " ").replace("\n", " ")  # one line each
    if s not in seen:
        seen.add(s); uniq.append(s)
for s in uniq:
    print(s)
print(len(uniq), "fuzz lines", file=sys.stderr)

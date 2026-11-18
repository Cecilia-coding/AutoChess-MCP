"""Generate 20 original 24x24 pixel-art archetype sprites + 512x1088 atlases + 72x72 portraits
into assets/pixel-studio/ matching the exact 64x64 frame manifest spec used by pixelAppearances."""

from __future__ import annotations

import json
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "pixel-studio"
PORTRAITS_DIR = OUT_DIR / "portraits"
ATLASES_DIR = OUT_DIR / "atlases"

# Base shared palette tokens (extend per sprite)
BASE_PAL = {
    ".": (0, 0, 0, 0),
    "K": (36, 27, 53, 255),     # Crisp warm-plum dark pixel outline (#241b35)
    "W": (255, 253, 248, 255),  # Warm white highlight
    "S": (222, 228, 240, 255),  # Cool shadow white / steel light
    "M": (146, 158, 184, 255),  # Mid metal / slate
    "D": (88, 96, 122, 255),    # Dark metal
    "E": (34, 24, 46, 255),     # Eye dark
    "C": (244, 134, 152, 255),  # Rosy blush
    "G": (246, 206, 98, 255),   # Gold bright
    "g": (204, 152, 54, 255),   # Gold shade
    "B": (182, 126, 78, 255),   # Wood / bronze
    "b": (128, 82, 46, 255),    # Wood dark
    "F": (255, 224, 198, 255),  # Skin / cream
    "f": (232, 184, 150, 255),  # Skin shade
}

# Each unit: (id, label, role, color, effectKind, extra_palette, 24x24 rows, blink_face_color)
UNITS = [
    (
        "st-slime-knight",
        "史莱姆骑",
        "tank",
        "#62c49e",
        "shield_guard",
        {
            "1": (122, 222, 184, 255),  # Mint light
            "2": (82, 190, 150, 255),   # Mint mid
            "3": (52, 146, 114, 255),   # Mint shade
            "Y": (255, 114, 132, 255),  # Feather coral
        },
        [
            "..........KKK...........",
            ".........KYYYK..........",
            "..........KKK...........",
            ".......KKKKKKKK.........",
            "......KWWWWWWWWK........",
            ".....KSSSSSSSSSSK.......",
            "....KSSSSSSSSSSSSK......",
            "...KKKKKKKKKKKKKKKK.....",
            "...K11111111111111K.....",
            "..K1WW1111111111112K....",
            "..K1111E111111E1112K....",
            "..K111C11111111C112K....",
            "..K1111111EE1111112KK...",
            "KBBK111111111111122K....",
            "KBGK222222222222233K....",
            "KBBK222222222222233K....",
            "KbBK333333333333333K....",
            ".KKK33333333333333K.....",
            "...KKKKKKKKKKKKKKKK.....",
            "....K33K......K33K......",
            "....KKKK......KKKK......",
            "........................",
            "........................",
            "........................",
        ],
        (82, 190, 150, 255),
    ),
    (
        "st-clock-bunny",
        "发条兔",
        "melee",
        "#f2a2b4",
        "melee_slash",
        {
            "1": (255, 206, 222, 255),  # Bunny pink light
            "2": (240, 158, 182, 255),  # Bunny pink mid
            "3": (204, 114, 144, 255),  # Bunny pink shade
            "I": (255, 232, 238, 255),  # Inner ear
        },
        [
            ".....KKK.......KKK......",
            "....K111K.....K111K.....",
            "....K1I1K.....K1I1K.....",
            "....K1I1K.....K1I1K.....",
            "....K1I1K.....K1I1K.....",
            ".....K11K.....K11K......",
            ".....KKKKKKKKKKKKK......",
            "....K1111111111111K.....",
            "...K1WW111111111112K....",
            "...K111E111111E1112K....",
            "...K11C1111KK11C112K....",
            "....K2222222222223K.....",
            ".KKK.KKKKKKKKKKKKK......",
            "KGGGK111122222222K..KK..",
            ".KGKK1112GGGG2223K.KSWK.",
            "KGGGK222222222233K.KSWK.",
            ".KKK.K2222222233KKKKSWK.",
            ".....K3333333333K..KBBK.",
            "......KKKKKKKKKK....KK..",
            "......K22K..K22K........",
            "......K33K..K33K........",
            "......KKKK..KKKK........",
            "........................",
            "........................",
        ],
        (240, 158, 182, 255),
    ),
    (
        "st-shroom-guard",
        "蘑菇卫",
        "tank",
        "#d97762",
        "shield_guard",
        {
            "1": (228, 102, 84, 255),   # Red cap
            "2": (184, 68, 58, 255),    # Red shade
            "3": (244, 224, 192, 255),  # Cream stem
            "4": (212, 184, 146, 255),  # Cream shade
            "L": (122, 186, 108, 255),  # Moss shield
        },
        [
            "........................",
            ".......KKKKKKKKKK.......",
            ".....KK11WW111111KK.....",
            "....K111WWWW111WW11K....",
            "...K11111WW111WWWW11K...",
            "..K1WW111111111WW1112K..",
            "..KWWWW11111WW1111122K..",
            ".K11WW11111WWWW1112222K.",
            ".K22222222222222222222K.",
            "..KKKKKKKKKKKKKKKKKKKK..",
            "....K33333333333333K....",
            "....K33E3333333E334K....",
            "....K3C3333KK333C34K....",
            "...KK33333333333344K....",
            "..KLLK3333333333444K....",
            ".KLWWLK333333334444K....",
            ".KLLLLK44444444444K.....",
            "..KLLK.K444444444K......",
            "...KK...KKKKKKKKK.......",
            "........K44K..K44K......",
            "........KKKK..KKKK......",
            "........................",
            "........................",
            "........................",
        ],
        (244, 224, 192, 255),
    ),
    (
        "st-lantern-spirit",
        "提灯灵",
        "support",
        "#9ad6ec",
        "holy_heal",
        {
            "1": (212, 244, 255, 255),  # Ghost glow
            "2": (162, 218, 242, 255),  # Ghost cyan
            "3": (118, 178, 212, 255),  # Ghost shade
            "Y": (255, 216, 98, 255),   # Lantern flame
        },
        [
            "........................",
            "........KKKKKKKK........",
            "......KK11111111KK......",
            ".....K1WW111111111K.....",
            "....K11111111111112K....",
            "....K111E111111E112K....",
            "...K111C11111111C122K...",
            "...K1111111111111122K...",
            "...K1111111111111222K...",
            "...K1111111111111222KK..",
            "...K11111111111112KKGK..",
            "...K222222222222KKKYYYK.",
            "...K222222222222K.KYWYK.",
            "...K222222222222K.KYYYK.",
            "...K233222222332K..KGK..",
            "...K3K.K32K.K3K.K...K...",
            "....K...KK...K..........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (212, 244, 255, 255),
    ),
    (
        "st-cat-mage",
        "黑猫巫",
        "caster",
        "#8c72cf",
        "arcane_orb",
        {
            "1": (152, 124, 222, 255),  # Hat purple light
            "2": (114, 86, 186, 255),   # Hat purple mid
            "3": (68, 56, 92, 255),     # Black cat fur light
            "4": (48, 40, 68, 255),     # Black cat fur
            "A": (255, 206, 78, 255),   # Amber eye / star
        },
        [
            "..........KKKK..........",
            ".........K1112K.........",
            "........K111122K........",
            "........K111222K........",
            ".......K11112222K.......",
            "......KGGGGGGGGGGK......",
            "....KK222222222222KK....",
            "...KKKKKKKKKKKKKKKKKK...",
            ".....K333333333333K.....",
            "....K333AA3333AA334K....",
            "....K33C333KK333C34K....",
            ".....K444444444444K.....",
            ".....KKKKKKKKKKKKKK.KK..",
            "....K1112222222222KKAAK.",
            "....K1122GGGG22222KKWK..",
            "...K11222222222222KKBK..",
            "...K22222222222222K.BK..",
            "....KKKKKKKKKKKKKK..BK..",
            ".....K44K....K44K...KK..",
            ".....KKKK....KKKK.......",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (68, 56, 92, 255),
    ),
    (
        "st-crane-archer",
        "纸鹤弓",
        "ranged",
        "#7ab7eb",
        "ranged_bolt",
        {
            "1": (244, 250, 255, 255),  # Paper white
            "2": (184, 222, 250, 255),  # Sky fold
            "3": (122, 178, 230, 255),  # Sky shade
            "R": (240, 128, 118, 255),  # Crest coral
        },
        [
            "........................",
            "........KKK.............",
            ".......KRRRK............",
            "......K11111K...........",
            "..KKKK111E111K..........",
            ".KGGG11111111K..........",
            "..KKKKK111222K..........",
            "......K111222K...KK.....",
            ".....K1112222K..KBBK....",
            "....K111222222KKB.SK....",
            "...K11122233222KB.SK....",
            "..K112223333222KBWSK....",
            ".K1122333333222KB.SK....",
            "..KKKKKK3333222KB.SK....",
            ".......K333322KKB.SK....",
            "........K3333K..KBBK....",
            "........K333K....KK.....",
            ".......KGGGGK...........",
            ".......K22.22K..........",
            ".......KK...KK..........",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (244, 250, 255, 255),
    ),
    (
        "st-music-doll",
        "八音姬",
        "support",
        "#f0c46c",
        "holy_heal",
        {
            "1": (255, 224, 134, 255),  # Butter dress light
            "2": (236, 184, 86, 255),   # Butter dress shade
            "H": (124, 82, 68, 255),    # Cocoa hair
            "h": (92, 58, 48, 255),     # Hair shade
            "R": (234, 114, 144, 255),  # Ribbon rose
        },
        [
            "....KKK........KKK......",
            "...KHHHK......KHHHK.....",
            "...KRRKHHHHHHHHKRRK.....",
            "....KHHHHHHHHHHHHK......",
            "....KHHFFFFFFFFHHK......",
            "....KHFFEFFFFEFFHK......",
            "....KFFCFFFFFFCFFK......",
            ".....KFFFFFFFFFFK.......",
            "......KKKKKKKKKK........",
            "..KKK.K111RR111K........",
            ".KGGGK1111RR1112K.......",
            "..KGKK1111111112K.......",
            ".KGGGK1111111122K.......",
            "..KKK11111111222K.......",
            "....K11111111222K.......",
            "....K22222222222K.......",
            ".....KKKKKKKKKKK........",
            "......KFFK..KFFK........",
            "......KhhK..KhhK........",
            "......KKKK..KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (255, 224, 198, 255),
    ),
    (
        "st-crt-bot",
        "小电视",
        "caster",
        "#69c9b4",
        "arcane_orb",
        {
            "1": (234, 238, 226, 255),  # Cream monitor shell
            "2": (184, 194, 178, 255),  # Monitor shade
            "T": (38, 52, 62, 255),     # CRT screen dark
            "C": (102, 238, 206, 255),  # Glowing cyan pixel face
        },
        [
            ".....K..........K.......",
            "......K........K........",
            ".......K......K.........",
            "....KKKKKKKKKKKKKK......",
            "...K11111111111111K.....",
            "...K1KKKKKKKKKKKK2K.....",
            "...K1KTTTTTTTTTTK2K.....",
            "...K1KTCCTTTTCTCK2K.....",
            "...K1KTTTTTTTTTTK2K.....",
            "...K1KTTTCCCCCTTK2K.....",
            "...K1KTTTTTTTTTTK2K.....",
            "...K1KKKKKKKKKKKK2K.....",
            "...K22222222222222K.....",
            "....KKKKKKKKKKKKKK......",
            "......K111GG111K........",
            ".....K2211111122K.......",
            ".....K22K1111K22K.......",
            "......KK.KKKK.KK........",
            ".......K2K..K2K.........",
            ".......KKK..KKK.........",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (38, 52, 62, 255),
    ),
    (
        "st-tape-ranger",
        "磁带侠",
        "ranged",
        "#e8906e",
        "ranged_bolt",
        {
            "1": (244, 156, 114, 255),  # Coral body
            "2": (206, 112, 76, 255),   # Coral shade
            "L": (252, 240, 210, 255),  # Label cream
            "T": (58, 48, 68, 255),     # Tape dark
        },
        [
            "........................",
            "........................",
            "...KKKKKKKKKKKKKKKK.....",
            "..K1111111111111111K....",
            "..K1KKKKKKKKKKKKKK2K....",
            "..K1KLLLLLLLLLLLLK2K....",
            "..K1KLKKKLTTKLKKLK2K....",
            "..K1KLEWKLTTKLEWKL2K....",
            "..K1KLKKKLTTKLKKLK2K....",
            "..K1KLLLLLLLLLLLLK2K....",
            "..K1KKKKKKKKKKKKKK2K....",
            "..K111TTTTGGTTTT222K....",
            "..K22KKKKKKKKKKKK22K....",
            "...KKKKKKKKKKKKKKKK.....",
            "....KK22K....K22KK......",
            "...KBBK2K....K2KBBK.....",
            "....KK.KK....KK.KK......",
            "......K2K....K2K........",
            "......KKK....KKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (252, 240, 210, 255),
    ),
    (
        "st-floppy-squire",
        "软盘盾",
        "tank",
        "#5f8fd9",
        "shield_guard",
        {
            "1": (112, 162, 236, 255),  # Cobalt light
            "2": (76, 122, 198, 255),   # Cobalt mid
            "3": (52, 86, 152, 255),    # Cobalt shade
        },
        [
            "........................",
            "...KKKKKKKKKKKKKKK......",
            "..K11KSSSSSSSSSK11KK....",
            "..K11KSWWSSDDSSK1111K...",
            "..K11KSSSSSSSSSK1112K...",
            "..K11KSSSSSSSSSK1112K...",
            "..K111KKKKKKKKKK1112K...",
            "..K111E1111111E11112K...",
            "..K11C111111111C1112K...",
            "..K111KKKKKKKKKK1122K...",
            "..K11KWWWWWWWWWWK222K...",
            "..K11KWWGGGGGGGGK222K...",
            "..K22KWWWWWWWWWWK222K...",
            "..K22KWWSSSSSSSSK333K...",
            "..K333KKKKKKKKKK3333K...",
            "...KKKKKKKKKKKKKKKKK....",
            ".....K33K.....K33K......",
            ".....KMMK.....KMMK......",
            ".....KKKK.....KKKK......",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (112, 162, 236, 255),
    ),
    (
        "st-bulb-wisp",
        "灯泡精",
        "caster",
        "#f5d76e",
        "arcane_orb",
        {
            "1": (255, 234, 132, 255),  # Bulb glow
            "2": (244, 198, 76, 255),   # Bulb amber
            "L": (255, 252, 222, 255),  # Filament hot white
        },
        [
            ".......G.....G..........",
            "....G...........G.......",
            ".......KKKKKKKK.........",
            ".....KK111WW111KK.......",
            "....K1111WWWW1111K......",
            "...K111111LL111112K.....",
            "...K111E11LL11E112K.....",
            "...K11C11LLLL11C12K.....",
            "....K11111LL11112K......",
            ".....K1111221112K.......",
            "......K22222222K........",
            ".......KMMMMMMK.........",
            ".......KDDDDDDK.........",
            ".......KMMMMMMK.........",
            ".......KDDDDDDK.........",
            "........KKKKKK..........",
            ".......K2K..K2K.........",
            ".......KKK..KKK.........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (255, 234, 132, 255),
    ),
    (
        "st-gear-golem",
        "齿轮偶",
        "tank",
        "#b88a68",
        "shield_guard",
        {
            "1": (212, 162, 114, 255),  # Bronze light
            "2": (168, 120, 78, 255),   # Bronze mid
            "3": (120, 82, 50, 255),    # Bronze dark
            "T": (92, 236, 212, 255),   # Cyclops teal
        },
        [
            ".....KK........KK.......",
            "....KGGK......KGGK......",
            ".....KK.KKKKKK.KK.......",
            ".....KKK111111KKK.......",
            "....K111111111112K......",
            "....K11KKTTTKK112K......",
            "....K11KTTWTTK112K......",
            "....K11KKKKKKK112K......",
            "..KKKKKKKKKKKKKKKKKK....",
            ".KGGK111111111111KGGK...",
            "KGGGK1111GGGG1112KGGGK..",
            ".KGGK222222222223KGGK...",
            "..KKK222222222233KKK....",
            "....K222222222233K......",
            "....K333333333333K......",
            ".....KKKKKKKKKKKK.......",
            ".....K333K..K333K.......",
            ".....KBBBK..KBBBK.......",
            ".....KKKKK..KKKKK.......",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (212, 162, 114, 255),
    ),
    (
        "st-dice-imp",
        "骰子怪",
        "melee",
        "#e66e85",
        "melee_slash",
        {
            "1": (244, 122, 146, 255),  # Crimson rose
            "2": (204, 78, 108, 255),   # Shade rose
            "3": (158, 52, 80, 255),    # Deep rose
        },
        [
            "....KK..........KK......",
            "....KFK........KFK......",
            "....KKKKKKKKKKKKKK......",
            "...K11WW111111WW12K.....",
            "...K11WW111111WW12K.....",
            "...K11111111111112K.....",
            "...K111E11WW11E112K.....",
            "...K111111WW111112K.....",
            "...K11C11111111C12K.....",
            "...K22WW111111WW22K.....",
            "...K22WW111111WW23K.....",
            "...K22222222222233K.....",
            "....KKKKKKKKKKKKKK..KK..",
            "....K222222222223K.KSWK.",
            "...K2K2222222223K3KKSWK.",
            "...KK.KKKKKKKKKK.KKKBBK.",
            "......K33K..K33K....KK..",
            "......K33K..K33K........",
            "......KKKK..KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (244, 122, 146, 255),
    ),
    (
        "st-tower-keeper",
        "灯塔偶",
        "support",
        "#e8c07a",
        "holy_heal",
        {
            "1": (250, 238, 212, 255),  # Cream stone
            "2": (218, 198, 168, 255),  # Stone shade
            "R": (232, 118, 104, 255),  # Coral roof/stripe
        },
        [
            ".........KKKK...........",
            "........KRRRRK..........",
            ".......KRRRRRRK.........",
            "......KKKKKKKKKK........",
            ".......KGWWWWGK.........",
            ".......KGGWWGGK.........",
            "......KKKKKKKKKK........",
            "......K11111112K........",
            "......K11E11E12K........",
            "......K1C1111C2K........",
            ".....KRRRRRRRRRRK.......",
            ".....K1111111112K.......",
            "....K1111KKKK1112K......",
            "....KRRRRKbbKRRRRK......",
            "....K1111KbbK1112K......",
            "....K2222KKKK2222K......",
            "....KKKKKKKKKKKKKK......",
            ".....K22K....K22K.......",
            ".....KKKK....KKKK.......",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (250, 238, 212, 255),
    ),
    (
        "st-paper-boat",
        "折纸舟",
        "ranged",
        "#7cc7c4",
        "ranged_bolt",
        {
            "1": (250, 252, 255, 255),  # Paper crisp white
            "2": (132, 212, 206, 255),  # Teal hull
            "3": (84, 168, 166, 255),   # Teal shade
        },
        [
            "..........KK............",
            ".........K11K...........",
            "........K1111K..........",
            ".......K111111K.........",
            "......K11111111K........",
            ".....KKKKKKKKKKKK.......",
            "......K11111111K........",
            "......K1E1111E1K........",
            "......K1C1111C1K..KK....",
            "...KKKKKKKKKKKKKKKKWKK..",
            "..K1111111111111111KBBK.",
            "..K2222222222222222KKK..",
            "...K22222222222223K.....",
            "....K333333333333K......",
            ".....KKKKKKKKKKKK.......",
            "......K33K..K33K........",
            "......KKKK..KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (250, 252, 255, 255),
    ),
    (
        "st-hourglass-sage",
        "沙漏翁",
        "caster",
        "#b487d9",
        "arcane_orb",
        {
            "1": (196, 152, 234, 255),  # Lavender glass
            "2": (146, 104, 196, 255),  # Lavender shade
            "A": (255, 224, 128, 255),  # Golden sand
        },
        [
            "....KKKKKKKKKKKKKK......",
            "....KGGGGGGGGGGGGK......",
            "....KKKKKKKKKKKKKK......",
            ".....K1111111112K.......",
            ".....K11E1111E12K.......",
            "......K11AAAA12K........",
            ".......K1AAAA2K.........",
            "........K1AA2K..........",
            ".........KGGK...........",
            "........K1AA2K..........",
            ".......K11AA12K.........",
            "......K11AAAA12K........",
            ".....K11AAAAAA12K.......",
            ".....K2AAAAAAAA2K.......",
            "....KKKKKKKKKKKKKK......",
            "....KGGGGGGGGGGGGK......",
            "....KKKKKKKKKKKKKK......",
            "......K22K..K22K........",
            "......KKKK..KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (196, 152, 234, 255),
    ),
    (
        "st-moon-sprite",
        "弦月灵",
        "caster",
        "#f2cf68",
        "arcane_orb",
        {
            "1": (255, 228, 124, 255),  # Moon yellow light
            "2": (236, 186, 76, 255),   # Moon gold shade
            "3": (134, 118, 198, 255),  # Nightcloak violet
            "Y": (255, 248, 186, 255),  # Hanging star glow
        },
        [
            "........KKKKKK..........",
            "......KK111112KK........",
            ".....K11WW111222K.......",
            "....K1111111222KK.......",
            "....K111111KKKK.........",
            "...K111111K.....K.......",
            "...K111E11K....KYK......",
            "...K111C11K...KYYYK.....",
            "...K1111111K...KYK......",
            "....K1111111KK..K.......",
            "....K222111112KK........",
            ".....KK222222222K.......",
            ".......KKKKKKKKK........",
            "......K3333G3333K.......",
            ".....K33333333333K......",
            ".....K33333333333K......",
            "......KKKKKKKKKKK.......",
            ".......K22K.K22K........",
            ".......KKKK.KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (255, 228, 124, 255),
    ),
    (
        "st-cactus-boxer",
        "盆栽刺",
        "melee",
        "#6bb87b",
        "melee_slash",
        {
            "1": (122, 206, 134, 255),  # Cactus green light
            "2": (82, 168, 98, 255),    # Cactus green mid
            "3": (56, 126, 70, 255),    # Cactus shade
            "P": (246, 122, 156, 255),  # Blossom & glove
            "p": (204, 78, 114, 255),   # Glove shade
        },
        [
            "........KK..KK..........",
            ".......KPPKKPPK.........",
            "........KGGGGK..........",
            ".......KKKKKKKK.........",
            "......K11111112K........",
            "..KK..K11E11E12K..KK....",
            ".KPPK.K1C1111C2K.KPPK...",
            ".KPpKKK11111112KKKpPK...",
            "..KK11K111111122K11K....",
            "....KKK222222233KKK.....",
            "......K222222233K.......",
            ".....KKKKKKKKKKKK.......",
            ".....KBBBBBBBBBBK.......",
            ".....KbbbbbbbbbbK.......",
            "......KBBBBBBBBK........",
            "......KbbbbbbbbK........",
            ".......KKKKKKKK.........",
            ".......KbbK.KbbK........",
            ".......KKKK.KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (122, 206, 134, 255),
    ),
    (
        "st-tea-mimic",
        "茶壶匠",
        "support",
        "#c8b4db",
        "holy_heal",
        {
            "1": (222, 204, 242, 255),  # Lavender glaze
            "2": (176, 152, 208, 255),  # Glaze shade
            "3": (132, 108, 168, 255),  # Glaze deep
        },
        [
            ".................WW.....",
            "................WW......",
            "........KKKK............",
            ".......KGGGGK...........",
            ".....KKKKKKKKKK.........",
            "....K1111111112K........",
            "...K11WWWW111112K.......",
            "..KK111111111112KKK.....",
            ".K11K11E1111E112K11K....",
            ".K21K1C111111C12K21K....",
            "..KKK11111111112KKK.....",
            "....K11111111122K.......",
            "....K22222222223K.......",
            ".....K333333333K........",
            "......KKKKKKKKK.........",
            "......K33K..K33K........",
            "......KKKK..KKKK........",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (222, 204, 242, 255),
    ),
    (
        "st-star-knight",
        "星象棋",
        "melee",
        "#5c6ea8",
        "melee_slash",
        {
            "1": (122, 142, 206, 255),  # Indigo chess light
            "2": (84, 102, 164, 255),   # Indigo mid
            "3": (56, 68, 120, 255),    # Indigo deep
        },
        [
            "........KKK.............",
            ".......KGGGK............",
            "......K11111KK..........",
            ".....K11111112KK........",
            "....K111E1111112K.......",
            "....K11111111122K.......",
            ".....KKKKK11122K........",
            ".........K11122K........",
            "........K111122K........",
            ".......K111GG122K.......",
            "......K111GGGG222K......",
            "......K2222222233K......",
            ".....KKKKKKKKKKKKKK.....",
            ".....KGGGGGGGGGGGGK.....",
            "....K33333333333333K....",
            "....KKKKKKKKKKKKKKKK....",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
            "........................",
        ],
        (122, 142, 206, 255),
    ),
]


def render_grid(rows: list[str], extra_pal: dict[str, tuple[int, int, int, int]]) -> Image.Image:
    assert len(rows) == 24, f"Expected 24 rows, got {len(rows)}"
    pal = {**BASE_PAL, **extra_pal}
    # Trim trailing empty rows to find natural foot row so bottom lands cleanly at y=22 of 24x24
    last_non_empty = max(i for i, r in enumerate(rows) if any(ch != "." for ch in r))
    shift_down = max(0, 22 - last_non_empty)
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        assert len(row) == 24, f"Row {y} len={len(row)} != 24: {row}"
        ny = y + shift_down
        if not (0 <= ny < 24):
            continue
        for x, ch in enumerate(row):
            col = pal.get(ch)
            if col is None:
                raise KeyError(f"Unknown pixel token {ch!r}")
            px[x, ny] = col
    return img


def make_blink_variant(base: Image.Image, rows: list[str], face_color: tuple[int, int, int, int]) -> Image.Image:
    im = base.copy()
    last_non_empty = max(i for i, r in enumerate(rows) if any(ch != "." for ch in r))
    shift_down = max(0, 22 - last_non_empty)
    px = im.load()
    for y, row in enumerate(rows):
        ny = y + shift_down
        if not (0 <= ny < 24):
            continue
        for x, ch in enumerate(row):
            if ch == "E":
                px[x, ny] = face_color
    return im


def place_in_frame(sprite24: Image.Image, dx: int = 0, dy: int = 0, squash_y: int = 0) -> Image.Image:
    """Place a 24x24 sprite anchored at (32, 40) inside a 64x64 cell."""
    frame = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    # Feet in sprite24 rest at y=23 (bottom of non-empty). Align y=23 -> y=40 => top = 17 + dy.
    w, h = 24, max(16, 24 - squash_y)
    src = sprite24 if squash_y == 0 else sprite24.resize((w, h), Image.Resampling.NEAREST)
    paste_x = 20 + dx
    paste_y = 17 + (24 - h) + dy
    frame.paste(src, (paste_x, paste_y), src)
    return frame


def add_slash_fx(frame: Image.Image, color_hex: str) -> None:
    r = int(color_hex[1:3], 16)
    g = int(color_hex[3:5], 16)
    b = int(color_hex[5:7], 16)
    d = ImageDraw.Draw(frame)
    # Crisp 2px pixel arc smear to the right of the sprite
    arc = [(45, 21), (47, 23), (48, 25), (48, 28), (47, 30), (45, 32)]
    for x, y in arc:
        d.rectangle([x, y, x + 1, y + 1], fill=(255, 255, 255, 235))
        d.point((x + 2, y), fill=(r, g, b, 220))


def add_white_flash(frame: Image.Image) -> Image.Image:
    out = frame.copy()
    px = out.load()
    for y in range(64):
        for x in range(64):
            r, g, b, a = px[x, y]
            if a > 0:
                px[x, y] = (min(255, r + 95), min(255, g + 85), min(255, b + 110), a)
    return out


def add_mood_badge(frame: Image.Image, mood: str, fidx: int) -> None:
    px = frame.load()
    if mood == "cry":
        dy = fidx % 2
        px[25, 29 + dy] = (120, 215, 255, 255)
        px[25, 30 + dy] = (190, 240, 255, 255)
    elif mood == "shock" and fidx < 3:
        # Tiny ! exclamation above head
        for y in (12, 13, 14, 16):
            px[38, y] = (255, 225, 95, 255)
            px[37, y] = (36, 27, 53, 255)
            px[39, y] = (36, 27, 53, 255)
    elif mood == "serious":
        px[32, 16] = (255, 196, 118, 230)


def build_atlas(sprite24: Image.Image, blink24: Image.Image, color_hex: str) -> Image.Image:
    atlas = Image.new("RGBA", (512, 1088), (0, 0, 0, 0))
    moods = ["happy", "serious", "cry", "shock"]

    for m_idx, mood in enumerate(moods):
        base_row = m_idx * 4
        tremble = 1 if mood == "cry" else 0
        # Row +0: idle (4 frames)
        idle_specs = [
            (sprite24, 0, 0, 0),
            (sprite24, tremble, 0, 1),
            (sprite24, 0, 0, 0),
            (blink24, -tremble, 0, 0),
        ]
        for col, (src, dx, dy, sq) in enumerate(idle_specs):
            fr = place_in_frame(src, dx, dy, sq)
            add_mood_badge(fr, mood, col)
            atlas.paste(fr, (col * 64, base_row * 64))

        # Row +1: walk (4 frames)
        walk_specs = [(0, -2, 0), (1, 0, 1), (0, -1, 0), (-1, 0, 0)]
        for col, (dx, dy, sq) in enumerate(walk_specs):
            fr = place_in_frame(sprite24, dx, dy, sq)
            add_mood_badge(fr, mood, col)
            atlas.paste(fr, (col * 64, (base_row + 1) * 64))

        # Row +2: attack (8 frames matching clip length)
        atk_specs = [
            (-2, 0, 0, False),
            (-3, 0, 1, False),
            (2, -1, 0, False),
            (5, -2, 0, True),
            (5, -2, 0, True),
            (4, -1, 0, True),
            (2, 0, 0, False),
            (0, 0, 0, False),
        ]
        for col, (dx, dy, sq, fx) in enumerate(atk_specs):
            fr = place_in_frame(sprite24, dx, dy, sq)
            if fx:
                add_slash_fx(fr, color_hex)
            add_mood_badge(fr, mood, col)
            atlas.paste(fr, (col * 64, (base_row + 2) * 64))

        # Row +3: hurt (3 frames)
        hurt_specs = [(-2, 0, True), (-4, 0, True), (-2, 0, False)]
        for col, (dx, dy, flash) in enumerate(hurt_specs):
            fr = place_in_frame(sprite24, dx, dy, 0)
            if flash:
                fr = add_white_flash(fr)
            atlas.paste(fr, (col * 64, (base_row + 3) * 64))

    # Row 16: dead (knocked down onto side, muted opacity)
    fallen = sprite24.transpose(Image.Transpose.ROTATE_90)
    r, g, b, a = fallen.split()
    a = a.point(lambda v: int(v * 0.72))
    fallen = Image.merge("RGBA", (r, g, b, a))
    dead_frame = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    dead_frame.paste(fallen, (24, 24), fallen)
    atlas.paste(dead_frame, (0, 16 * 64))
    return atlas


def build_manifest(base_clips: dict) -> dict:
    return {
        "version": 1,
        "pack": "studio",
        "pixelGrid": 24,
        "frame": {
            "width": 64,
            "height": 64,
            "columns": 8,
            "rows": 17,
            "anchor": {"x": 32, "y": 40},
        },
        "atlas": {"width": 512, "height": 1088},
        "clips": base_clips,
        "units": [
            {
                "id": uid,
                "spriteId": uid.removeprefix("st-"),
                "name": label,
                "atlas": f"atlases/{uid}.png",
                "portrait": f"portraits/{uid}.png",
                "previewRole": role,
                "color": color,
                "effectKind": effect_kind,
            }
            for uid, label, role, color, effect_kind, *_ in UNITS
        ],
    }


def main() -> None:
    PORTRAITS_DIR.mkdir(parents=True, exist_ok=True)
    ATLASES_DIR.mkdir(parents=True, exist_ok=True)

    ref_manifest = json.loads((ROOT / "assets" / "pixel-mascots" / "manifest.json").read_text(encoding="utf-8"))
    manifest = build_manifest(ref_manifest["clips"])
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Contact sheet for immediate visual QA (5 cols x 4 rows)
    sheet = Image.new("RGBA", (5 * 96, 4 * 96), (245, 242, 252, 255))
    draw = ImageDraw.Draw(sheet)

    for idx, (uid, label, role, color, _fx, extra_pal, rows, face_col) in enumerate(UNITS):
        s24 = render_grid(rows, extra_pal)
        b24 = make_blink_variant(s24, rows, face_col)
        portrait = s24.resize((72, 72), Image.Resampling.NEAREST)
        portrait.save(PORTRAITS_DIR / f"{uid}.png")
        atlas = build_atlas(s24, b24, color)
        atlas.save(ATLASES_DIR / f"{uid}.png")

        gx, gy = (idx % 5) * 96, (idx // 5) * 96
        draw.rectangle([gx + 4, gy + 4, gx + 91, gy + 91], outline=(160, 146, 196, 255), fill=(255, 253, 255, 255))
        sheet.paste(portrait, (gx + 12, gy + 8), portrait)
        draw.text((gx + 8, gy + 78), uid.replace("st-", ""), fill=(68, 56, 99, 255))

    sheet_path = pathlib.Path(r"C:\Users\扶苏\.gemini\antigravity\brain\3ab5c759-e25d-4ff2-aafc-e3218af0f691\scratch\studio-sprites-sheet.png")
    sheet.save(sheet_path)
    print(f"Generated {len(UNITS)} original pixel sprites into {OUT_DIR}")


if __name__ == "__main__":
    main()

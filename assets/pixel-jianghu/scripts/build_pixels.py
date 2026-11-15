#!/usr/bin/env python3
"""
Deterministic pure-Python pixel-art asset generator for `jianghu` (夜航船).
Generates:
  - 40 x 512x1088 (8x17 @ 64x64) RGBA unit animation atlases
  - 40 x 72x72 RGBA unit portraits
  - 1  x 64x64 lantern-ward shield overlay
  - Bold outlined 96x96 skill/attack/symbol VFX sheets & 128x128 event VFX sheets
  - manifest.json, effects/manifest.json, effects/events/manifest.json
  - contact-sheet.png for visual inspection
"""

from __future__ import annotations

import json
import math
import os
import struct
import zlib
from pathlib import Path

# ── PNG encoder (pure stdlib RGBA) ─────────────────────────────────────────────

def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    stride = width * 4
    raw = bytearray((stride + 1) * height)
    for y in range(height):
        raw[y * (stride + 1)] = 0
        raw[y * (stride + 1) + 1 : (y + 1) * (stride + 1)] = rgba[y * stride : (y + 1) * stride]

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw), 6)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    path.write_bytes(png)


def hex_rgba(c: str | tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    if isinstance(c, tuple):
        return c
    h = c.lstrip("#")
    if len(h) == 6:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    if len(h) == 8:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    raise ValueError(f"Bad color: {c}")


class Canvas:
    __slots__ = ("w", "h", "buf")

    def __init__(self, w: int, h: int, bg: str | tuple[int, int, int, int] | None = None):
        self.w = w
        self.h = h
        self.buf = bytearray(w * h * 4)
        if bg is not None:
            r, g, b, a = hex_rgba(bg)
            px = bytes((r, g, b, a))
            self.buf[:] = px * (w * h)

    def copy(self) -> "Canvas":
        c = Canvas(self.w, self.h)
        c.buf[:] = self.buf
        return c

    def get(self, x: int, y: int) -> tuple[int, int, int, int]:
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return (0, 0, 0, 0)
        i = (y * self.w + x) * 4
        return (self.buf[i], self.buf[i + 1], self.buf[i + 2], self.buf[i + 3])

    def pix(self, x: int, y: int, col: str | tuple[int, int, int, int], alpha: float = 1.0) -> None:
        ix = round(x)
        iy = round(y)
        if ix < 0 or iy < 0 or ix >= self.w or iy >= self.h:
            return
        sr, sg, sb, sa = hex_rgba(col)
        sa = int(sa * alpha)
        if sa <= 0:
            return
        i = (iy * self.w + ix) * 4
        if sa >= 255:
            self.buf[i : i + 4] = bytes((sr, sg, sb, 255))
            return
        da = self.buf[i + 3]
        if da == 0:
            self.buf[i : i + 4] = bytes((sr, sg, sb, sa))
            return
        inv = 255 - sa
        out_a = sa + (da * inv) // 255
        if out_a == 0:
            return
        self.buf[i] = (sr * sa + self.buf[i] * da * inv // 255) // out_a
        self.buf[i + 1] = (sg * sa + self.buf[i + 1] * da * inv // 255) // out_a
        self.buf[i + 2] = (sb * sa + self.buf[i + 2] * da * inv // 255) // out_a
        self.buf[i + 3] = out_a

    def rect(self, x: int, y: int, w: int, h: int, col: str | tuple[int, int, int, int], alpha: float = 1.0) -> None:
        for yy in range(round(y), round(y) + round(h)):
            for xx in range(round(x), round(x) + round(w)):
                self.pix(xx, yy, col, alpha)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, col: str | tuple[int, int, int, int], alpha: float = 1.0) -> None:
        x0, x1 = math.floor(cx - rx - 1), math.ceil(cx + rx + 1)
        y0, y1 = math.floor(cy - ry - 1), math.ceil(cy + ry + 1)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if ((x - cx) / max(0.5, rx)) ** 2 + ((y - cy) / max(0.5, ry)) ** 2 <= 1.0:
                    self.pix(x, y, col, alpha)

    def line(self, x0: int, y0: int, x1: int, y1: int, col: str | tuple[int, int, int, int], alpha: float = 1.0) -> None:
        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        x, y = x0, y0
        while True:
            self.pix(x, y, col, alpha)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy

    def blit(self, src: "Canvas", dx: int = 0, dy: int = 0, scale: int = 1) -> None:
        for sy in range(src.h):
            for sx in range(src.w):
                r, g, b, a = src.get(sx, sy)
                if a == 0:
                    continue
                for oy in range(scale):
                    for ox in range(scale):
                        self.pix(dx + sx * scale + ox, dy + sy * scale + oy, (r, g, b, a))

    def blit_rotated_90(self, src: "Canvas", cx: int, cy: int, dx: int, dy: int) -> None:
        for sy in range(src.h):
            for sx in range(src.w):
                col = src.get(sx, sy)
                if col[3] == 0:
                    continue
                rx = -(sy - cy)
                ry = sx - cx
                self.pix(dx + cx + rx, dy + cy + ry, col)

    def blit_tilted(self, src: "Canvas", cx: int, cy: int, dx: int, dy: int, deg: float) -> None:
        rad = math.radians(deg)
        ca, sa = math.cos(rad), math.sin(rad)
        for ty in range(-src.h, src.h):
            for tx in range(-src.w, src.w):
                sx = round(cx + tx * ca + ty * sa)
                sy = round(cy - tx * sa + ty * ca)
                col = src.get(sx, sy)
                if col[3] > 0:
                    self.pix(dx + cx + tx, dy + cy + ty, col)

    def outline(self, ink: str = "#26202e") -> "Canvas":
        out = self.copy()
        ink_c = hex_rgba(ink)
        for y in range(self.h):
            for x in range(self.w):
                if self.get(x, y)[3] > 0:
                    continue
                if any(self.get(x + nx, y + ny)[3] > 180 for nx, ny in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.pix(x, y, ink_c)
        return out

    def bbox(self) -> tuple[int, int, int, int] | None:
        xs, ys = [], []
        for y in range(self.h):
            for x in range(self.w):
                if self.get(x, y)[3] > 0:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            return None
        return (min(xs), min(ys), max(xs), max(ys))


# ── Low-saturation Codex Night-Ferry Color System ─────────────────────────────

INK = "#251f2d"
INK_WARM = "#2d2224"

SKIN_LIGHT = ("#f4dfcc", "#dfb89b", "#e09a97")
SKIN_WARM  = ("#ecd0b2", "#cfa27f", "#d68d84")
SKIN_TAN   = ("#cf9e76", "#a87754", "#be7a6e")
SKIN_PALE  = ("#f5e8dc", "#dcc0b4", "#dfa1aa")

HAIR_INK    = ("#322b3d", "#4a4158", "#1f1a27")
HAIR_UMBER  = ("#4c3834", "#6b5049", "#342422")
HAIR_SILVER = ("#b6b5c2", "#d8d8e3", "#838294")
HAIR_PEPPER = ("#5c5868", "#888496", "#3d3948")

FACTION_COLOR = {
    "canal":  "#5d8a82",
    "escort": "#a85258",
    "blade":  "#5a627d",
    "troupe": "#9e5575",
    "yamen":  "#4b5b7e",
}

PAL = {
    "teal":      "#5d8a82", "teal_hi":   "#83b0a7", "teal_lo":   "#3f635d",
    "indigo":    "#3b4a62", "indigo_hi": "#576a88", "indigo_lo": "#273144",
    "hemp":      "#dfd4bf", "hemp_hi":   "#f1eadc", "hemp_lo":   "#b5a78f",
    "wood":      "#8f6747", "wood_hi":   "#b38862", "wood_lo":   "#63452d",
    "amber":     "#dca24a", "amber_hi":  "#f5d07f", "amber_lo":  "#9e6c24",
    "jade":      "#75aa98", "jade_hi":   "#a6d4c4", "jade_lo":   "#4a7567",
    "ochre":     "#a67948", "ochre_hi":  "#c99d68", "ochre_lo":  "#75522d",
    "crimson":   "#9e4a52", "crimson_hi":"#c46c74", "crimson_lo":"#6d2f36",
    "iron":      "#6e7382", "iron_hi":   "#989ead", "iron_lo":   "#4a4e5c",
    "linen":     "#ece4d6", "linen_hi":  "#faf6ee", "linen_lo":   "#bfb4a2",
    "bronze":    "#b88b48", "bronze_hi": "#dbb36e", "bronze_lo": "#7d5b28",
    "slate":     "#4a5169", "slate_hi":  "#6c7594", "slate_lo":  "#303547",
    "charcoal":  "#393545", "charcoal_hi":"#544e63","charcoal_lo":"#25212e",
    "plum":      "#8c4762", "plum_hi":   "#b56886", "plum_lo":   "#5c2b3f",
    "steel":     "#b8c2cf", "steel_hi":  "#e6eef7", "steel_lo":  "#7d8896",
    "mist":      "#d8dce4", "mist_hi":   "#f2f4f8", "mist_lo":   "#9ea5b3",
    "rose":      "#a65b79", "rose_hi":   "#cf85a2", "rose_lo":   "#6e374e",
    "aqua_silk": "#bcd8d2", "aqua_hi":   "#eaf4f1", "aqua_lo":   "#84aba3",
    "burgundy":  "#7d3b4d", "burgundy_hi":"#a8576d","burgundy_lo":"#522230",
    "gold":      "#cfa24e", "gold_hi":   "#f2cf7e", "gold_lo":   "#8f6a27",
    "rouge":     "#b54e59", "rouge_hi":  "#db7680", "rouge_lo":  "#7a2e37",
    "yamen":     "#4a597a", "yamen_hi":  "#6c7ea6", "yamen_lo":  "#2f3a54",
    "violet":    "#655378", "violet_hi": "#8a75a1", "violet_lo": "#423452",
    "seal":      "#9c434a", "seal_hi":   "#c7656d", "seal_lo":   "#69262c",
    "ivory":     "#ede5d5", "ivory_hi":  "#fbf7ee", "ivory_lo":  "#bfb49f",
    "lacquer":   "#2e2a36", "lacquer_hi":"#4a4457", "lacquer_lo":"#1c1922",
}


UNITS = [
    # ── CANAL (漕帮, 10) ──
    dict(id="jh-boatgirl", name="阿桃", faction="canal", skill="ally-heal", role="support",
         build="slim", robe="teal", trim="amber", sash="hemp", skin=SKIN_LIGHT, hair=HAIR_INK,
         hair_style="twin_buns", hat="none", back="none", prop="punt_lantern", skirt=True, boots="wood"),
    dict(id="jh-hauler", name="纤夫老黑", faction="canal", skill="strike", role="melee",
         build="broad", robe="tan_vest", trim="hemp", sash="wood", skin=SKIN_TAN, hair=HAIR_INK,
         hair_style="headband", hat="headband_hemp", back="rope_coil", prop="tow_hook", skirt=False, boots="hemp"),
    dict(id="jh-sailor", name="水手", faction="canal", skill="strike", role="melee",
         build="std", robe="indigo", trim="hemp", sash="amber", skin=SKIN_WARM, hair=HAIR_UMBER,
         hair_style="short", hat="sailor_cap", back="none", prop="oar", skirt=False, boots="indigo"),
    dict(id="jh-lamp", name="灯油妹", faction="canal", skill="strike", role="ranged",
         build="slim", robe="indigo", trim="amber", sash="teal", skin=SKIN_LIGHT, hair=HAIR_INK,
         hair_style="hooded", hat="oil_hood", back="none", prop="oil_taper", skirt=True, boots="wood"),
    dict(id="jh-clerk", name="账房", faction="canal", skill="ally-heal", role="support",
         build="slim", robe="slate", trim="hemp", sash="indigo", skin=SKIN_PALE, hair=HAIR_PEPPER,
         hair_style="topknot", hat="scholar_cap", back="none", prop="abacus", skirt=True, boots="lacquer"),
    dict(id="jh-medic", name="船医", faction="canal", skill="ally-heal", role="support",
         build="std", robe="jade", trim="hemp", sash="wood", skin=SKIN_LIGHT, hair=HAIR_UMBER,
         hair_style="bun", hat="cloth_wrap", back="herb_basket", prop="gourd", skirt=True, boots="wood"),
    dict(id="jh-helmsman", name="舵爷", faction="canal", skill="self-shield", role="tank",
         build="broad", robe="teal", trim="wood", sash="amber", skin=SKIN_WARM, hair=HAIR_PEPPER,
         hair_style="braid", hat="none", back="cape_indigo", prop="helm_wheel", beard="rough", skirt=False, boots="wood"),
    dict(id="jh-storeman", name="仓管", faction="canal", skill="bolt", role="caster",
         build="std", robe="indigo", trim="bronze", sash="teal", skin=SKIN_WARM, hair=HAIR_PEPPER,
         hair_style="topknot", hat="tally_cap", back="none", prop="keyring_ledger", mustache=True, skirt=True, boots="lacquer"),
    dict(id="jh-canal-lord", name="漕帮主", faction="canal", skill="strike", role="melee",
         build="boss", robe="indigo", trim="gold", sash="teal", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="wide", hat="canal_hat", back="cape_teal", prop="dragon_hook", beard="short", skirt=True, boots="lacquer"),
    dict(id="jh-hebo", name="河伯会首", faction="canal", skill="self-shield", role="tank",
         build="boss", robe="jade", trim="gold", sash="teal", skin=SKIN_PALE, hair=HAIR_SILVER,
         hair_style="flowing", hat="hebo_crown", back="water_halo", prop="trident_pearl", beard="long_white", skirt=True, boots="jade"),

    # ── ESCORT (镖局, 8) ──
    dict(id="jh-outrider", name="趟子手", faction="escort", skill="strike", role="melee",
         build="std", robe="ochre", trim="crimson", sash="crimson_hi", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="headband", hat="headband_red", back="scarf_crimson", prop="gong_blade", skirt=False, boots="wood"),
    dict(id="jh-cook", name="厨子", faction="escort", skill="ally-heal", role="support",
         build="broad", robe="linen", trim="crimson", sash="ochre", skin=SKIN_WARM, hair=HAIR_UMBER,
         hair_style="short", hat="chef_kerchief", back="wok_lid", prop="cleaver", beard="chubby", skirt=False, boots="wood"),
    dict(id="jh-escort", name="镖师沈横", faction="escort", skill="self-shield", role="tank",
         build="broad", robe="iron", trim="bronze", sash="crimson", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="spiky", hat="none", back="none", prop="tiger_buckler", scar=True, skirt=False, boots="iron"),
    dict(id="jh-outrunner", name="押镖", faction="escort", skill="strike", role="ranged",
         build="std", robe="ochre", trim="hemp", sash="crimson", skin=SKIN_WARM, hair=HAIR_UMBER,
         hair_style="hatted", hat="straw_flat", back="cape_ochre", prop="wrist_bow", skirt=False, boots="wood"),
    dict(id="jh-chief", name="总镖头", faction="escort", skill="strike", role="melee",
         build="broad", robe="iron", trim="bronze", sash="crimson", skin=SKIN_WARM, hair=HAIR_PEPPER,
         hair_style="topknot", hat="bronze_band", back="escort_flag", prop="broad_dao", beard="short", skirt=False, boots="iron"),
    dict(id="jh-carter", name="车夫", faction="escort", skill="strike", role="melee",
         build="broad", robe="hemp", trim="wood", sash="ochre", skin=SKIN_TAN, hair=HAIR_UMBER,
         hair_style="hatted", hat="conical_straw", back="shoulder_yoke", prop="axle_whip", skirt=False, boots="hemp"),
    dict(id="jh-escort-lady", name="女镖头", faction="escort", skill="self-shield", role="tank",
         build="std", robe="crimson", trim="bronze", sash="linen", skin=SKIN_LIGHT, hair=HAIR_INK,
         hair_style="phoenix_bun", hat="gold_pin", back="scarf_crimson", prop="tower_shield", skirt=True, boots="iron"),
    dict(id="jh-garrison", name="总镇", faction="escort", skill="strike", role="melee",
         build="boss", robe="iron", trim="gold", sash="crimson", skin=SKIN_WARM, hair=HAIR_PEPPER,
         hair_style="helmet", hat="plume_helmet", back="cape_crimson", prop="halberd", beard="short", skirt=False, boots="iron"),

    # ── BLADE (刀客, 7) ──
    dict(id="jh-shiv", name="短刀阿七", faction="blade", skill="strike", role="melee",
         build="slim", robe="charcoal", trim="steel", sash="slate", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="messy_bangs", hat="none", back="none", prop="twin_shivs", skirt=False, boots="charcoal"),
    dict(id="jh-beggar", name="叫花", faction="blade", skill="strike", role="melee",
         build="std", robe="hemp_patch", trim="wood", sash="hemp", skin=SKIN_TAN, hair=HAIR_PEPPER,
         hair_style="shaggy", hat="none", back="gourd_pack", prop="bamboo_staff", skirt=False, boots="hemp"),
    dict(id="jh-nightblade", name="夜行人", faction="blade", skill="strike", role="melee",
         build="std", robe="slate", trim="charcoal", sash="steel", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="hooded", hat="night_hood", back="none", prop="scimitar", mask="half", skirt=False, boots="charcoal"),
    dict(id="jh-flyer", name="飞贼", faction="blade", skill="strike", role="ranged",
         build="slim", robe="charcoal", trim="plum", sash="steel", skin=SKIN_LIGHT, hair=HAIR_INK,
         hair_style="band_tail", hat="thief_band", back="rope_coil", prop="claw_needles", skirt=False, boots="charcoal"),
    dict(id="jh-bladehead", name="梅十三", faction="blade", skill="strike", role="melee",
         build="std", robe="plum", trim="steel", sash="charcoal", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="long_side", hat="plum_hood", back="cape_plum", prop="miao_blade", plum_pin=True, skirt=True, boots="charcoal"),
    dict(id="jh-swordsman", name="剑客", faction="blade", skill="strike", role="melee",
         build="std", robe="mist", trim="slate", sash="jade", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="ribbon_knot", hat="ribbon_jade", back="cape_slate", prop="qingfeng_sword", skirt=True, boots="lacquer"),
    dict(id="jh-shadow", name="影", faction="blade", skill="strike", role="melee",
         build="boss", robe="charcoal", trim="violet", sash="plum", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="cowl", hat="shadow_cowl", back="shadow_wisp", prop="crescent_blades", mask="cowl", skirt=True, boots="charcoal"),

    # ── TROUPE (梨园, 8) ──
    dict(id="jh-fan", name="票友小满", faction="troupe", skill="strike", role="ranged",
         build="slim", robe="aqua_silk", trim="rose", sash="gold", skin=SKIN_LIGHT, hair=HAIR_INK,
         hair_style="neat_boy", hat="ribbon_rose", back="none", prop="folding_fan", skirt=True, boots="lacquer"),
    dict(id="jh-drum", name="司鼓", faction="troupe", skill="strike", role="melee",
         build="std", robe="rouge", trim="gold", sash="ivory", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="twin_ribbons", hat="none", back="none", prop="opera_drum", skirt=False, boots="lacquer"),
    dict(id="jh-huadan", name="花旦彩衣", faction="troupe", skill="ally-heal", role="support",
         build="slim", robe="rose", trim="aqua_silk", sash="gold", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="coronet", hat="huadan_crown", back="ribbon_pink", prop="silk_kerchiefs", skirt=True, boots="rose"),
    dict(id="jh-wusheng", name="武生", faction="troupe", skill="strike", role="melee",
         build="std", robe="rouge", trim="gold", sash="ivory", skin=SKIN_LIGHT, hair=HAIR_INK,
         hair_style="helmet", hat="pheasant_plumes", back="kao_flags", prop="flower_spear", skirt=False, boots="lacquer"),
    dict(id="jh-qingyi", name="青衣", faction="troupe", skill="strike", role="melee",
         build="slim", robe="teal", trim="aqua_silk", sash="rose", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="coronet", hat="qingyi_pins", back="none", prop="water_sleeves", skirt=True, boots="aqua_silk"),
    dict(id="jh-laosheng", name="老生", faction="troupe", skill="strike", role="ranged",
         build="std", robe="burgundy", trim="gold", sash="ivory", skin=SKIN_LIGHT, hair=HAIR_SILVER,
         hair_style="cap", hat="opera_cap", back="none", prop="wood_fan", beard="tri_beard", skirt=True, boots="lacquer"),
    dict(id="jh-troupe-lead", name="班主", faction="troupe", skill="ally-heal", role="support",
         build="broad", robe="plum", trim="gold", sash="aqua_silk", skin=SKIN_WARM, hair=HAIR_PEPPER,
         hair_style="neat_elder", hat="velvet_cap", back="fur_shawl", prop="gong_staff", mustache=True, skirt=True, boots="lacquer"),
    dict(id="jh-starlet", name="当红名角", faction="troupe", skill="strike", role="ranged",
         build="boss", robe="rose", trim="gold", sash="aqua_silk", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="phoenix_crown", hat="phoenix_crown", back="silk_halo", prop="gold_fan_ribbons", skirt=True, boots="gold"),

    # ── YAMEN (衙门, 7) ──
    dict(id="jh-runner", name="捕快周平", faction="yamen", skill="strike", role="melee",
         build="std", robe="yamen", trim="seal", sash="ivory", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="cap", hat="constable_hat", back="none", prop="waterfire_staff", skirt=False, boots="lacquer"),
    dict(id="jh-copyist", name="书办", faction="yamen", skill="ally-heal", role="support",
         build="slim", robe="slate", trim="ivory", sash="yamen", skin=SKIN_PALE, hair=HAIR_INK,
         hair_style="cap", hat="clerk_cap", back="none", prop="brush_scroll", skirt=True, boots="lacquer"),
    dict(id="jh-secretary", name="师爷吴签", faction="yamen", skill="bolt", role="caster",
         build="slim", robe="violet", trim="gold", sash="ivory", skin=SKIN_PALE, hair=HAIR_PEPPER,
         hair_style="cap", hat="melon_cap", back="none", prop="tally_slips", mustache=True, skirt=True, boots="lacquer"),
    dict(id="jh-constable", name="捕头", faction="yamen", skill="self-shield", role="tank",
         build="broad", robe="yamen", trim="bronze", sash="seal", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="cap", hat="constable_plume", back="cape_yamen", prop="ring_saber_plaque", beard="short", skirt=False, boots="iron"),
    dict(id="jh-inspector", name="巡检", faction="yamen", skill="strike", role="ranged",
         build="std", robe="indigo", trim="bronze", sash="seal", skin=SKIN_WARM, hair=HAIR_INK,
         hair_style="cap", hat="inspector_hat", back="cape_yamen", prop="waist_bow", skirt=True, boots="lacquer"),
    dict(id="jh-magistrate", name="知县", faction="yamen", skill="bolt", role="ranged",
         build="boss", robe="yamen", trim="ivory", sash="gold", skin=SKIN_LIGHT, hair=HAIR_PEPPER,
         hair_style="cap", hat="wusha_hat", back="none", prop="gavel_seal", beard="neat", skirt=True, boots="lacquer"),
    dict(id="jh-governor", name="巡抚", faction="yamen", skill="bolt", role="caster",
         build="boss", robe="violet", trim="gold", sash="seal", skin=SKIN_PALE, hair=HAIR_SILVER,
         hair_style="cap", hat="viceroy_crown", back="edict_halo", prop="imperial_sword", beard="long_white", skirt=True, boots="gold"),
]


def pal_triad(key: str) -> tuple[str, str, str]:
    if key == "tan_vest":
        return (PAL["hemp_lo"], PAL["hemp"], PAL["wood_lo"])
    if key == "hemp_patch":
        return (PAL["hemp"], PAL["hemp_hi"], PAL["wood"])
    if key == "crimson_hi":
        return (PAL["crimson_hi"], PAL["crimson_hi"], PAL["crimson"])
    return (PAL[key], PAL.get(f"{key}_hi", PAL[key]), PAL.get(f"{key}_lo", PAL[key]))


def draw_face(c: Canvas, u: dict, mood: str, tick: int) -> None:
    fx, fy = 16, 9 if u["build"] == "boss" else 10
    skin_b, skin_s, blush = u["skin"]
    mask = u.get("mask")

    if mask == "cowl":
        c.rect(fx - 4, fy - 2, 9, 6, PAL["charcoal_lo"])
        # Inner moonlit violet rim inside deep hood
        c.line(fx - 4, fy - 2, fx + 4, fy - 2, PAL["violet"])
        c.pix(fx - 4, fy - 1, PAL["violet"])
        c.pix(fx + 4, fy - 1, PAL["violet"])
        if mood == "dead":
            for ex in (fx - 2, fx + 2):
                c.pix(ex - 1, fy, PAL["steel_lo"])
                c.pix(ex + 1, fy, PAL["steel_lo"])
                c.pix(ex, fy + 1, PAL["steel_lo"])
        elif mood == "shock":
            for ex in (fx - 2, fx + 2):
                c.rect(ex - 1, fy - 1, 2, 3, "#f7f3ff")
        elif mood == "happy":
            for ex in (fx - 2, fx + 2):
                c.pix(ex - 1, fy + 1, "#f7e3a8")
                c.pix(ex, fy, "#f7e3a8")
                c.pix(ex + 1, fy + 1, "#f7e3a8")
        elif mood == "cry":
            for ex in (fx - 2, fx + 2):
                c.rect(ex - 1, fy, 2, 1, "#b4dceb")
                c.pix(ex, fy + 1 + (tick % 3), "#8cc9de")
        else:
            for ex in (fx - 2, fx + 2):
                c.rect(ex - 1, fy, 2, 1, "#efe6ff")
        return

    c.rect(fx - 4, fy - 2, 9, 6, skin_b)
    c.rect(fx - 4, fy + 3, 9, 1, skin_s)

    if mask == "half":
        c.rect(fx - 4, fy + 1, 9, 3, PAL["slate_lo"])
        c.rect(fx - 3, fy + 1, 7, 1, PAL["slate"])

    if mood == "dead":
        for ex in (fx - 3, fx + 3):
            c.pix(ex - 1, fy - 1, INK)
            c.pix(ex + 1, fy - 1, INK)
            c.pix(ex, fy, INK)
            c.pix(ex - 1, fy + 1, INK)
            c.pix(ex + 1, fy + 1, INK)
        if not mask:
            c.rect(fx - 1, fy + 2, 3, 1, INK)
        return

    if not mask and mood in ("happy", "cry"):
        c.pix(fx - 4, fy + 1, blush)
        c.pix(fx + 4, fy + 1, blush)

    if mood == "happy":
        for ex in (fx - 2, fx + 2):
            c.pix(ex - 1, fy, INK)
            c.pix(ex, fy - 1, INK)
            c.pix(ex + 1, fy, INK)
        if not mask:
            c.pix(fx - 1, fy + 2, INK)
            c.pix(fx, fy + 2, skin_s)
            c.pix(fx + 1, fy + 2, INK)
    elif mood == "shock":
        for ex in (fx - 3, fx + 2):
            c.rect(ex, fy - 2, 2, 3, INK)
            c.pix(ex, fy - 1, "#ffffff")
        if not mask:
            c.rect(fx - 1, fy + 1, 3, 2, INK)
            c.pix(fx, fy + 2, "#f0c8ba")
    elif mood == "cry":
        for ex in (fx - 2, fx + 2):
            c.rect(ex - 1, fy - 1, 3, 1, INK)
            c.pix(ex, fy, "#82cadb")
            c.pix(ex, fy + 1 + (tick % 3), "#82cadb")
        if not mask:
            c.rect(fx - 1, fy + 2, 3, 1, INK)
    else:
        for ex in (fx - 2, fx + 2):
            c.rect(ex, fy - 1, 1, 2, INK)
        c.pix(fx - 3, fy - 2, u["hair"][2])
        c.pix(fx + 3, fy - 2, u["hair"][2])
        if not mask:
            c.rect(fx - 1, fy + 2, 3, 1, INK)

    if u.get("scar"):
        c.pix(fx + 2, fy + 1, "#b85c5c")
        c.pix(fx + 3, fy + 2, "#b85c5c")
    if u.get("mustache"):
        c.rect(fx - 3, fy + 1, 2, 1, u["hair"][0])
        c.rect(fx + 2, fy + 1, 2, 1, u["hair"][0])
    beard = u.get("beard")
    if beard == "short":
        c.rect(fx - 3, fy + 3, 7, 2, u["hair"][0])
        c.rect(fx - 2, fy + 5, 5, 1, u["hair"][2])
    elif beard == "rough":
        c.rect(fx - 4, fy + 2, 9, 3, u["hair"][0])
        c.rect(fx - 3, fy + 5, 7, 2, u["hair"][2])
    elif beard == "chubby":
        c.rect(fx - 3, fy + 3, 7, 1, u["hair"][0])
    elif beard == "neat":
        c.rect(fx - 2, fy + 3, 5, 2, u["hair"][0])
        c.rect(fx - 1, fy + 5, 3, 2, u["hair"][2])
    elif beard == "tri_beard":
        c.rect(fx - 3, fy + 3, 1, 6, u["hair"][1])
        c.rect(fx, fy + 3, 1, 7, u["hair"][0])
        c.rect(fx + 3, fy + 3, 1, 6, u["hair"][1])
    elif beard == "long_white":
        c.rect(fx - 3, fy + 3, 7, 3, HAIR_SILVER[1])
        c.rect(fx - 2, fy + 6, 5, 3, HAIR_SILVER[0])
        c.rect(fx - 1, fy + 9, 3, 2, HAIR_SILVER[2])


def draw_back_prop(c: Canvas, u: dict, sway: int) -> None:
    back = u.get("back", "none")
    if back == "none":
        return
    if back.startswith("cape_"):
        col_k = back.split("_", 1)[1]
        base, _, lo = pal_triad(col_k)
        c.rect(10 + sway, 15, 13, 10, lo)
        c.rect(11 + sway, 15, 11, 8, base)
        c.pix(11 + sway, 24, lo)
        c.pix(21 + sway, 24, lo)
    elif back == "scarf_crimson":
        c.rect(8 + sway, 14, 3, 8, PAL["crimson"])
        c.rect(8 + sway, 20, 2, 3, PAL["crimson_hi"])
    elif back == "rope_coil":
        c.rect(20, 14, 4, 7, PAL["hemp_lo"])
        c.rect(21, 15, 2, 5, PAL["hemp"])
    elif back == "herb_basket":
        c.rect(9, 13, 5, 7, PAL["wood"])
        c.rect(10, 12, 3, 2, PAL["jade"])
        c.pix(11, 11, PAL["jade_hi"])
    elif back == "wok_lid":
        c.ellipse(11, 16, 4.5, 4.5, PAL["iron_lo"])
        c.ellipse(11, 16, 3.2, 3.2, PAL["steel"])
        c.pix(11, 16, PAL["wood"])
    elif back == "escort_flag":
        c.rect(22 + sway, 3, 1, 19, PAL["wood_lo"])
        c.rect(23 + sway, 3, 5, 6, PAL["crimson"])
        c.rect(24 + sway, 4, 3, 4, PAL["crimson_hi"])
        c.rect(23 + sway, 3, 6, 1, PAL["gold"])
        c.rect(28 + sway, 5, 2, 2, PAL["crimson"])
    elif back == "shoulder_yoke":
        c.rect(8, 14, 17, 2, PAL["wood"])
        c.rect(9, 14, 15, 1, PAL["wood_hi"])
    elif back == "gourd_pack":
        c.ellipse(22, 18, 2.5, 2.5, PAL["amber_lo"])
        c.ellipse(22, 16, 1.8, 1.8, PAL["amber"])
    elif back == "kao_flags":
        for fx, fy, sx in ((9, 7, -1), (11, 6, -1), (21, 6, 1), (23, 7, 1)):
            c.line(fx, fy + 8, fx + sx * 2, fy, PAL["wood"])
            c.rect(fx + sx * 2 - (2 if sx < 0 else 0), fy, 3, 4, PAL["rouge"])
            c.pix(fx + sx * 2, fy + 1, PAL["gold_hi"])
    elif back == "ribbon_pink":
        c.rect(9 + sway, 15, 2, 9, PAL["rose_hi"])
        c.rect(21 + sway, 15, 2, 9, PAL["rose_hi"])
        c.rect(8 + sway, 22, 2, 3, PAL["aqua_hi"])
        c.rect(22 + sway, 22, 2, 3, PAL["aqua_hi"])
    elif back == "fur_shawl":
        c.rect(9, 14, 15, 3, PAL["ivory"])
        c.rect(10, 14, 13, 1, PAL["ivory_hi"])
    elif back == "silk_halo":
        c.line(7 + sway, 12, 10, 6, PAL["rose_hi"])
        c.line(10, 6, 22, 6, PAL["gold_hi"])
        c.line(22, 6, 25 + sway, 12, PAL["rose_hi"])
        c.rect(7 + sway, 12, 2, 12, PAL["aqua_hi"])
        c.rect(23 + sway, 12, 2, 12, PAL["aqua_hi"])
    elif back == "water_halo":
        for a_deg in range(0, 360, 40):
            ax = round(16 + math.cos(math.radians(a_deg + sway * 12)) * 9.5)
            ay = round(14 + math.sin(math.radians(a_deg + sway * 12)) * 8.5)
            c.pix(ax, ay, PAL["jade_hi"])
    elif back == "edict_halo":
        c.rect(8, 12, 17, 13, PAL["yamen_lo"])
        c.rect(9, 13, 15, 11, PAL["gold_lo"])
        c.rect(10, 13, 13, 10, PAL["yamen"])
    elif back == "shadow_wisp":
        c.rect(9 + sway, 13, 15, 13, PAL["charcoal_lo"])
        c.pix(8 + sway, 24, PAL["violet"])
        c.pix(24 + sway, 24, PAL["violet"])


def draw_hair_and_hat(c: Canvas, u: dict, sway: int) -> None:
    hx, hy = 16, 9 if u["build"] == "boss" else 10
    hair_d, hair_h, hair_deep = u["hair"]
    hs = u["hair_style"]
    hat = u["hat"]

    c.rect(hx - 4, hy - 4, 9, 3, hair_d)
    c.rect(hx - 5, hy - 3, 11, 2, hair_d)
    c.rect(hx - 3, hy - 4, 6, 1, hair_h)
    c.rect(hx - 5, hy - 1, 1, 4, hair_deep)
    c.rect(hx + 5, hy - 1, 1, 4, hair_deep)

    if hs == "twin_buns":
        for bx in (hx - 6, hx + 5):
            c.rect(bx, hy - 5, 2, 3, hair_d)
            c.pix(bx + (1 if bx > hx else 0), hy - 5, PAL["amber_hi"])
            c.pix(bx, hy - 4, PAL["rose_hi"])
    elif hs == "topknot":
        c.rect(hx - 1, hy - 6, 3, 2, hair_d)
        c.pix(hx + 2, hy - 6, PAL["jade_hi"])
    elif hs == "messy_bangs":
        c.rect(hx - 5, hy - 2, 3, 2, hair_deep)
        c.pix(hx - 1, hy - 2, hair_d)
        c.pix(hx + 3, hy - 2, hair_d)
    elif hs == "long_side":
        c.rect(hx - 5, hy - 1, 2, 8, hair_deep)
        c.rect(hx + 4, hy - 1, 2, 8, hair_deep)
    elif hs == "ribbon_knot":
        c.rect(hx - 1, hy - 6, 3, 2, hair_d)
        c.rect(hx - 3, hy - 5, 2, 1, PAL["jade_hi"])
        c.rect(hx + 2, hy - 5, 3 + sway, 1, PAL["jade_hi"])
    elif hs == "phoenix_bun":
        c.rect(hx - 2, hy - 6, 5, 2, hair_d)
        c.rect(hx - 3, hy - 6, 7, 1, PAL["gold_hi"])
    elif hs == "twin_ribbons":
        c.rect(hx - 1, hy - 6, 3, 2, hair_d)
        c.rect(hx - 4, hy - 5, 2, 2, PAL["rouge_hi"])
        c.rect(hx + 3, hy - 5, 2, 2, PAL["rouge_hi"])
    elif hs == "shaggy":
        c.rect(hx - 6, hy - 3, 2, 5, hair_d)
        c.rect(hx + 5, hy - 3, 2, 5, hair_d)
    elif hs == "braid":
        c.rect(hx - 5, hy + 1, 1, 6, hair_deep)
    elif hs == "flowing":
        c.rect(hx - 6, hy - 2, 2, 10, hair_d)
        c.rect(hx + 5, hy - 2, 2, 10, hair_d)

    if hat == "none":
        return
    if hat == "headband_hemp":
        c.rect(hx - 5, hy - 4, 11, 2, PAL["hemp"])
        c.pix(hx + 5, hy - 3, PAL["hemp_lo"])
    elif hat == "headband_red":
        c.rect(hx - 5, hy - 4, 11, 2, PAL["crimson"])
        c.rect(hx + 6 + sway, hy - 3, 2, 2, PAL["crimson_hi"])
    elif hat == "sailor_cap":
        c.rect(hx - 5, hy - 6, 11, 3, PAL["indigo_hi"])
        c.rect(hx - 4, hy - 7, 9, 1, PAL["hemp"])
    elif hat == "oil_hood":
        c.rect(hx - 6, hy - 6, 13, 3, PAL["indigo"])
        c.rect(hx - 6, hy - 3, 2, 8, PAL["indigo_lo"])
        c.rect(hx + 5, hy - 3, 2, 8, PAL["indigo_lo"])
    elif hat == "scholar_cap":
        c.rect(hx - 5, hy - 8, 11, 4, PAL["indigo"])
        c.rect(hx - 4, hy - 8, 9, 1, PAL["indigo_hi"])
    elif hat == "cloth_wrap":
        c.rect(hx - 5, hy - 6, 11, 3, PAL["jade_lo"])
        c.rect(hx - 4, hy - 7, 9, 2, PAL["jade"])
    elif hat == "tally_cap":
        c.rect(hx - 4, hy - 8, 9, 4, PAL["lacquer"])
        c.rect(hx - 3, hy - 8, 7, 1, PAL["bronze_hi"])
    elif hat == "canal_hat":
        c.rect(hx - 8, hy - 5, 17, 2, PAL["indigo_lo"])
        c.rect(hx - 6, hy - 7, 13, 2, PAL["teal"])
        c.rect(hx - 3, hy - 8, 7, 1, PAL["gold"])
    elif hat == "hebo_crown":
        c.rect(hx - 5, hy - 6, 11, 3, PAL["gold"])
        c.rect(hx - 3, hy - 9, 7, 3, PAL["jade_hi"])
        c.pix(hx, hy - 8, PAL["amber_hi"])
        c.rect(hx - 6, hy - 3, 1, 5, PAL["jade_hi"])
        c.rect(hx + 6, hy - 3, 1, 5, PAL["jade_hi"])
    elif hat == "chef_kerchief":
        c.rect(hx - 5, hy - 7, 11, 3, PAL["linen_hi"])
        c.rect(hx - 6, hy - 6, 1, 2, PAL["linen_lo"])
        c.rect(hx + 6, hy - 6, 1, 2, PAL["linen_lo"])
    elif hat == "straw_flat":
        c.rect(hx - 8, hy - 5, 17, 2, PAL["amber"])
        c.rect(hx - 5, hy - 7, 11, 2, PAL["hemp_hi"])
    elif hat == "conical_straw":
        c.rect(hx - 9, hy - 4, 19, 1, PAL["amber_lo"])
        c.rect(hx - 7, hy - 5, 15, 1, PAL["hemp"])
        c.rect(hx - 5, hy - 6, 11, 1, PAL["hemp_hi"])
        c.rect(hx - 2, hy - 7, 5, 1, PAL["amber"])
    elif hat == "bronze_band":
        c.rect(hx - 5, hy - 5, 11, 2, PAL["bronze"])
        c.pix(hx, hy - 5, PAL["crimson_hi"])
    elif hat == "gold_pin":
        c.rect(hx - 5, hy - 5, 11, 2, PAL["gold"])
        c.rect(hx - 2, hy - 7, 5, 2, PAL["crimson_hi"])
    elif hat == "plume_helmet":
        c.rect(hx - 5, hy - 6, 11, 4, PAL["iron_hi"])
        c.rect(hx - 6, hy - 4, 13, 1, PAL["gold"])
        c.rect(hx - 1, hy - 9, 3, 3, PAL["crimson_hi"])
        c.pix(hx + sway, hy - 10, PAL["rouge_hi"])
    elif hat == "night_hood":
        c.rect(hx - 5, hy - 6, 11, 3, PAL["charcoal"])
        c.rect(hx - 4, hy - 7, 9, 1, PAL["slate_hi"])
    elif hat == "thief_band":
        c.rect(hx - 5, hy - 5, 11, 2, PAL["plum"])
        c.rect(hx + 6 + sway, hy - 5, 3, 1, PAL["plum_hi"])
    elif hat == "plum_hood":
        c.rect(hx - 6, hy - 6, 13, 3, PAL["plum"])
        c.rect(hx - 4, hy - 7, 9, 1, PAL["plum_hi"])
        c.rect(hx - 6, hy - 3, 2, 8, PAL["plum_lo"])
        c.rect(hx + 5, hy - 3, 2, 8, PAL["plum_lo"])
        if u.get("plum_pin"):
            c.pix(hx + 4, hy - 5, "#f0b4ca")
            c.pix(hx + 5, hy - 6, "#f0b4ca")
            c.pix(hx + 5, hy - 5, "#f7e09c")
    elif hat == "ribbon_jade":
        c.rect(hx - 5, hy - 5, 11, 1, PAL["jade_hi"])
    elif hat == "shadow_cowl":
        c.rect(hx - 6, hy - 6, 13, 4, PAL["charcoal"])
        c.rect(hx - 3, hy - 7, 7, 1, PAL["violet"])
        c.rect(hx - 6, hy - 2, 2, 8, PAL["charcoal_lo"])
        c.rect(hx + 5, hy - 2, 2, 8, PAL["charcoal_lo"])
    elif hat == "ribbon_rose":
        c.rect(hx - 5, hy - 5, 11, 1, PAL["rose_hi"])
        c.rect(hx - 2, hy - 7, 5, 2, PAL["lacquer"])
    elif hat == "huadan_crown":
        c.rect(hx - 5, hy - 6, 11, 2, PAL["gold_hi"])
        for px in (hx - 4, hx, hx + 4):
            c.rect(px, hy - 8, 2, 2, PAL["rose_hi"])
        c.pix(hx - 6, hy - 3, PAL["ivory_hi"])
        c.pix(hx + 6, hy - 3, PAL["ivory_hi"])
    elif hat == "pheasant_plumes":
        c.rect(hx - 5, hy - 6, 11, 3, PAL["gold"])
        c.rect(hx - 2, hy - 7, 5, 2, PAL["rouge_hi"])
        c.line(hx - 2, hy - 7, hx - 7, hy - 9, PAL["amber"])
        c.line(hx - 7, hy - 9, hx - 10 + sway, hy - 5, PAL["crimson"])
        c.line(hx + 2, hy - 7, hx + 7, hy - 9, PAL["amber"])
        c.line(hx + 7, hy - 9, hx + 10 + sway, hy - 5, PAL["crimson"])
    elif hat == "qingyi_pins":
        c.rect(hx - 5, hy - 6, 11, 2, PAL["aqua_hi"])
        c.pix(hx - 5, hy - 3, PAL["ivory_hi"])
        c.pix(hx + 5, hy - 3, PAL["ivory_hi"])
    elif hat == "opera_cap":
        c.rect(hx - 5, hy - 6, 11, 3, PAL["lacquer"])
        c.rect(hx - 3, hy - 8, 7, 2, PAL["lacquer_hi"])
        c.rect(hx - 7, hy - 5, 2, 1, PAL["lacquer"])
        c.rect(hx + 6, hy - 5, 2, 1, PAL["lacquer"])
    elif hat == "velvet_cap":
        c.rect(hx - 5, hy - 7, 11, 3, PAL["burgundy"])
        c.pix(hx, hy - 6, PAL["gold_hi"])
    elif hat == "phoenix_crown":
        c.rect(hx - 6, hy - 6, 13, 3, PAL["gold"])
        c.rect(hx - 4, hy - 8, 9, 2, PAL["gold_hi"])
        c.pix(hx, hy - 9, PAL["rouge_hi"])
        c.rect(hx - 6, hy - 3, 2, 4, PAL["aqua_hi"])
        c.rect(hx + 5, hy - 3, 2, 4, PAL["aqua_hi"])
    elif hat == "constable_hat":
        c.rect(hx - 4, hy - 8, 9, 4, PAL["lacquer"])
        c.rect(hx - 6, hy - 5, 13, 1, PAL["lacquer_lo"])
        c.rect(hx, hy - 9, 2, 2, PAL["seal_hi"])
    elif hat == "clerk_cap":
        c.rect(hx - 5, hy - 7, 11, 3, PAL["slate"])
        c.rect(hx - 4, hy - 7, 9, 1, PAL["ivory"])
    elif hat == "melon_cap":
        c.rect(hx - 4, hy - 7, 9, 3, PAL["lacquer"])
        c.rect(hx - 1, hy - 8, 3, 1, PAL["seal"])
    elif hat == "constable_plume":
        c.rect(hx - 5, hy - 7, 11, 4, PAL["lacquer"])
        c.rect(hx - 6, hy - 4, 13, 1, PAL["bronze"])
        c.rect(hx - 1, hy - 9, 3, 2, PAL["seal_hi"])
    elif hat == "inspector_hat":
        c.rect(hx - 8, hy - 5, 17, 2, PAL["lacquer"])
        c.rect(hx - 4, hy - 8, 9, 3, PAL["lacquer_hi"])
    elif hat == "wusha_hat":
        c.rect(hx - 5, hy - 7, 11, 4, PAL["lacquer"])
        c.rect(hx - 3, hy - 9, 7, 2, PAL["lacquer_hi"])
        c.rect(hx - 10, hy - 5, 5, 1, PAL["lacquer_hi"])
        c.rect(hx + 6, hy - 5, 5, 1, PAL["lacquer_hi"])
    elif hat == "viceroy_crown":
        c.rect(hx - 5, hy - 7, 11, 4, PAL["lacquer"])
        c.rect(hx - 4, hy - 9, 9, 2, PAL["gold"])
        c.rect(hx - 10, hy - 6, 5, 2, PAL["gold_hi"])
        c.rect(hx + 6, hy - 6, 5, 2, PAL["gold_hi"])
        c.pix(hx, hy - 8, PAL["jade_hi"])


def draw_body(c: Canvas, u: dict, boot_l: tuple[int, int], boot_r: tuple[int, int]) -> None:
    robe_b, robe_h, robe_l = pal_triad(u["robe"])
    trim_b, trim_h, _ = pal_triad(u["trim"])
    sash_b, _, _ = pal_triad(u["sash"])
    boot_b, boot_h, _ = pal_triad(u["boots"])

    w_half = 5 if u["build"] == "slim" else 7 if u["build"] in ("broad", "boss") else 6
    cx = 16

    for bx, by in ((cx - 4 + boot_l[0], 24 + boot_l[1]), (cx + 2 + boot_r[0], 24 + boot_r[1])):
        c.rect(bx, by, 3, 4, INK)
        c.rect(bx, by, 3, 3, boot_b)
        c.pix(bx, by, boot_h)

    if u.get("skirt"):
        c.rect(cx - w_half, 19, w_half * 2 + 1, 6, robe_b)
        c.rect(cx - w_half + 1, 19, w_half * 2 - 1, 1, robe_h)
        c.rect(cx - w_half, 24, w_half * 2 + 1, 1, trim_b)
        c.rect(cx - 1, 19, 3, 5, trim_h)
    else:
        c.rect(cx - w_half + 1, 19, w_half * 2 - 1, 4, robe_l)
        c.rect(cx - 4, 21, 3, 4, robe_l)
        c.rect(cx + 2, 21, 3, 4, robe_l)

    c.rect(cx - w_half, 14, w_half * 2 + 1, 6, robe_b)
    c.rect(cx - w_half + 1, 14, w_half - 1, 2, robe_h)
    c.line(cx - 3, 14, cx, 17, trim_h)
    c.line(cx + 3, 14, cx, 17, trim_b)
    c.rect(cx - w_half, 18, w_half * 2 + 1, 2, sash_b)
    c.rect(cx - 1, 18, 3, 2, trim_h)

    if u["faction"] == "yamen" and u["build"] in ("std", "broad", "boss"):
        c.rect(cx - 2, 15, 5, 3, trim_b)
        c.pix(cx, 16, trim_h)
    elif u["faction"] == "escort" and u["build"] in ("broad", "boss"):
        c.rect(cx - w_half - 1, 14, 3, 3, trim_b)
        c.rect(cx + w_half - 1, 14, 3, 3, trim_b)

    if u["id"] == "jh-hauler":
        c.rect(cx + 1, 14, 5, 3, u["skin"][0])
        c.line(cx - 4, 14, cx + 4, 19, PAL["hemp_lo"])


def draw_folding_fan(c: Canvas, fx: int, fy: int, col_body: str, col_edge: str, tick: int) -> None:
    # Distinct widening fan wedge (折扇)
    c.rect(fx, fy, 1, 2, PAL["wood"])
    c.rect(fx - 1, fy - 2, 3, 2, col_body)
    c.rect(fx - 2, fy - 4, 5, 2, col_body)
    c.rect(fx - 3, fy - 5, 7, 1, col_edge)
    c.pix(fx - 1, fy - 3, PAL["ivory_hi"] if tick % 2 == 0 else col_edge)


def draw_prop(c: Canvas, u: dict, atk_phase: int, tick: int) -> None:
    prop = u["prop"]
    off_x = -2 if atk_phase == 1 else (4 if atk_phase == 2 else (2 if atk_phase == 3 else 0))
    off_y = -1 if atk_phase in (1, 2) else 0
    hx = 22 + off_x
    hy = 17 + off_y
    hand = u["skin"][0]

    if prop == "punt_lantern":
        c.line(hx, 6 + off_y, hx + 1, 27, PAL["wood"])
        c.line(hx, 6 + off_y, hx + 3, 6 + off_y, PAL["wood_hi"])
        # Warm glowing ferry lantern hanging freely from pole tip
        lx, ly = hx + 3, 8 + off_y
        c.pix(lx, ly, PAL["bronze_lo"])
        c.rect(lx - 1, ly + 1, 3, 4, PAL["amber"])
        c.rect(lx, ly + 2, 1, 2, "#fff7cf" if tick % 2 == 0 else PAL["amber_hi"])
        c.pix(lx, ly + 5, PAL["crimson"])
        c.pix(hx - 1, hy, hand)
    elif prop == "tow_hook":
        c.line(hx, 12 + off_y, hx, 24 + off_y, PAL["iron"])
        c.rect(hx - 2, 10 + off_y, 3, 2, PAL["steel"])
        c.pix(hx - 1, hy, hand)
    elif prop == "oar":
        c.line(9, 22 + off_y, hx + 3, 8 + off_y, PAL["wood"])
        c.rect(hx + 1, 7 + off_y, 4, 4, PAL["wood_hi"])
        c.pix(hx + 2, 8 + off_y, PAL["hemp"])
        c.pix(hx, hy - 1, hand)
    elif prop == "oil_taper":
        c.rect(hx - 1, hy, 3, 4, PAL["bronze"])
        c.rect(hx, hy - 4, 1, 4, PAL["ivory"])
        c.pix(hx, hy - 5, PAL["amber_hi"])
        if tick % 2 == 0:
            c.pix(hx + 1, hy - 6, "#fff5cc")
    elif prop == "abacus":
        c.rect(hx - 4, hy - 2, 7, 5, PAL["wood_lo"])
        c.rect(hx - 3, hy - 1, 5, 3, PAL["wood_hi"])
        for bx in range(hx - 3, hx + 2, 2):
            c.pix(bx, hy - 1, PAL["amber_hi"])
            c.pix(bx, hy + 1, PAL["amber_hi"])
    elif prop == "gourd":
        c.ellipse(hx, hy + 1, 2.2, 2.2, PAL["amber_lo"])
        c.ellipse(hx, hy - 2, 1.5, 1.5, PAL["amber"])
        c.pix(hx, hy - 4, PAL["crimson"])
    elif prop == "helm_wheel":
        wx, wy = 9 + off_x, 18 + off_y
        for a in range(0, 360, 45):
            c.line(wx, wy, round(wx + math.cos(math.radians(a)) * 5), round(wy + math.sin(math.radians(a)) * 5), PAL["wood_hi"])
        c.ellipse(wx, wy, 4.0, 4.0, PAL["wood_lo"])
        c.ellipse(wx, wy, 2.5, 2.5, PAL["wood_hi"])
        c.pix(wx, wy, PAL["gold_hi"])
    elif prop == "keyring_ledger":
        c.rect(hx - 1, hy - 2, 4, 5, PAL["bronze"])
        c.rect(8, 17 + off_y, 4, 5, PAL["ivory"])
        c.rect(8, 17 + off_y, 1, 5, PAL["teal"])
    elif prop == "dragon_hook":
        c.line(hx, 6 + off_y, hx, 27, PAL["wood_lo"])
        c.rect(hx - 1, 5 + off_y, 4, 3, PAL["gold"])
        c.pix(hx + 3, 6 + off_y, PAL["steel_hi"])
    elif prop == "trident_pearl":
        c.line(hx, 5 + off_y, hx, 27, PAL["jade_lo"])
        c.rect(hx - 2, 5 + off_y, 5, 2, PAL["gold"])
        c.line(hx - 2, 3 + off_y, hx - 2, 6 + off_y, PAL["steel_hi"])
        c.line(hx, 2 + off_y, hx, 6 + off_y, PAL["jade_hi"])
        c.line(hx + 2, 3 + off_y, hx + 2, 6 + off_y, PAL["steel_hi"])
        c.pix(hx, 1 + off_y, PAL["amber_hi"])
    elif prop == "gong_blade":
        gx = 8 + off_x
        c.ellipse(gx, 18, 3.5, 3.5, PAL["gold"])
        c.ellipse(gx, 18, 2.0, 2.0, PAL["amber_hi"])
        c.line(hx, 14 + off_y, hx + 1, 19 + off_y, PAL["wood_hi"])
        c.ellipse(hx, 13 + off_y, 1.4, 1.4, PAL["crimson_hi"])
    elif prop == "cleaver":
        c.rect(hx - 1, 12 + off_y, 4, 5, PAL["steel"])
        c.rect(hx - 1, 12 + off_y, 1, 5, PAL["steel_hi"])
        c.rect(hx, 17 + off_y, 1, 3, PAL["wood"])
    elif prop == "tiger_buckler":
        sx, sy = 9 + off_x, 18 + off_y
        c.rect(sx - 3, sy - 4, 6, 8, PAL["iron_lo"])
        c.rect(sx - 2, sy - 3, 4, 6, PAL["bronze"])
        c.rect(sx - 1, sy - 1, 2, 2, PAL["amber_hi"])
        c.line(hx, 11 + off_y, hx + 1, 18 + off_y, PAL["steel"])
    elif prop == "wrist_bow":
        c.rect(hx - 1, hy - 1, 5, 2, PAL["wood"])
        c.line(hx + 2, hy - 4, hx + 2, hy + 2, PAL["steel_hi"])
    elif prop == "broad_dao":
        c.line(hx, 8 + off_y, hx + 3, 18 + off_y, PAL["steel"])
        c.rect(hx + 1, 8 + off_y, 2, 5, PAL["steel_hi"])
        c.rect(hx + 1, 17 + off_y, 3, 1, PAL["gold"])
    elif prop == "axle_whip":
        c.line(hx, 11 + off_y, hx + 2, 23, PAL["wood"])
        c.line(hx + 2, 11 + off_y, hx + 5, 16 + off_y, PAL["ochre_hi"])
    elif prop == "tower_shield":
        sx, sy = 9 + off_x, 17 + off_y
        c.rect(sx - 3, sy - 5, 6, 10, PAL["iron_lo"])
        c.rect(sx - 2, sy - 4, 4, 8, PAL["crimson"])
        c.rect(sx - 1, sy - 3, 2, 6, PAL["gold_hi"])
    elif prop == "halberd":
        c.line(hx, 4 + off_y, hx, 27, PAL["iron_lo"])
        c.rect(hx - 2, 5 + off_y, 5, 3, PAL["steel_hi"])
        c.pix(hx, 3 + off_y, PAL["steel_hi"])
        c.pix(hx - 2, 8 + off_y, PAL["crimson"])
    elif prop == "twin_shivs":
        # Diagonal reverse-grip twin silver daggers standing clearly off body
        c.line(9 - off_x // 2, 17 + off_y, 5 - off_x // 2, 21 + off_y, PAL["steel_hi"])
        c.pix(8 - off_x // 2, 18 + off_y, PAL["plum_hi"])
        c.line(hx, 17 + off_y, hx + 4, 13 + off_y, PAL["steel_hi"])
        c.pix(hx + 1, 17 + off_y, PAL["plum_hi"])
    elif prop == "bamboo_staff":
        c.line(hx, 7 + off_y, hx + 1, 27, PAL["jade_lo"])
        c.pix(hx, 10 + off_y, PAL["jade_hi"])
        c.pix(hx + 1, 16 + off_y, PAL["jade_hi"])
    elif prop == "scimitar":
        c.line(hx, 9 + off_y, hx + 3, 16 + off_y, PAL["steel"])
        c.pix(hx + 3, 10 + off_y, PAL["steel_hi"])
        c.rect(hx, 17 + off_y, 2, 2, PAL["charcoal"])
    elif prop == "claw_needles":
        c.line(hx, hy - 3, hx + 3, hy - 1, PAL["steel_hi"])
        c.line(hx, hy, hx + 4, hy, PAL["steel_hi"])
        c.line(hx, hy + 2, hx + 3, hy + 2, PAL["steel_hi"])
    elif prop == "miao_blade":
        c.line(hx, 7 + off_y, hx + 2, 19 + off_y, PAL["steel_hi"])
        c.line(hx - 1, 8 + off_y, hx + 1, 18 + off_y, PAL["steel"])
        c.pix(hx + 1, 18 + off_y, PAL["plum_hi"])
    elif prop == "qingfeng_sword":
        c.line(hx, 6 + off_y, hx, 18 + off_y, PAL["steel_hi"])
        c.rect(hx - 1, 17 + off_y, 3, 1, PAL["jade"])
        c.pix(hx, 20 + off_y, PAL["jade_hi"])
    elif prop == "crescent_blades":
        c.line(8, 13 + off_y, 5, 19 + off_y, PAL["steel_hi"])
        c.line(hx, 13 + off_y, hx + 3, 19 + off_y, PAL["steel_hi"])
    elif prop == "folding_fan":
        draw_folding_fan(c, hx + 1, hy, PAL["ivory_hi"], PAL["rose_hi"], tick)
    elif prop == "opera_drum":
        c.ellipse(16, 20, 4.0, 2.5, PAL["rouge"])
        c.ellipse(16, 19, 3.0, 1.5, PAL["ivory_hi"])
        c.line(9, 15 + off_y, 13, 19, PAL["wood_hi"])
        c.line(hx, 15 + off_y, 19, 19, PAL["wood_hi"])
    elif prop == "silk_kerchiefs":
        c.rect(7 - off_x // 2, 16 + off_y, 4, 5, PAL["rose_hi"])
        c.rect(hx - 1, 16 + off_y, 4, 5, PAL["aqua_hi"])
    elif prop == "flower_spear":
        c.line(hx, 4 + off_y, hx, 27, PAL["wood_hi"])
        c.rect(hx - 1, 3 + off_y, 3, 3, PAL["steel_hi"])
        c.rect(hx - 1, 6 + off_y, 3, 2, PAL["rouge_hi"])
    elif prop == "water_sleeves":
        s_len = 9 if atk_phase == 2 else 7
        c.rect(6, 15, 4, s_len, PAL["aqua_hi"])
        c.rect(7, 15, 2, s_len - 1, PAL["ivory_hi"])
        c.rect(22 + off_x, 15 + off_y, 4 + (2 if atk_phase == 2 else 0), s_len, PAL["aqua_hi"])
        c.rect(23 + off_x, 15 + off_y, 2, s_len - 1, PAL["ivory_hi"])
    elif prop == "wood_fan":
        draw_folding_fan(c, hx + 1, hy, PAL["gold_hi"], PAL["ivory_hi"], tick)
    elif prop == "gong_staff":
        c.line(hx, 10 + off_y, hx, 27, PAL["wood_lo"])
        c.ellipse(hx, 10 + off_y, 3.0, 3.0, PAL["gold"])
        c.pix(hx, 10 + off_y, PAL["gold_hi"])
    elif prop == "gold_fan_ribbons":
        draw_folding_fan(c, hx + 1, hy, PAL["gold_hi"], PAL["rouge_hi"], tick)
    elif prop == "waterfire_staff":
        c.line(hx, 8 + off_y, hx, 27, PAL["seal"])
        c.rect(hx, 8 + off_y, 1, 6, PAL["lacquer"])
    elif prop == "brush_scroll":
        c.line(hx, 11 + off_y, hx, 18 + off_y, PAL["wood_hi"])
        c.pix(hx, 10 + off_y, PAL["lacquer"])
        c.rect(8, 17 + off_y, 4, 4, PAL["ivory_hi"])
    elif prop == "tally_slips":
        c.rect(hx - 1, 10 + off_y, 2, 7, PAL["seal_hi"])
        c.rect(hx + 2, 11 + off_y, 2, 6, PAL["seal"])
        c.pix(hx - 1, 10 + off_y, PAL["gold_hi"])
        c.pix(hx + 2, 11 + off_y, PAL["gold_hi"])
    elif prop == "ring_saber_plaque":
        c.line(hx, 9 + off_y, hx + 2, 19 + off_y, PAL["steel_hi"])
        c.pix(hx + 1, 20 + off_y, PAL["gold"])
        c.rect(8, 16 + off_y, 4, 5, PAL["iron_hi"])
    elif prop == "waist_bow":
        c.line(hx, 11 + off_y, hx + 3, 15 + off_y, PAL["wood_hi"])
        c.line(hx + 3, 15 + off_y, hx, 20 + off_y, PAL["wood_hi"])
        c.line(hx, 11 + off_y, hx, 20 + off_y, PAL["ivory"])
    elif prop == "gavel_seal":
        c.rect(hx - 2, hy - 1, 5, 3, PAL["wood_lo"])
        c.rect(hx - 1, hy - 1, 3, 2, PAL["gold_hi"])
        c.rect(8, 18 + off_y, 3, 3, PAL["seal_hi"])
    elif prop == "imperial_sword":
        c.line(hx, 5 + off_y, hx, 19 + off_y, PAL["gold_hi"])
        c.line(hx + 1, 6 + off_y, hx + 1, 18 + off_y, PAL["steel_hi"])
        c.rect(hx - 1, 18 + off_y, 4, 1, PAL["seal_hi"])

    if atk_phase == 2:
        c.line(hx + 2, 8, hx + 7, 17, PAL["ivory_hi"], 0.9)
        c.line(hx + 3, 10, hx + 7, 18, PAL["amber_hi"], 0.85)


def render_unit_frame(u: dict, mood: str, action: str, frame_idx: int) -> Canvas:
    frame = Canvas(64, 64)
    OX, OY = 16, 12

    if action == "dead":
        c = Canvas(32, 32)
        draw_back_prop(c, u, 0)
        draw_body(c, u, (0, 0), (0, 0))
        c.rect(12, 6, 9, 8, u["skin"][0])
        draw_face(c, u, "dead", frame_idx)
        draw_hair_and_hat(c, u, 0)
        outlined = c.outline(INK)
        if frame_idx == 0:
            tilted = Canvas(32, 32)
            tilted.blit_tilted(outlined, 16, 22, -2, 0, -45)
            frame.blit(tilted, OX, OY)
        else:
            fallen = Canvas(32, 32)
            fallen.blit_rotated_90(outlined, 16, 23, -5, 2)
            frame.blit(fallen, OX, OY)
        return frame

    dx, dy = 0, 0
    boot_l = (0, 0)
    boot_r = (0, 0)
    sway = 0
    atk_phase = 0

    if action == "idle":
        dy = [0, 0, -1, 0][frame_idx % 4]
        sway = [0, 0, 1, 0][frame_idx % 4]
    elif action == "walk":
        gait = [(-2, 0, 1, -1), (0, 0, 0, 0), (1, -1, -2, 0), (0, 0, 0, 0)][frame_idx % 4]
        boot_l = (gait[0], gait[1])
        boot_r = (gait[2], gait[3])
        dy = [-1, 0, -1, 0][frame_idx % 4]
        sway = [-1, 0, 1, 0][frame_idx % 4]
    elif action == "attack":
        if frame_idx == 0:
            dx, atk_phase = -2, 1
        elif frame_idx == 1:
            dx, dy, atk_phase = -1, -1, 1
        elif frame_idx == 2:
            dx, dy, atk_phase = 4, -1, 2
            boot_r = (1, -1)
        elif frame_idx == 3:
            dx, atk_phase = 3, 3
        elif frame_idx == 4:
            dx, atk_phase = 1, 3
        else:
            dx, atk_phase = 0, 0
    elif action == "hurt":
        dx = [-2, -3, -1][frame_idx % 3]
        dy = [0, -1, 0][frame_idx % 3]

    c = Canvas(32, 32)
    draw_back_prop(c, u, sway)
    draw_body(c, u, boot_l, boot_r)
    c.rect(12, 6, 9, 8, u["skin"][0])
    draw_face(c, u, mood, frame_idx)
    draw_hair_and_hat(c, u, sway)
    outlined_body = c.outline(INK)

    prop_layer = Canvas(32, 32)
    draw_prop(prop_layer, u, atk_phase, frame_idx)
    outlined_prop = prop_layer.outline(INK_WARM)

    combined = Canvas(32, 32)
    combined.blit(outlined_body, 0, 0)
    combined.blit(outlined_prop, 0, 0)

    if action == "hurt" and frame_idx == 0:
        for y in range(32):
            for x in range(32):
                r, g, b, a = combined.get(x, y)
                if a > 0 and (x + y) % 2 == 0:
                    combined.pix(x, y, (min(255, r + 55), min(255, g + 50), min(255, b + 45), a))

    if mood == "shock" and action in ("idle", "walk"):
        sx, sy = 28, 3 + (frame_idx % 2)
        combined.rect(sx - 1, sy - 1, 4, 8, INK)
        combined.rect(sx, sy, 2, 4, PAL["amber_hi"])
        combined.rect(sx, sy + 5, 2, 1, PAL["amber_hi"])

    frame.blit(combined, OX + dx, OY + dy)
    return frame


def build_portrait(idle_frame: Canvas) -> Canvas:
    bb = idle_frame.bbox()
    out = Canvas(72, 72)
    if not bb:
        return out
    x0, y0, x1, y1 = bb
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    # Uniform integer 2x pixel density keeps all 40 shop portraits sharp and unclipped!
    scale = 2
    crop = Canvas(bw, bh)
    for y in range(bh):
        for x in range(bw):
            crop.pix(x, y, idle_frame.get(x0 + x, y0 + y))
    dx = (72 - bw * scale) // 2
    dy = (72 - bh * scale) // 2
    out.blit(crop, dx, dy, scale=scale)
    return out


# ── Bold Outlined Shield & VFX Sheets ─────────────────────────────────────────

def build_ward() -> Canvas:
    c = Canvas(64, 64)
    cx, cy = 32, 28
    for a_deg in range(0, 360, 4):
        rad = math.radians(a_deg)
        r = 17.5 + math.cos(rad * 4) * 1.1
        x = round(cx + math.cos(rad) * r)
        y = round(cy + math.sin(rad) * r * 0.92)
        col = PAL["jade_hi"] if (a_deg // 12) % 2 == 0 else PAL["amber_hi"]
        c.pix(x, y, col, 0.85)
    for dx, dy in ((0, -18), (0, 17), (-18, 0), (18, 0)):
        c.rect(cx + dx - 1, cy + dy - 1, 3, 3, PAL["amber_hi"], 0.9)
        c.pix(cx + dx, cy + dy, "#fff9e0", 0.95)
    return c


def draw_starburst(f: Canvas, cx: int, cy: int, r: int, col: str, core: str) -> None:
    f.ellipse(cx, cy, r, r, col, 0.9)
    f.ellipse(cx, cy, max(2, r - 2), max(2, r - 2), core, 0.95)


def build_effect_sheet(kind: str) -> Canvas:
    sheet = Canvas(384, 96)
    for fi in range(4):
        # Work on crisp 48x48 virtual grid then scale 2x cleanly to 96x96!
        v = Canvas(48, 48)
        cx, cy = 24, 24
        t = (fi + 1) / 4.0

        if kind == "canal-wave":
            r = int(6 + t * 10)
            for a in range(0, 360, 16):
                rad = math.radians(a + fi * 18)
                px = round(cx + math.cos(rad) * r)
                py = round(cy + math.sin(rad) * r * 0.72)
                v.rect(px - 1, py - 1, 3, 3, PAL["jade_hi"] if a % 32 == 0 else PAL["teal_hi"])
                v.pix(px, py, "#f2fcf9")
        elif kind == "canal-lantern":
            for k in range(6):
                rad = math.radians(k * 60 + fi * 20)
                px = round(cx + math.cos(rad) * (4 + t * 9))
                py = round(cy + math.sin(rad) * (4 + t * 9) - fi * 2)
                v.rect(px - 1, py - 1, 3, 3, PAL["amber"])
                v.pix(px, py, "#fff9d9")
        elif kind == "escort-banner":
            r = int(6 + t * 11)
            for a in range(-70, 75, 14):
                rad = math.radians(a)
                px = round(cx + math.cos(rad) * r)
                py = round(cy + math.sin(rad) * r)
                v.rect(px - 1, py - 1, 3, 3, PAL["crimson_hi"])
                v.pix(px, py, PAL["gold_hi"])
        elif kind == "escort-shield":
            r = 8 + fi * 2
            for s in range(8):
                a1, a2 = math.radians(s * 45), math.radians((s + 1) * 45)
                v.line(round(cx + math.cos(a1) * r), round(cy + math.sin(a1) * r),
                       round(cx + math.cos(a2) * r), round(cy + math.sin(a2) * r), PAL["gold_hi"])
        elif kind == "blade-plum":
            # Crisp 5-petal plum blossoms + bold crescent slash
            v.line(cx - 10 + fi * 2, cy + 8 - fi * 2, cx + 10, cy - 9, PAL["ivory_hi"])
            v.line(cx - 9 + fi * 2, cy + 8 - fi * 2, cx + 11, cy - 8, PAL["steel_hi"])
            for k in range(5):
                rad = math.radians(k * 72 + fi * 24)
                px = round(cx + math.cos(rad) * (5 + t * 10))
                py = round(cy + math.sin(rad) * (5 + t * 10))
                v.rect(px - 1, py - 1, 3, 3, PAL["plum_hi"])
                v.pix(px, py, "#fbe5ee")
        elif kind == "troupe-sleeve":
            for k in range(2):
                sign = 1 if k == 0 else -1
                for step in range(-10, 11, 2):
                    px = cx + step
                    py = cy + int(math.sin((step + fi * 4) * 0.35) * 6 * sign)
                    v.rect(px - 1, py - 1, 3, 3, PAL["aqua_hi"] if k == 0 else PAL["rose_hi"])
                    v.pix(px, py, "#ffffff")
        elif kind == "troupe-gong":
            r = 5 + fi * 3
            for a in range(0, 360, 14):
                px = round(cx + math.cos(math.radians(a)) * r)
                py = round(cy + math.sin(math.radians(a)) * r)
                v.rect(px, py, 2, 2, PAL["gold_hi"])
        elif kind == "yamen-seal":
            sz = 6 + fi * 2
            v.rect(cx - sz, cy - sz, sz * 2, sz * 2, PAL["seal"])
            v.rect(cx - sz + 2, cy - sz + 2, sz * 2 - 4, sz * 2 - 4, PAL["seal_hi"])
            v.rect(cx - 1, cy - 4, 3, 8, PAL["gold_hi"])
            v.rect(cx - 4, cy - 1, 8, 3, PAL["gold_hi"])
        elif kind == "atk-slash":
            ang0 = -75 + fi * 16
            for a in range(ang0, ang0 + 100, 8):
                rad = math.radians(a)
                for rr in range(7, 13, 2):
                    px, py = round(cx + math.cos(rad) * rr), round(cy + math.sin(rad) * rr)
                    v.rect(px, py, 2, 2, PAL["ivory_hi"] if rr >= 10 else PAL["steel"])
        elif kind == "atk-dart":
            dx = (fi - 1) * 2
            v.rect(cx - 7 + dx, cy - 1, 14, 3, PAL["steel_hi"])
            v.rect(cx + 4 + dx, cy - 2, 4, 5, PAL["ivory_hi"])
            v.rect(cx - 9 + dx, cy - 1, 3, 3, PAL["amber_hi"])
        elif kind == "atk-lantern":
            draw_starburst(v, cx, cy, 5 + (fi % 2), PAL["amber_hi"], "#fff8db")
        elif kind == "atk-tally":
            v.rect(cx - 7, cy - 2, 14, 4, PAL["seal_hi"])
            v.rect(cx + 3, cy - 2, 4, 4, PAL["gold_hi"])
        elif kind == "sym-heal":
            py = cy - fi * 2
            v.rect(cx - 1, py - 5, 3, 11, PAL["jade_hi"])
            v.rect(cx - 5, py - 1, 11, 3, PAL["jade_hi"])
            v.pix(cx, py, "#ffffff")
        elif kind == "sym-shock":
            py = cy - fi
            v.rect(cx - 1, py - 6, 3, 7, PAL["amber_hi"])
            v.rect(cx - 1, py + 3, 3, 3, PAL["amber_hi"])
        elif kind == "sym-shield":
            v.rect(cx - 5, cy - 6, 10, 12, PAL["bronze_hi"])
            v.rect(cx - 3, cy - 4, 6, 8, PAL["gold_hi"])

        outlined_v = v.outline(INK)
        frame = Canvas(96, 96)
        frame.blit(outlined_v, 0, 0, scale=2)
        sheet.blit(frame, fi * 96, 0)
    return sheet


def build_event_sheet(kind: str) -> Canvas:
    sheet = Canvas(512, 128)
    for fi in range(4):
        v = Canvas(64, 64)
        cx, cy = 32, 32
        t = (fi + 1) / 4.0
        if kind == "hurt":
            for k in range(8):
                rad = math.radians(k * 45 + fi * 10)
                r = 5 + t * 11
                v.line(round(cx + math.cos(rad) * 4), round(cy + math.sin(rad) * 4),
                       round(cx + math.cos(rad) * r), round(cy + math.sin(rad) * r),
                       PAL["amber_hi"] if k % 2 == 0 else PAL["crimson_hi"])
        elif kind == "heal":
            for k in range(6):
                ox = round((k - 2.5) * 5)
                oy = 7 - fi * 4 - (k % 2) * 3
                v.rect(cx + ox - 1, cy + oy - 1, 3, 3, PAL["jade_hi"])
                v.pix(cx + ox, cy + oy, "#f2fcf8")
        elif kind == "shield":
            r = 10 + fi * 2
            for a in range(0, 360, 20):
                v.rect(cx + math.cos(math.radians(a)) * r - 1, cy + math.sin(math.radians(a)) * r - 1, 2, 2, PAL["gold_hi"])
        elif kind == "spawn":
            r = 6 + fi * 4
            for a in range(0, 360, 16):
                v.rect(cx + math.cos(math.radians(a)) * r - 1, cy + math.sin(math.radians(a)) * r * 0.65 - 1,
                       2, 2, PAL["amber_hi"] if fi < 2 else PAL["jade_hi"])
        elif kind == "death":
            for k in range(7):
                ox = round(math.sin(k * 1.4 + fi) * 9)
                oy = 6 - fi * 5 - (k % 3) * 3
                v.rect(cx + ox - 1, cy + oy - 1, 3, 3, PAL["ivory"] if k % 2 == 0 else PAL["amber_hi"])
        outlined_v = v.outline(INK)
        frame = Canvas(128, 128)
        frame.blit(outlined_v, 0, 0, scale=2)
        sheet.blit(frame, fi * 128, 0)
    return sheet


FONT_3X5 = {
    "a": ["010", "101", "111", "101", "101"], "b": ["110", "101", "110", "101", "110"],
    "c": ["011", "100", "100", "100", "011"], "d": ["110", "101", "101", "101", "110"],
    "e": ["111", "100", "110", "100", "111"], "f": ["111", "100", "110", "100", "100"],
    "g": ["011", "100", "101", "101", "011"], "h": ["101", "101", "111", "101", "101"],
    "i": ["111", "010", "010", "010", "111"], "j": ["001", "001", "001", "101", "010"],
    "k": ["101", "101", "110", "101", "101"], "l": ["100", "100", "100", "100", "111"],
    "m": ["101", "111", "111", "101", "101"], "n": ["110", "101", "101", "101", "101"],
    "o": ["010", "101", "101", "101", "010"], "p": ["110", "101", "110", "100", "100"],
    "q": ["010", "101", "101", "111", "001"], "r": ["110", "101", "110", "101", "101"],
    "s": ["011", "100", "010", "001", "110"], "t": ["111", "010", "010", "010", "010"],
    "u": ["101", "101", "101", "101", "111"], "v": ["101", "101", "101", "101", "010"],
    "w": ["101", "101", "111", "111", "101"], "x": ["101", "101", "010", "101", "101"],
    "y": ["101", "101", "010", "010", "010"], "z": ["111", "001", "010", "100", "111"],
    "-": ["000", "000", "111", "000", "000"],
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"], "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "110", "001", "110"],
}


def draw_label(c: Canvas, text: str, x: int, y: int, col: str) -> None:
    cx = x
    for ch in text.lower():
        glyph = FONT_3X5.get(ch)
        if glyph:
            for gy, row in enumerate(glyph):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        c.pix(cx + gx, y + gy, col)
        cx += 4


CLIP_SPEC = [
    ("happy/idle",     True,  [225, 225, 225, 225]),
    ("happy/walk",     True,  [115, 115, 115, 115]),
    ("happy/attack",   False, [135, 135, 135, 135, 135, 135]),
    ("happy/hurt",     False, [80, 80, 80]),
    ("serious/idle",   True,  [225, 225, 225, 225]),
    ("serious/walk",   True,  [115, 115, 115, 115]),
    ("serious/attack", False, [135, 135, 135, 135, 135, 135]),
    ("serious/hurt",   False, [80, 80, 80]),
    ("cry/idle",       True,  [225, 225, 225, 225]),
    ("cry/walk",       True,  [115, 115, 115, 115]),
    ("cry/attack",     False, [135, 135, 135, 135, 135, 135]),
    ("cry/hurt",       False, [80, 80, 80]),
    ("shock/idle",     True,  [225, 225, 225, 225]),
    ("shock/walk",     True,  [115, 115, 115, 115]),
    ("shock/attack",   False, [135, 135, 135, 135, 135, 135]),
    ("shock/hurt",     False, [80, 80, 80]),
    ("dead",           False, [160, 160, 160, 160]),
]


def main() -> None:
    out_root = Path(os.environ.get("JH_OUT", Path(__file__).resolve().parent.parent))
    print(f"Generating Jianghu pixel assets into {out_root}...")

    clips_json = {}
    for row, (key, loop, durs) in enumerate(CLIP_SPEC):
        clips_json[key] = {
            "loop": loop,
            "frames": [{"x": col * 64, "y": row * 64, "w": 64, "h": 64, "durationMs": d} for col, d in enumerate(durs)],
        }

    cols_cs = 8
    rows_cs = math.ceil(len(UNITS) / cols_cs)
    cell_w, cell_h = 104, 112
    contact = Canvas(cols_cs * cell_w + 16, rows_cs * cell_h + 16, "#f3eee7")

    unit_entries = []
    for idx, u in enumerate(UNITS):
        uid = u["id"]
        atlas = Canvas(512, 1088)
        idle0 = None
        for row, (key, _loop, durs) in enumerate(CLIP_SPEC):
            mood, act = ("dead", "dead") if key == "dead" else key.split("/")
            for col in range(len(durs)):
                f = render_unit_frame(u, mood, act, col)
                atlas.blit(f, col * 64, row * 64)
                if key == "happy/idle" and col == 0:
                    idle0 = f

        write_png(out_root / "atlases" / f"{uid}.png", 512, 1088, atlas.buf)
        assert idle0 is not None
        portrait = build_portrait(idle0)
        write_png(out_root / "portraits" / f"{uid}.png", 72, 72, portrait.buf)

        cx = 12 + (idx % cols_cs) * cell_w
        cy = 12 + (idx // cols_cs) * cell_h
        contact.rect(cx, cy, cell_w - 8, cell_h - 8, "#faf7f2")
        contact.rect(cx, cy, cell_w - 8, 1, "#c7beb2")
        contact.rect(cx, cy + cell_h - 9, cell_w - 8, 1, "#c7beb2")
        contact.rect(cx, cy, 1, cell_h - 8, "#c7beb2")
        contact.rect(cx + cell_w - 9, cy, 1, cell_h - 8, "#c7beb2")
        contact.blit(portrait, cx + 12, cy + 8)
        draw_label(contact, uid.replace("jh-", ""), cx + 8, cy + 88, FACTION_COLOR[u["faction"]])

        unit_entries.append({
            "id": uid,
            "name": u["name"],
            "atlas": f"atlases/{uid}.png",
            "portrait": f"portraits/{uid}.png",
            "color": FACTION_COLOR[u["faction"]],
        })

    write_png(out_root / "contact-sheet.png", contact.w, contact.h, contact.buf)

    ward = build_ward()
    write_png(out_root / "effects" / "ward.png", 64, 64, ward.buf)

    skill_kinds = [
        "canal-wave", "canal-lantern", "escort-banner", "escort-shield",
        "blade-plum", "troupe-sleeve", "troupe-gong", "yamen-seal",
    ]
    atk_kinds = ["atk-slash", "atk-dart", "atk-lantern", "atk-tally"]
    sym_kinds = ["sym-heal", "sym-shock", "sym-shield"]

    for sk in skill_kinds:
        write_png(out_root / "effects" / f"{sk}.png", 384, 96, build_effect_sheet(sk).buf)
    for ak in atk_kinds:
        write_png(out_root / "effects" / "attacks" / f"{ak}.png", 384, 96, build_effect_sheet(ak).buf)
    for sm in sym_kinds:
        write_png(out_root / "effects" / "symbols" / f"{sm}.png", 384, 96, build_effect_sheet(sm).buf)

    ev_kinds = ["hurt", "heal", "shield", "spawn", "death"]
    for ek in ev_kinds:
        write_png(out_root / "effects" / "events" / f"ev-{ek}.png", 512, 128, build_event_sheet(ek).buf)

    frames_96 = [{"x": i * 96, "y": 0, "w": 96, "h": 96} for i in range(4)]
    frames_128 = [{"x": i * 128, "y": 0, "w": 128, "h": 128} for i in range(4)]

    fx_units = []
    for u in UNITS:
        fac, sk, role, uid = u["faction"], u["skill"], u["role"], u["id"]
        if fac == "canal":
            skill_file = "effects/canal-lantern.png" if (sk == "ally-heal" or uid in ("jh-lamp", "jh-clerk")) else "effects/canal-wave.png"
        elif fac == "escort":
            skill_file = "effects/escort-shield.png" if sk == "self-shield" else ("effects/canal-lantern.png" if sk == "ally-heal" else "effects/escort-banner.png")
        elif fac == "blade":
            skill_file = "effects/blade-plum.png"
        elif fac == "troupe":
            skill_file = "effects/troupe-gong.png" if (sk == "ally-heal" or uid == "jh-drum") else "effects/troupe-sleeve.png"
        else:
            skill_file = "effects/escort-shield.png" if sk == "self-shield" else "effects/yamen-seal.png"

        if uid in ("jh-lamp", "jh-boatgirl"):
            atk_file, rotate = "effects/attacks/atk-lantern.png", True
        elif fac == "yamen" and role in ("ranged", "caster"):
            atk_file, rotate = "effects/attacks/atk-tally.png", True
        elif role in ("ranged", "caster"):
            atk_file, rotate = "effects/attacks/atk-dart.png", True
        else:
            atk_file, rotate = "effects/attacks/atk-slash.png", False

        sym_file = "effects/symbols/sym-heal.png" if sk == "ally-heal" else ("effects/symbols/sym-shield.png" if sk == "self-shield" else "effects/symbols/sym-shock.png")
        fx_units.append({
            "id": uid,
            "file": skill_file,
            "attackFile": atk_file,
            "symbolsFile": sym_file,
            "ranged": role in ("ranged", "caster"),
            "rotate": rotate,
        })

    manifest = {
        "version": 1,
        "pack": "jianghu",
        "frame": {"width": 64, "height": 64, "columns": 8, "rows": 17, "anchor": {"x": 32, "y": 40}},
        "atlas": {"width": 512, "height": 1088},
        "clips": clips_json,
        "effects": {
            "ward": {"file": "effects/ward.png", "width": 64, "height": 64, "anchor": {"x": 32, "y": 40}}
        },
        "units": unit_entries,
    }
    (out_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    fx_manifest = {
        "version": 1,
        "frame": {"width": 96, "height": 96, "anchor": {"x": 48, "y": 48}},
        "frames": frames_96,
        "units": fx_units,
    }
    (out_root / "effects" / "manifest.json").write_text(json.dumps(fx_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    ev_manifest = {
        "version": 1,
        "frame": {"width": 128, "height": 128, "anchor": {"x": 64, "y": 64}},
        "frames": frames_128,
        "events": [
            {"key": ek, "file": f"effects/events/ev-{ek}.png"} for ek in ev_kinds
        ],
    }
    (out_root / "effects" / "events" / "manifest.json").write_text(json.dumps(ev_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Done: {len(UNITS)} atlases, {len(UNITS)} portraits, manifests, and contact-sheet.png.")


if __name__ == "__main__":
    main()

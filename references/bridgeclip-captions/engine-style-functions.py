# Reference only: BridgeClip MIT, copyright 2026 BridgeMind LLC.
# CaptionStyle contract is defined upstream in engine/clip_engine/config.py.

def _create_pop_style() -> CaptionStyle:
    """Pop: the default. Montserrat Black with a crisp stroke over a soft shadow."""
    s = CaptionStyle()
    s.emphasis_color = "#3DFF8B"
    return s


def _create_spotlight_style() -> CaptionStyle:
    """Spotlight: the active word sits on a violet pill, text stays white."""
    s = CaptionStyle()
    s.font_name = "Poppins Black"
    s.font_size = 80
    s.highlight_color = "#FFFFFF"
    s.outline_width = 5
    s.highlight_box_color = "#7C5CFF"
    s.highlight_box_padding = 16
    s.emphasis_color = "#FFE234"
    return s


def _create_impact_style() -> CaptionStyle:
    """Impact: tall condensed Anton, two words per line, hard 3D-style shadow."""
    s = CaptionStyle()
    s.font_name = "Anton"
    s.font_size = 124
    s.letter_spacing = 1
    s.max_words_per_line = 2
    s.highlight_color = "#FFD60A"
    s.outline_width = 7
    s.shadow_opacity = 0.9
    s.shadow_blur = 1
    s.shadow_offset = 10
    s.future_words = "hide"
    s.emphasis_color = "#FF4D4D"
    return s


def _create_glow_style() -> CaptionStyle:
    """Glow: no stroke, soft shadow for legibility, cyan bloom on the active word."""
    s = CaptionStyle()
    s.font_name = "Montserrat ExtraBold"
    s.font_size = 80
    s.highlight_color = "#7DF9FF"
    s.outline_width = 0
    s.shadow_opacity = 0.75
    s.shadow_blur = 12
    s.shadow_offset = 4
    s.shadow_spread = 5
    s.glow_color = "#00C8FF"
    s.glow_opacity = 0.85
    s.glow_radius = 8
    s.glow_blur = 16
    s.emphasis_color = "#FF6BD6"
    return s


def _create_boxed_style() -> CaptionStyle:
    """Boxed: white text on a translucent black plate, yellow active word."""
    s = CaptionStyle()
    s.font_name = "Archivo Black"
    s.font_size = 70
    s.highlight_color = "#FFD23F"
    s.outline_width = 0
    s.shadow_opacity = 0.0
    s.line_box_color = "#000000"
    s.line_box_opacity = 0.62
    s.line_box_padding = 22
    s.emphasis_color = "#4ADE80"
    return s


def _create_sweep_style() -> CaptionStyle:
    """Sweep: karaoke fill from white to pink as each word is spoken."""
    s = CaptionStyle()
    s.font_name = "Poppins ExtraBold"
    s.font_size = 76
    s.max_words_per_line = 4
    s.highlight_color = "#FF5FA2"
    s.outline_width = 5
    s.karaoke_fill = True
    s.entrance_pop = False
    s.dim_opacity = 1.0
    s.emphasis_color = "#FFE234"
    return s


def _create_editorial_style() -> CaptionStyle:
    """Editorial: large italic serif, sentence case, upcoming words dimmed."""
    s = CaptionStyle()
    s.font_name = "Instrument Serif Italic"
    s.font_size = 112
    s.italic = True
    s.uppercase = False
    s.max_words_per_line = 4
    s.highlight_color = "#FFE6B8"
    s.outline_width = 0
    s.shadow_opacity = 0.9
    s.shadow_blur = 20
    s.shadow_offset = 3
    s.shadow_spread = 8
    s.future_words = "dim"
    s.dim_opacity = 0.6
    s.entrance_pop = False
    return s


def _create_hype_style() -> CaptionStyle:
    """Hype: Montserrat Black with an extra-heavy stroke, hard shadow, green active word."""
    s = CaptionStyle()
    s.font_size = 88
    s.highlight_color = "#39FF6A"
    s.outline_width = 8
    s.shadow_opacity = 0.95
    s.shadow_blur = 1
    s.shadow_offset = 9
    s.color_transition = True
    s.emphasis_color = "#FFE234"
    return s


def _create_punch_style() -> CaptionStyle:
    """Punch: one oversized Anton word at a time."""
    s = CaptionStyle()
    s.font_name = "Anton"
    s.font_size = 150
    s.letter_spacing = 1
    s.max_words_per_line = 1
    s.highlight_color = "#FFFFFF"
    s.outline_width = 8
    s.shadow_opacity = 0.9
    s.shadow_blur = 1
    s.shadow_offset = 12
    s.emphasis_color = "#FF3B30"
    return s


def _create_neon_style() -> CaptionStyle:
    """Neon: no stroke, soft shadow, magenta bloom and pink active word."""
    s = CaptionStyle()
    s.font_name = "Poppins ExtraBold"
    s.font_size = 78
    s.highlight_color = "#FF9CEB"
    s.outline_width = 0
    s.shadow_opacity = 0.75
    s.shadow_blur = 12
    s.shadow_offset = 4
    s.shadow_spread = 5
    s.glow_color = "#FF2EC4"
    s.glow_opacity = 0.9
    s.glow_radius = 9
    s.glow_blur = 18
    s.emphasis_color = "#7DF9FF"
    return s


def _create_headline_style() -> CaptionStyle:
    """Headline: Archivo Black, the active word sits on a red news-style tag."""
    s = CaptionStyle()
    s.font_name = "Archivo Black"
    s.font_size = 72
    s.highlight_color = "#FFFFFF"
    s.outline_width = 4
    s.highlight_box_color = "#E5202E"
    s.highlight_box_padding = 14
    s.emphasis_color = "#FFD23F"
    return s


def _create_paper_style() -> CaptionStyle:
    """Paper: dark sentence-case type on an almost-opaque white card."""
    s = CaptionStyle()
    s.font_name = "Poppins ExtraBold"
    s.font_size = 68
    s.uppercase = False
    s.max_words_per_line = 4
    s.primary_color = "#111111"
    s.highlight_color = "#6D28D9"
    s.outline_width = 0
    s.shadow_opacity = 0.0
    s.line_box_color = "#FFFFFF"
    s.line_box_opacity = 0.94
    s.line_box_padding = 22
    s.entrance_pop = False
    s.emphasis_color = "#DB2777"
    return s


def _create_subtle_style() -> CaptionStyle:
    """Subtle: lighter sentence case, halo shadow instead of stroke, upcoming words dimmed."""
    s = CaptionStyle()
    s.font_name = "Montserrat ExtraBold"
    s.font_size = 70
    s.uppercase = False
    s.max_words_per_line = 4
    s.highlight_color = "#C4F1FF"
    s.outline_width = 0
    s.shadow_opacity = 0.85
    s.shadow_blur = 16
    s.shadow_offset = 3
    s.shadow_spread = 6
    s.future_words = "dim"
    s.dim_opacity = 0.55
    s.entrance_pop = False
    s.color_transition = True
    return s


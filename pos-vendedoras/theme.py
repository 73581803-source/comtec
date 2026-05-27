"""Paleta de colores ComTec y hoja de estilos global para PyQt6."""

# Colores del logo
BRAND       = "#1e329c"
BRAND_DARK  = "#182879"
BRAND_LIGHT = "#3a4daf"
CYAN        = "#008dde"
CYAN_SOFT   = "#99dcf5"

# Neutros
BG          = "#f4f6fb"
SURFACE     = "#ffffff"
SURFACE_2   = "#f8fafc"
LINE        = "#e3e7f1"
TEXT        = "#0f172a"
TEXT_2      = "#475569"
TEXT_MUTE   = "#94a3b8"

# Estados
SUCCESS = "#16a34a"
WARNING = "#d97706"
DANGER  = "#dc2626"


STYLESHEET = f"""
* {{
    font-family: 'Segoe UI', 'Plus Jakarta Sans', sans-serif;
    color: {TEXT};
}}

QMainWindow, QDialog, QWidget#root {{
    background: {BG};
}}

QLabel#title {{
    font-size: 24px;
    font-weight: 700;
    color: {TEXT};
}}
QLabel#subtitle {{
    font-size: 14px;
    color: {TEXT_2};
}}
QLabel#muted {{ color: {TEXT_MUTE}; font-size: 12px; }}
QLabel#kpi_title {{ color: {TEXT_MUTE}; font-size: 12px; }}
QLabel#kpi_value {{ color: {TEXT}; font-size: 22px; font-weight: 800; }}
QLabel#brand_logo {{ font-size: 20px; font-weight: 800; color: white; }}

/* Cards genéricas */
QFrame#card {{
    background: {SURFACE};
    border: 1px solid {LINE};
    border-radius: 12px;
}}
QFrame#kpi_card {{
    background: {SURFACE};
    border: 1px solid {LINE};
    border-radius: 12px;
    padding: 14px;
}}

/* Sidebar */
QFrame#sidebar {{
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 {BRAND_DARK}, stop:1 {BRAND});
    border: none;
}}
QPushButton#nav_btn {{
    background: transparent;
    color: rgba(255,255,255,0.78);
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    text-align: left;
    font-size: 14px;
}}
QPushButton#nav_btn:hover {{
    background: rgba(255,255,255,0.08);
    color: white;
}}
QPushButton#nav_btn:checked,
QPushButton#nav_btn[active="true"] {{
    background: rgba(0,141,222,0.25);
    color: white;
    font-weight: 600;
}}
QPushButton#logout_btn {{
    background: rgba(255,255,255,0.08);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
}}
QPushButton#logout_btn:hover {{ background: rgba(220,38,38,0.5); }}

/* Inputs */
QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateEdit, QTextEdit, QPlainTextEdit {{
    background: white;
    border: 1.5px solid {LINE};
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    selection-background-color: {CYAN_SOFT};
}}
QLineEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus,
QDateEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {{
    border-color: {BRAND};
}}
QComboBox::drop-down {{ border: none; padding-right: 8px; }}

/* Buttons */
QPushButton#primary {{
    background: {BRAND};
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
}}
QPushButton#primary:hover {{ background: {BRAND_DARK}; }}
QPushButton#primary:disabled {{ background: {TEXT_MUTE}; }}

QPushButton#cyan {{
    background: {CYAN};
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
}}
QPushButton#cyan:hover {{ background: #0073b8; }}

QPushButton#ghost {{
    background: {SURFACE_2};
    color: {TEXT};
    border: 1px solid {LINE};
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
}}
QPushButton#ghost:hover {{ background: {LINE}; }}

QPushButton#danger {{
    background: {DANGER};
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
}}

/* Tablas */
QTableWidget {{
    background: {SURFACE};
    border: 1px solid {LINE};
    border-radius: 10px;
    gridline-color: {LINE};
    selection-background-color: {CYAN_SOFT};
    selection-color: {TEXT};
}}
QHeaderView::section {{
    background: {SURFACE_2};
    color: {TEXT_2};
    border: none;
    border-bottom: 1px solid {LINE};
    padding: 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
}}
QTableWidget::item {{ padding: 8px; }}

/* Topbar */
QFrame#topbar {{
    background: {SURFACE};
    border: none;
    border-bottom: 1px solid {LINE};
}}

/* ToolTip */
QToolTip {{
    background: {TEXT};
    color: white;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
}}

/* Scrollbars */
QScrollBar:vertical {{
    background: transparent; width: 10px; margin: 0;
}}
QScrollBar::handle:vertical {{
    background: {LINE}; border-radius: 5px; min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{ background: {TEXT_MUTE}; }}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}

/* Status pill labels (usados con setProperty('pill', ...)) */
QLabel[pill="success"] {{
    background: #dcfce7; color: #166534;
    padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}}
QLabel[pill="warn"] {{
    background: #fef3c7; color: #92400e;
    padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}}
QLabel[pill="danger"] {{
    background: #fee2e2; color: #991b1b;
    padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}}
QLabel[pill="brand"] {{
    background: rgba(30,50,156,0.1); color: {BRAND};
    padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}}
QLabel[pill="cyan"] {{
    background: rgba(0,141,222,0.1); color: {CYAN};
    padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
}}
"""

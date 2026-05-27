"""Ventana principal con sidebar y stack de vistas."""
from pathlib import Path
from PyQt6.QtCore import Qt, QSize, pyqtSignal
from PyQt6.QtGui import QPixmap, QIcon
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QLabel, QPushButton,
    QFrame, QStackedWidget, QSizePolicy, QMessageBox, QButtonGroup
)

import api
from theme import BRAND, CYAN, SURFACE, TEXT, TEXT_2
from views import DashboardView, DocumentosView


class MainWindow(QMainWindow):
    logout_requested = pyqtSignal()

    def __init__(self):
        super().__init__()
        user = api.get_user()
        self.setWindowTitle(f"ComTec POS — {user.get('nombre','')}")
        self.resize(1240, 760)
        self.setMinimumSize(1000, 640)

        logo_path = Path(__file__).parent / "assets" / "logo.jpeg"
        if logo_path.exists():
            self.setWindowIcon(QIcon(str(logo_path)))

        self._build_ui(user)

    def _build_ui(self, user):
        central = QWidget()
        central.setObjectName("root")
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        root.addWidget(self._sidebar(user))
        root.addWidget(self._main_area(user), 1)

    # ---------- Sidebar ----------
    def _sidebar(self, user):
        side = QFrame()
        side.setObjectName("sidebar")
        side.setFixedWidth(240)
        v = QVBoxLayout(side)
        v.setContentsMargins(14, 18, 14, 14)
        v.setSpacing(6)

        # Cabecera
        cab = QHBoxLayout()
        logo_lbl = QLabel()
        logo_path = Path(__file__).parent / "assets" / "logo.jpeg"
        if logo_path.exists():
            pix = QPixmap(str(logo_path)).scaled(36, 36,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation)
            logo_lbl.setPixmap(pix)
        logo_lbl.setStyleSheet("background: white; border-radius: 8px; padding: 3px;")
        logo_lbl.setFixedSize(46, 46)
        cab.addWidget(logo_lbl)

        cab_text = QVBoxLayout()
        cab_text.setSpacing(0)
        b = QLabel("ComTec")
        b.setStyleSheet("color: white; font-size: 16px; font-weight: 800;")
        s = QLabel("Punto de venta")
        s.setStyleSheet("color: rgba(255,255,255,0.55); font-size: 10px; letter-spacing: 1px;")
        cab_text.addWidget(b); cab_text.addWidget(s)
        cab.addLayout(cab_text)
        cab.addStretch(1)
        v.addLayout(cab)
        v.addSpacing(20)

        # Botones de navegación
        self.nav_group = QButtonGroup(self)
        self.nav_group.setExclusive(True)

        self.nav_buttons = []
        items = [
            ("dashboard", "📊  Resumen"),
            ("boletas",   "🧾  Boletas"),
            ("proformas", "📋  Proformas"),
            ("notas",     "📝  Notas de venta"),
        ]
        for key, label in items:
            btn = QPushButton(label)
            btn.setObjectName("nav_btn")
            btn.setCheckable(True)
            btn.setProperty("active", False)
            btn.clicked.connect(lambda _, k=key: self._goto(k))
            self.nav_buttons.append((key, btn))
            self.nav_group.addButton(btn)
            v.addWidget(btn)

        v.addStretch(1)

        # Usuario
        info = QLabel(f"<b style='color:white'>{user.get('nombre','')}</b>"
                      f"<br><span style='color:rgba(255,255,255,0.55);font-size:11px'>"
                      f"{user.get('role','').upper()}</span>")
        info.setStyleSheet("padding: 12px; background: rgba(255,255,255,0.08); border-radius: 8px;")
        v.addWidget(info)

        logout = QPushButton("⎋  Cerrar sesión")
        logout.setObjectName("logout_btn")
        logout.clicked.connect(self._logout)
        v.addWidget(logout)
        return side

    # ---------- Main ----------
    def _main_area(self, user):
        wrap = QFrame()
        wrap.setStyleSheet("background: #f4f6fb;")
        v = QVBoxLayout(wrap)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(0)

        # Topbar
        top = QFrame()
        top.setObjectName("topbar")
        top.setFixedHeight(60)
        tlay = QHBoxLayout(top)
        tlay.setContentsMargins(24, 0, 24, 0)
        self.page_title = QLabel("Resumen")
        self.page_title.setStyleSheet("font-size: 18px; font-weight: 700;")
        tlay.addWidget(self.page_title)
        tlay.addStretch(1)
        avatar = QLabel((user.get('nombre','U') or 'U')[:2].upper())
        avatar.setFixedSize(36, 36)
        avatar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        avatar.setStyleSheet(f"background: {BRAND}; color: white; "
                             "border-radius: 18px; font-weight: 700;")
        tlay.addWidget(avatar)
        v.addWidget(top)

        # Stack
        self.stack = QStackedWidget()
        v.addWidget(self.stack, 1)

        self.views = {
            "dashboard": DashboardView(),
            "boletas":   DocumentosView("boleta"),
            "proformas": DocumentosView("proforma"),
            "notas":     DocumentosView("nota_venta"),
        }
        for w in self.views.values():
            self.stack.addWidget(w)

        # Vista inicial
        self.nav_buttons[0][1].setChecked(True)
        self._goto("dashboard")
        return wrap

    def _goto(self, key):
        labels = {
            "dashboard": "Resumen", "boletas": "Boletas",
            "proformas": "Proformas / Cotizaciones", "notas": "Notas de venta (uso interno)",
        }
        self.page_title.setText(labels.get(key, key))
        self.stack.setCurrentWidget(self.views[key])
        # Refrescar al entrar
        view = self.views[key]
        if hasattr(view, "reload"):
            view.reload()
        # Marcar botón activo
        for k, b in self.nav_buttons:
            b.setChecked(k == key)

    def _logout(self):
        api.clear_session()
        self.logout_requested.emit()

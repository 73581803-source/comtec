"""Ventana de login profesional con paleta ComTec."""
from pathlib import Path
from PyQt6.QtCore import Qt, QSize, QThread, pyqtSignal
from PyQt6.QtGui import QPixmap, QIcon, QFont
from PyQt6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QFrame, QMessageBox, QCheckBox
)

import api
from theme import BRAND, CYAN, BRAND_DARK, SURFACE, TEXT_2, CYAN_SOFT


class LoginWorker(QThread):
    """Hace el login en hilo aparte para no congelar la UI."""
    success = pyqtSignal(dict)
    error = pyqtSignal(str)

    def __init__(self, email, password):
        super().__init__()
        self.email = email
        self.password = password

    def run(self):
        try:
            user = api.login(self.email, self.password)
            self.success.emit(user)
        except Exception as e:
            self.error.emit(str(e))


class LoginWindow(QWidget):
    login_ok = pyqtSignal(dict)

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Iniciar sesión — ComTec POS")
        self.resize(900, 580)
        self.setMinimumSize(720, 480)
        self._build_ui()
        self.worker = None

    # -------- Layout --------
    def _build_ui(self):
        root = QHBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)
        root.addWidget(self._branding_side(), 5)
        root.addWidget(self._form_side(), 4)

    def _branding_side(self):
        frame = QFrame()
        frame.setObjectName("login_brand")
        frame.setStyleSheet(f"""
            QFrame#login_brand {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 {BRAND_DARK}, stop:1 {CYAN});
            }}
            QLabel {{ color: white; }}
            QLabel#hero {{ font-size: 28px; font-weight: 800; }}
            QLabel#hero_sub {{ font-size: 14px; color: rgba(255,255,255,0.85); }}
            QLabel#feat {{ font-size: 13px; color: rgba(255,255,255,0.9); }}
        """)
        v = QVBoxLayout(frame)
        v.setContentsMargins(48, 48, 48, 48)
        v.setSpacing(14)

        # Logo
        logo = QLabel()
        logo_path = Path(__file__).parent / "assets" / "logo.jpeg"
        if logo_path.exists():
            pix = QPixmap(str(logo_path)).scaled(72, 72,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation)
            logo.setPixmap(pix)
        logo.setStyleSheet("background: white; border-radius: 16px; padding: 6px;")
        logo.setFixedSize(86, 86)

        v.addWidget(logo)
        v.addSpacing(20)

        hero = QLabel("Punto de venta\nComTec")
        hero.setObjectName("hero")
        v.addWidget(hero)

        sub = QLabel("Sistema para vendedoras y administradoras")
        sub.setObjectName("hero_sub")
        sub.setWordWrap(True)
        v.addWidget(sub)
        v.addSpacing(28)

        features = [
            "Generar boletas, proformas y notas de venta",
            "Imprimir o exportar PDF al instante",
            "Inventario sincronizado con la tienda",
            "Productos externos cuando no hay stock",
        ]
        for txt in features:
            row = QHBoxLayout()
            dot = QLabel("●")
            dot.setStyleSheet(f"color: {CYAN_SOFT}; font-size: 12px;")
            row.addWidget(dot)
            lbl = QLabel(txt)
            lbl.setObjectName("feat")
            row.addWidget(lbl, 1)
            v.addLayout(row)

        v.addStretch(1)
        foot = QLabel("© ComTec · Huancayo, Perú")
        foot.setStyleSheet("color: rgba(255,255,255,0.5); font-size: 12px;")
        v.addWidget(foot)
        return frame

    def _form_side(self):
        frame = QFrame()
        frame.setStyleSheet(f"background: {SURFACE};")
        v = QVBoxLayout(frame)
        v.setContentsMargins(48, 60, 48, 40)
        v.setSpacing(14)

        title = QLabel("Iniciar sesión")
        title.setObjectName("title")
        sub = QLabel("Ingresa tus credenciales para continuar")
        sub.setObjectName("subtitle")
        v.addWidget(title)
        v.addWidget(sub)
        v.addSpacing(24)

        v.addWidget(self._field_label("Correo electrónico"))
        self.email = QLineEdit()
        self.email.setPlaceholderText("tu.correo@comtec.pe")
        v.addWidget(self.email)
        v.addSpacing(8)

        v.addWidget(self._field_label("Contraseña"))
        self.password = QLineEdit()
        self.password.setEchoMode(QLineEdit.EchoMode.Password)
        self.password.setPlaceholderText("••••••••")
        v.addWidget(self.password)
        v.addSpacing(14)

        self.recordar = QCheckBox("Recordarme en este equipo")
        self.recordar.setChecked(True)
        v.addWidget(self.recordar)
        v.addSpacing(16)

        self.btn = QPushButton("Ingresar")
        self.btn.setObjectName("primary")
        self.btn.setFixedHeight(46)
        self.btn.clicked.connect(self._on_login)
        v.addWidget(self.btn)

        self.err = QLabel("")
        self.err.setStyleSheet("color: #dc2626; font-size: 13px; font-weight: 500; padding: 6px 0;")
        self.err.setWordWrap(True)
        v.addWidget(self.err)

        v.addStretch(1)

        # Credenciales demo discretas
        demo = QLabel(
            "<b style='color:%s'>Cuentas demo:</b>"
            "<br>admin@comtec.pe / admin123"
            "<br>maria@comtec.pe / vendedor123" % BRAND
        )
        demo.setStyleSheet(f"color: {TEXT_2}; font-size: 12px; background: #f8fafc;"
                           "padding: 10px 14px; border-radius: 8px; border: 1px dashed #e3e7f1;")
        v.addWidget(demo)

        # Enter para enviar
        self.email.returnPressed.connect(self._on_login)
        self.password.returnPressed.connect(self._on_login)

        # Cargar último email si lo recordó
        self._restore_remembered()
        return frame

    def _field_label(self, text):
        lbl = QLabel(text)
        lbl.setStyleSheet("font-size: 12px; font-weight: 600; color: #475569; padding-top: 4px;")
        return lbl

    def _restore_remembered(self):
        from pathlib import Path
        cache = Path.home() / ".comtec_pos_email"
        if cache.exists():
            try:
                self.email.setText(cache.read_text(encoding="utf-8").strip())
                self.password.setFocus()
            except Exception:
                pass

    def _persist_remembered(self):
        from pathlib import Path
        cache = Path.home() / ".comtec_pos_email"
        try:
            if self.recordar.isChecked():
                cache.write_text(self.email.text().strip(), encoding="utf-8")
            elif cache.exists():
                cache.unlink()
        except Exception:
            pass

    # -------- Acciones --------
    def _on_login(self):
        email = self.email.text().strip()
        password = self.password.text()
        if not email or not password:
            self.err.setText("Email y contraseña son obligatorios")
            return
        self.err.setText("")
        self.btn.setEnabled(False)
        self.btn.setText("Ingresando…")
        self.worker = LoginWorker(email, password)
        self.worker.success.connect(self._on_ok)
        self.worker.error.connect(self._on_err)
        self.worker.start()

    def _on_ok(self, user):
        self._persist_remembered()
        if user.get("role") not in ("admin", "vendedor"):
            self._on_err("Esta app es solo para administradores y vendedoras")
            return
        self.login_ok.emit(user)

    def _on_err(self, msg):
        self.btn.setEnabled(True)
        self.btn.setText("Ingresar")
        self.err.setText(msg)

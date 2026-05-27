"""Diálogo único para crear boleta / proforma / nota de venta."""
import os
import subprocess
from datetime import datetime, timedelta
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QLineEdit,
    QComboBox, QSpinBox, QDoubleSpinBox, QPushButton, QFrame, QTableWidget,
    QTableWidgetItem, QHeaderView, QMessageBox, QAbstractItemView,
    QDateEdit, QTextEdit, QSizePolicy, QWidget
)
from PyQt6.QtCore import QDate

import api
from theme import BRAND, CYAN, SURFACE, TEXT, TEXT_2, TEXT_MUTE, LINE, SURFACE_2


METODOS = [("efectivo","Efectivo"), ("yape","Yape"), ("plin","Plin"),
           ("tarjeta","Tarjeta"), ("transferencia","Transferencia")]


def money(v):
    try: v = float(v)
    except Exception: return "S/ 0.00"
    return "S/ " + f"{v:,.2f}"


class _InventarioWorker(QThread):
    ok = pyqtSignal(list); ko = pyqtSignal(str)
    def run(self):
        try: self.ok.emit(api.inventario())
        except Exception as e: self.ko.emit(str(e))


class NuevoDocumentoDialog(QDialog):
    def __init__(self, tipo: str, parent=None):
        super().__init__(parent)
        self.tipo = tipo
        self.inventario = []
        self.items = []  # cada uno: {'inventory_id'|None, 'descripcion', 'cantidad', 'precio_unit', 'es_externo'}
        self.cfg = api.load_config()
        self._build_ui()
        self._cargar_inventario()

    @property
    def titulo(self):
        return {"boleta":"Nueva boleta",
                "proforma":"Nueva proforma / cotización",
                "nota_venta":"Nueva nota de venta (uso interno)"}[self.tipo]

    @property
    def aplica_igv(self):
        return self.tipo in ("boleta", "proforma")

    def _build_ui(self):
        self.setWindowTitle(self.titulo)
        self.resize(900, 720)
        self.setMinimumSize(820, 640)

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 18, 20, 18)
        root.setSpacing(14)

        # Encabezado
        t = QLabel(self.titulo); t.setObjectName("title")
        s = QLabel({"boleta":"Genera la boleta y descuenta stock del inventario",
                    "proforma":"Cotización con validez. No descuenta stock.",
                    "nota_venta":"Documento interno sin IGV. No descuenta stock."}[self.tipo])
        s.setObjectName("subtitle")
        root.addWidget(t); root.addWidget(s)

        # ----- Cliente + opciones -----
        cli_card = QFrame(); cli_card.setObjectName("card")
        clay = QGridLayout(cli_card)
        clay.setContentsMargins(16, 14, 16, 14)
        clay.setHorizontalSpacing(12); clay.setVerticalSpacing(10)

        clay.addWidget(QLabel("Cliente *"), 0, 0)
        self.f_cli = QLineEdit(); self.f_cli.setPlaceholderText("Nombre o razón social")
        clay.addWidget(self.f_cli, 0, 1)

        clay.addWidget(QLabel("DNI / RUC"), 0, 2)
        self.f_dni = QLineEdit()
        clay.addWidget(self.f_dni, 0, 3)

        clay.addWidget(QLabel("Teléfono"), 1, 0)
        self.f_tel = QLineEdit()
        clay.addWidget(self.f_tel, 1, 1)

        clay.addWidget(QLabel("Método de pago"), 1, 2)
        self.f_met = QComboBox()
        for v, n in METODOS: self.f_met.addItem(n, v)
        clay.addWidget(self.f_met, 1, 3)

        # Validez (solo proforma)
        if self.tipo == "proforma":
            clay.addWidget(QLabel("Válida hasta"), 2, 0)
            self.f_validez = QDateEdit()
            dias = self.cfg.get("pdf", {}).get("validez_proforma_dias", 7)
            self.f_validez.setDate(QDate.currentDate().addDays(dias))
            self.f_validez.setCalendarPopup(True)
            self.f_validez.setDisplayFormat("dd/MM/yyyy")
            clay.addWidget(self.f_validez, 2, 1)
        else:
            self.f_validez = None

        root.addWidget(cli_card)

        # ----- Items -----
        items_card = QFrame(); items_card.setObjectName("card")
        ilay = QVBoxLayout(items_card)
        ilay.setContentsMargins(16, 14, 16, 14)
        ilay.setSpacing(10)

        items_head = QHBoxLayout()
        items_title = QLabel("Productos"); items_title.setStyleSheet("font-size:15px;font-weight:700;")
        items_head.addWidget(items_title); items_head.addStretch(1)

        # Selector de producto del inventario
        self.combo_inv = QComboBox(); self.combo_inv.setMinimumWidth(360)
        self.combo_inv.addItem("— Selecciona del inventario —", None)
        items_head.addWidget(self.combo_inv)

        btn_add_inv = QPushButton("+ Agregar"); btn_add_inv.setObjectName("primary")
        btn_add_inv.clicked.connect(self._add_inventario_item)
        items_head.addWidget(btn_add_inv)

        btn_add_ext = QPushButton("+ Item externo"); btn_add_ext.setObjectName("ghost")
        btn_add_ext.setToolTip("Producto que no está en el inventario (de otro distribuidor).\n"
                               "No aparece marcado como externo en el PDF del cliente.")
        btn_add_ext.clicked.connect(self._add_externo_item)
        items_head.addWidget(btn_add_ext)
        ilay.addLayout(items_head)

        # Tabla de items
        self.tbl = QTableWidget(0, 7)
        self.tbl.setHorizontalHeaderLabels(["Producto", "Origen", "Cant.", "P.Unit", "Subtotal", "", ""])
        self.tbl.verticalHeader().setVisible(False)
        self.tbl.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        ilay.addWidget(self.tbl)
        root.addWidget(items_card, 1)

        # ----- Totales -----
        tot_card = QFrame(); tot_card.setObjectName("card")
        tlay = QGridLayout(tot_card)
        tlay.setContentsMargins(16, 12, 16, 12)
        tlay.setHorizontalSpacing(12)
        tlay.addWidget(QLabel("Notas (opcional)"), 0, 0)
        self.f_notas = QLineEdit()
        tlay.addWidget(self.f_notas, 0, 1, 1, 3)

        tlay.addWidget(self._lbl_dim("Subtotal"), 1, 2)
        self.lbl_sub = QLabel(money(0)); self.lbl_sub.setAlignment(Qt.AlignmentFlag.AlignRight)
        tlay.addWidget(self.lbl_sub, 1, 3)

        if self.aplica_igv:
            tlay.addWidget(self._lbl_dim("IGV (18%)"), 2, 2)
            self.lbl_igv = QLabel(money(0)); self.lbl_igv.setAlignment(Qt.AlignmentFlag.AlignRight)
            tlay.addWidget(self.lbl_igv, 2, 3)
        else:
            self.lbl_igv = None

        lbl_total = QLabel("TOTAL"); lbl_total.setStyleSheet(f"font-weight:700; color:{BRAND}; font-size:14px;")
        tlay.addWidget(lbl_total, 3, 2)
        self.lbl_total = QLabel(money(0))
        self.lbl_total.setStyleSheet(f"font-weight:800; font-size:18px; color:{BRAND};")
        self.lbl_total.setAlignment(Qt.AlignmentFlag.AlignRight)
        tlay.addWidget(self.lbl_total, 3, 3)
        root.addWidget(tot_card)

        # ----- Acciones -----
        actions = QHBoxLayout()
        self.chk_pdf = QLabel("Se generará y abrirá el PDF al guardar")
        self.chk_pdf.setObjectName("muted")
        actions.addWidget(self.chk_pdf); actions.addStretch(1)
        btn_cancel = QPushButton("Cancelar"); btn_cancel.setObjectName("ghost")
        btn_cancel.clicked.connect(self.reject)
        actions.addWidget(btn_cancel)
        btn_ok = QPushButton({"boleta":"Generar boleta","proforma":"Generar proforma",
                              "nota_venta":"Generar nota"}[self.tipo])
        btn_ok.setObjectName("primary")
        btn_ok.clicked.connect(self._guardar)
        actions.addWidget(btn_ok)
        root.addLayout(actions)

    def _lbl_dim(self, t):
        l = QLabel(t); l.setStyleSheet(f"color:{TEXT_2}; font-size:13px;"); l.setAlignment(Qt.AlignmentFlag.AlignRight)
        return l

    # ---------- Inventario ----------
    def _cargar_inventario(self):
        self._w = _InventarioWorker()
        self._w.ok.connect(self._on_inv); self._w.ko.connect(self._on_inv_err)
        self._w.start()

    def _on_inv(self, rows):
        self.inventario = rows
        for p in rows:
            etiqueta = f"{p['nombre']}  —  {money(p['precio_venta'])}  (stock: {p['stock']})"
            self.combo_inv.addItem(etiqueta, p)

    def _on_inv_err(self, msg):
        QMessageBox.warning(self, "Inventario", "No se pudo cargar el inventario: " + msg)

    # ---------- Items ----------
    def _add_inventario_item(self):
        data = self.combo_inv.currentData()
        if not data:
            QMessageBox.information(self, "Producto", "Selecciona un producto del inventario.")
            return
        self.items.append({
            "inventory_id": data["id"],
            "descripcion": data["nombre"],
            "cantidad": 1,
            "precio_unit": float(data["precio_venta"]),
            "es_externo": 0,
            "stock_max": int(data["stock"]),
        })
        self.combo_inv.setCurrentIndex(0)
        self._refrescar()

    def _add_externo_item(self):
        # Diálogo rápido
        from PyQt6.QtWidgets import QInputDialog
        nombre, ok = QInputDialog.getText(self, "Item externo",
            "Producto (no del inventario, traído de otro distribuidor):")
        if not ok or not nombre.strip(): return
        precio, ok = QInputDialog.getDouble(self, "Precio venta",
            "Precio unitario (S/):", 100.0, 0.0, 999999.0, 2)
        if not ok or precio <= 0: return
        self.items.append({
            "inventory_id": None,
            "descripcion": nombre.strip(),
            "cantidad": 1,
            "precio_unit": float(precio),
            "es_externo": 1,
            "stock_max": None,
        })
        self._refrescar()

    def _refrescar(self):
        self.tbl.setRowCount(len(self.items))
        for i, it in enumerate(self.items):
            # Columna 0: descripción (no editable)
            self.tbl.setItem(i, 0, QTableWidgetItem(it["descripcion"]))

            # Columna 1: origen (badge interno; en PDF no se muestra)
            origen = QLabel("⚠ externo" if it["es_externo"] else "inventario")
            origen.setProperty("pill", "warn" if it["es_externo"] else "brand")
            origen.style().unpolish(origen); origen.style().polish(origen)
            wrap = QWidget(); wl = QHBoxLayout(wrap); wl.setContentsMargins(4,2,4,2)
            wl.addWidget(origen); wl.addStretch(1)
            self.tbl.setCellWidget(i, 1, wrap)

            # Columna 2: cantidad (editable)
            sp = QSpinBox()
            sp.setRange(1, it.get("stock_max") or 99999)
            sp.setValue(it["cantidad"])
            sp.valueChanged.connect(lambda v, idx=i: self._set_cantidad(idx, v))
            self.tbl.setCellWidget(i, 2, sp)

            # Columna 3: precio (editable)
            ps = QDoubleSpinBox()
            ps.setRange(0.01, 999999.0); ps.setDecimals(2)
            ps.setValue(it["precio_unit"])
            ps.valueChanged.connect(lambda v, idx=i: self._set_precio(idx, v))
            self.tbl.setCellWidget(i, 3, ps)

            # Columna 4: subtotal
            ti = QTableWidgetItem(money(it["cantidad"] * it["precio_unit"]))
            ti.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.tbl.setItem(i, 4, ti)

            # Columna 5: borrar
            btn = QPushButton("×"); btn.setObjectName("ghost"); btn.setFixedWidth(34)
            btn.clicked.connect(lambda _, idx=i: self._eliminar(idx))
            self.tbl.setCellWidget(i, 5, btn)

        self.tbl.resizeColumnsToContents()
        self.tbl.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self._recalcular_totales()

    def _set_cantidad(self, idx, v):
        self.items[idx]["cantidad"] = v
        self._actualizar_subtotal(idx)

    def _set_precio(self, idx, v):
        self.items[idx]["precio_unit"] = float(v)
        self._actualizar_subtotal(idx)

    def _actualizar_subtotal(self, idx):
        it = self.items[idx]
        ti = QTableWidgetItem(money(it["cantidad"] * it["precio_unit"]))
        ti.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self.tbl.setItem(idx, 4, ti)
        self._recalcular_totales()

    def _eliminar(self, idx):
        del self.items[idx]
        self._refrescar()

    def _recalcular_totales(self):
        sub = sum(it["cantidad"] * it["precio_unit"] for it in self.items)
        self.lbl_sub.setText(money(sub))
        if self.aplica_igv:
            igv = sub * 0.18
            total = sub + igv
            self.lbl_igv.setText(money(igv))
        else:
            total = sub
        self.lbl_total.setText(money(total))

    # ---------- Guardar ----------
    def _guardar(self):
        cliente = self.f_cli.text().strip()
        if not cliente:
            QMessageBox.warning(self, "Falta dato", "Ingresa el nombre del cliente.")
            return
        if not self.items:
            QMessageBox.warning(self, "Sin productos", "Agrega al menos un producto.")
            return

        payload = {
            "tipo": self.tipo,
            "cliente_nombre": cliente,
            "cliente_dni": self.f_dni.text().strip() or None,
            "cliente_tel": self.f_tel.text().strip() or None,
            "metodo_pago": self.f_met.currentData(),
            "notas": self.f_notas.text().strip() or None,
            "items": [{
                "inventory_id": it["inventory_id"],
                "descripcion": it["descripcion"],
                "cantidad": it["cantidad"],
                "precio_unit": it["precio_unit"],
                "es_externo": it["es_externo"],
            } for it in self.items],
        }
        if self.f_validez:
            payload["valido_hasta"] = self.f_validez.date().toString("yyyy-MM-dd")

        try:
            resp = api.crear_documento(payload)
        except Exception as e:
            QMessageBox.critical(self, "Error al guardar", str(e))
            return

        # Generar PDF y abrir
        try:
            doc = api.documento_detalle(resp["id"])
            from pdf_generator import generar_pdf
            path = generar_pdf(doc)
            try:
                if os.name == "nt":
                    os.startfile(path)  # type: ignore[attr-defined]
                else:
                    subprocess.run(["xdg-open", path])
            except Exception:
                pass
            QMessageBox.information(self, "Listo", f"{self.titulo} #{resp['numero']} generada.\nPDF guardado en:\n{path}")
        except Exception as e:
            QMessageBox.warning(self, "PDF", "Documento creado, pero el PDF falló: " + str(e))

        self.accept()

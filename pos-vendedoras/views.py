"""Vistas principales del POS: Dashboard + lista de Documentos (boleta/proforma/nota)."""
import os
import subprocess
from pathlib import Path
from datetime import datetime
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont, QColor
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QLabel, QFrame, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QLineEdit, QMessageBox,
    QAbstractItemView, QSizePolicy, QComboBox, QFileDialog
)

import api
from theme import (BRAND, CYAN, TEXT, TEXT_2, TEXT_MUTE, SUCCESS, WARNING, DANGER,
                   SURFACE, SURFACE_2, LINE)


def money(v) -> str:
    try: v = float(v)
    except Exception: return "S/ 0.00"
    return "S/ " + f"{v:,.2f}"


def fmt_fecha(s: str) -> str:
    if not s: return ""
    try:
        dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return s


# ============================================================
# Worker genérico
# ============================================================
class ApiWorker(QThread):
    done = pyqtSignal(object)
    failed = pyqtSignal(str)

    def __init__(self, fn, *args, **kwargs):
        super().__init__()
        self.fn = fn; self.args = args; self.kwargs = kwargs

    def run(self):
        try: self.done.emit(self.fn(*self.args, **self.kwargs))
        except Exception as e: self.failed.emit(str(e))


# ============================================================
# Dashboard
# ============================================================
class DashboardView(QWidget):
    def __init__(self):
        super().__init__()
        self.worker = None
        self._build_ui()

    def _build_ui(self):
        v = QVBoxLayout(self)
        v.setContentsMargins(24, 18, 24, 24)
        v.setSpacing(16)

        title = QLabel("Tu actividad")
        title.setObjectName("title")
        sub = QLabel("Resumen de ventas, proformas y notas registradas por ti")
        sub.setObjectName("subtitle")
        v.addWidget(title); v.addWidget(sub)

        # KPIs
        self.kpi_grid = QGridLayout()
        self.kpi_grid.setHorizontalSpacing(14)
        self.kpi_grid.setVerticalSpacing(14)
        v.addLayout(self.kpi_grid)

        # Card "Últimos documentos"
        recent_card = QFrame()
        recent_card.setObjectName("card")
        rv = QVBoxLayout(recent_card)
        rv.setContentsMargins(18, 16, 18, 16)
        h = QLabel("Tus últimos documentos")
        h.setStyleSheet("font-size: 15px; font-weight: 700;")
        rv.addWidget(h)
        self.recent_tbl = QTableWidget(0, 5)
        self.recent_tbl.setHorizontalHeaderLabels(["Número", "Tipo", "Fecha", "Cliente", "Total"])
        self.recent_tbl.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.recent_tbl.verticalHeader().setVisible(False)
        self.recent_tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        rv.addWidget(self.recent_tbl)
        v.addWidget(recent_card, 1)

    def reload(self):
        self._kpis_loading()
        # Carga resumen
        if self.worker and self.worker.isRunning(): return
        self.worker = ApiWorker(self._fetch_all)
        self.worker.done.connect(self._on_data)
        self.worker.failed.connect(self._on_err)
        self.worker.start()

    def _fetch_all(self):
        resumen = api.mis_ventas_resumen()
        ultimos = api.listar_documentos()[:10]
        return {"resumen": resumen, "ultimos": ultimos}

    def _kpis_loading(self):
        # Limpiar
        while self.kpi_grid.count():
            it = self.kpi_grid.takeAt(0)
            w = it.widget()
            if w: w.deleteLater()
        # Placeholder
        for i in range(3):
            c = self._kpi_card("Cargando…", "—", "", BRAND)
            self.kpi_grid.addWidget(c, 0, i)

    def _on_data(self, data):
        # Limpiar KPIs
        while self.kpi_grid.count():
            it = self.kpi_grid.takeAt(0)
            w = it.widget()
            if w: w.deleteLater()

        r = data["resumen"]
        self.kpi_grid.addWidget(self._kpi_card("Mis ventas (mes)", money(r["mes"]["monto"]),
                                               f"{r['mes']['ventas']} ventas", BRAND), 0, 0)
        self.kpi_grid.addWidget(self._kpi_card("Mis ventas (histórico)", money(r["total"]["monto"]),
                                               f"{r['total']['ventas']} ventas", CYAN), 0, 1)
        # Conteo simple del último día
        hoy = datetime.now().strftime("%Y-%m-%d")
        ventas_hoy = next((d for d in r["porDia"] if d["dia"] == hoy), {"ventas":0,"monto":0})
        self.kpi_grid.addWidget(self._kpi_card("Hoy", money(ventas_hoy["monto"]),
                                               f"{ventas_hoy['ventas']} ventas", SUCCESS), 0, 2)

        # Tabla recientes
        rows = data["ultimos"]
        self.recent_tbl.setRowCount(len(rows))
        for i, r in enumerate(rows):
            self.recent_tbl.setItem(i, 0, QTableWidgetItem(r.get("boleta_numero","")))
            self.recent_tbl.setItem(i, 1, QTableWidgetItem(tipo_label(r.get("tipo","boleta"))))
            self.recent_tbl.setItem(i, 2, QTableWidgetItem(fmt_fecha(r.get("fecha",""))))
            self.recent_tbl.setItem(i, 3, QTableWidgetItem(r.get("cliente_nombre","")))
            ti = QTableWidgetItem(money(r.get("total",0)))
            ti.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.recent_tbl.setItem(i, 4, ti)
        self.recent_tbl.resizeColumnsToContents()
        self.recent_tbl.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)

    def _on_err(self, msg):
        QMessageBox.warning(self, "Error", "No se pudo cargar el resumen: " + msg)

    def _kpi_card(self, titulo, valor, sub, color):
        f = QFrame(); f.setObjectName("kpi_card")
        l = QVBoxLayout(f); l.setSpacing(2)
        t = QLabel(titulo); t.setObjectName("kpi_title")
        v = QLabel(valor);  v.setObjectName("kpi_value")
        s = QLabel(sub);    s.setStyleSheet(f"color: {TEXT_MUTE}; font-size: 11px;")
        # Barra de acento
        accent = QFrame(); accent.setFixedHeight(3)
        accent.setStyleSheet(f"background: {color}; border-radius: 2px;")
        l.addWidget(accent); l.addSpacing(6)
        l.addWidget(t); l.addWidget(v); l.addWidget(s)
        return f


def tipo_label(t: str) -> str:
    return {"boleta":"Boleta", "proforma":"Proforma", "nota_venta":"Nota interna"}.get(t, t)


# ============================================================
# Vista de Documentos (filtra por tipo: boleta/proforma/nota_venta)
# ============================================================
class DocumentosView(QWidget):
    def __init__(self, tipo: str):
        super().__init__()
        self.tipo = tipo
        self.rows = []
        self.worker = None
        self._build_ui()

    @property
    def tipo_label(self):
        return {"boleta":"boleta", "proforma":"proforma", "nota_venta":"nota de venta"}[self.tipo]

    def _build_ui(self):
        v = QVBoxLayout(self)
        v.setContentsMargins(24, 18, 24, 24)
        v.setSpacing(14)

        # Cabecera con filtros
        top = QHBoxLayout()
        title = QLabel({"boleta":"Boletas registradas",
                        "proforma":"Proformas / Cotizaciones",
                        "nota_venta":"Notas de venta (uso interno)"}[self.tipo])
        title.setObjectName("title")
        top.addWidget(title)
        top.addStretch(1)

        self.busq = QLineEdit()
        self.busq.setPlaceholderText("Buscar por cliente o número…")
        self.busq.setFixedWidth(260)
        self.busq.textChanged.connect(self._aplicar_filtro)
        top.addWidget(self.busq)

        btn_new = QPushButton(f"+ Nueva {self.tipo_label}")
        btn_new.setObjectName("primary")
        btn_new.clicked.connect(self._nueva)
        top.addWidget(btn_new)
        v.addLayout(top)

        # Tabla
        self.tbl = QTableWidget(0, 7)
        self.tbl.setHorizontalHeaderLabels(["Número", "Fecha", "Cliente", "Método", "Total", "Estado", "Acciones"])
        self.tbl.verticalHeader().setVisible(False)
        self.tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.setAlternatingRowColors(True)
        v.addWidget(self.tbl, 1)

    def reload(self):
        if self.worker and self.worker.isRunning(): return
        self.tbl.setRowCount(0)
        self.worker = ApiWorker(api.listar_documentos, tipo=self.tipo)
        self.worker.done.connect(self._on_data)
        self.worker.failed.connect(self._on_err)
        self.worker.start()

    def _on_data(self, rows):
        self.rows = rows
        self._aplicar_filtro()

    def _on_err(self, msg):
        QMessageBox.warning(self, "Error", "No se pudo cargar: " + msg)

    def _aplicar_filtro(self):
        q = self.busq.text().strip().lower()
        rows = [r for r in self.rows if (not q
                or q in (r.get("cliente_nombre") or "").lower()
                or q in (r.get("boleta_numero") or "").lower())]
        self.tbl.setRowCount(len(rows))
        for i, r in enumerate(rows):
            self.tbl.setItem(i, 0, QTableWidgetItem(r.get("boleta_numero","")))
            self.tbl.setItem(i, 1, QTableWidgetItem(fmt_fecha(r.get("fecha",""))))
            self.tbl.setItem(i, 2, QTableWidgetItem(r.get("cliente_nombre","")))
            self.tbl.setItem(i, 3, QTableWidgetItem(r.get("metodo_pago","")))
            ti = QTableWidgetItem(money(r.get("total",0)))
            ti.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.tbl.setItem(i, 4, ti)

            est = r.get("estado","")
            est_lbl = QLabel(est)
            est_lbl.setProperty("pill", "danger" if est == "anulada" else "success")
            est_lbl.style().unpolish(est_lbl); est_lbl.style().polish(est_lbl)
            self.tbl.setCellWidget(i, 5, est_lbl)

            wrap = QWidget(); h = QHBoxLayout(wrap); h.setContentsMargins(4,2,4,2); h.setSpacing(6)
            btn_ver = QPushButton("Ver / PDF"); btn_ver.setObjectName("ghost")
            btn_ver.clicked.connect(lambda _, sid=r["id"]: self._ver(sid))
            h.addWidget(btn_ver); h.addStretch(1)
            self.tbl.setCellWidget(i, 6, wrap)

        self.tbl.resizeColumnsToContents()
        self.tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)

    def _nueva(self):
        from nuevo_documento import NuevoDocumentoDialog
        dlg = NuevoDocumentoDialog(self.tipo, self)
        if dlg.exec():
            self.reload()

    def _ver(self, sid):
        try:
            doc = api.documento_detalle(sid)
        except Exception as e:
            QMessageBox.warning(self, "Error", str(e)); return
        from pdf_generator import generar_pdf
        from PyQt6.QtWidgets import QInputDialog
        try:
            path = generar_pdf(doc)
        except Exception as e:
            QMessageBox.warning(self, "Error generando PDF", str(e)); return
        # Abrir con visor predeterminado del sistema
        try:
            if os.name == "nt":
                os.startfile(path)  # type: ignore[attr-defined]
            else:
                subprocess.run(["xdg-open", path])
        except Exception:
            pass
        QMessageBox.information(self, "PDF generado", f"Guardado en:\n{path}")

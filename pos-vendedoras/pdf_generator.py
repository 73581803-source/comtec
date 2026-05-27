"""Generador de PDFs para boletas, proformas y notas de venta.
Usa fpdf2 (pure Python, sin dependencias nativas).

IMPORTANTE: los ítems marcados con es_externo=1 se renderizan exactamente
igual que los del inventario. El cliente no debe notar diferencia.
"""
from pathlib import Path
from datetime import datetime, timedelta
from fpdf import FPDF

import api


# ---------- Helpers ----------
def _money(v):
    try: v = float(v)
    except Exception: v = 0.0
    return f"S/ {v:,.2f}"


def _safe(text):
    """Reemplaza caracteres fuera del latin-1 para no romper PDF estándar."""
    if text is None: return ""
    return str(text).encode("latin-1", "replace").decode("latin-1")


def _fmt_fecha(s):
    if not s: return ""
    try: return datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S").strftime("%d/%m/%Y %H:%M")
    except Exception: return s[:16]


def _out_path(prefix: str, numero: str) -> Path:
    cfg = api.load_config()
    base = cfg.get("pdf", {}).get("carpeta_salida") or str(Path.home() / "Documents" / "ComTec PDF")
    folder = Path(base); folder.mkdir(parents=True, exist_ok=True)
    fn = f"{prefix}-{numero}-{datetime.now():%Y%m%d_%H%M%S}.pdf"
    return folder / fn


# ---------- Plantilla base ----------
class ComtecPDF(FPDF):
    BRAND_RGB = (30, 50, 156)     # #1e329c
    CYAN_RGB  = (0, 141, 222)     # #008dde
    LINE_RGB  = (227, 231, 241)
    TEXT_RGB  = (15, 23, 42)
    TEXT2_RGB = (71, 85, 105)

    def __init__(self, titulo_doc: str, empresa: dict, accent="brand"):
        super().__init__("P", "mm", "A4")
        self.titulo_doc = titulo_doc
        self.empresa = empresa
        self.accent_rgb = self.BRAND_RGB if accent == "brand" else self.CYAN_RGB
        self.set_auto_page_break(True, margin=20)
        self.set_margins(15, 12, 15)
        self.set_title(titulo_doc)

    def header(self):
        # Logo
        logo = Path(__file__).parent / "assets" / "logo.jpeg"
        if logo.exists():
            try: self.image(str(logo), x=15, y=10, w=22)
            except Exception: pass

        # Nombre de empresa
        self.set_xy(40, 10)
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*self.BRAND_RGB)
        self.cell(0, 7, _safe(self.empresa.get("nombre", "ComTec")), ln=1)

        self.set_xy(40, 17)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*self.TEXT2_RGB)
        self.cell(0, 4, _safe(self.empresa.get("lema", "")), ln=1)

        self.set_x(40)
        self.set_font("Helvetica", "", 8)
        info = f"RUC: {self.empresa.get('ruc','')}    •    {self.empresa.get('direccion','')}    •    Tel: {self.empresa.get('telefono','')}"
        self.cell(0, 4, _safe(info), ln=1)

        # Caja con tipo de doc + número (a la derecha)
        self.set_xy(140, 10)
        self.set_fill_color(*self.accent_rgb)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 9)
        self.cell(55, 7, _safe(self.titulo_doc.upper()), ln=2, align="C", fill=True)
        self.set_text_color(*self.TEXT_RGB)
        # El número se setea al renderizar el cuerpo
        self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        web = self.empresa.get("web", "")
        em = self.empresa.get("email", "")
        self.cell(0, 5, _safe(f"{web}    •    {em}"), align="C")
        self.set_y(-10)
        self.cell(0, 4, f"Página {self.page_no()}", align="C")

    # ---------- Cuerpo común ----------
    def render_doc(self, doc: dict, mostrar_igv=True, leyenda="", valido_hasta=None):
        # Caja del número (debajo del header)
        self.set_xy(140, 19)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*self.BRAND_RGB)
        self.cell(55, 7, _safe(doc.get("boleta_numero","")), align="C")

        # Fecha + validez
        self.set_xy(140, 27)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*self.TEXT2_RGB)
        self.cell(55, 4, _safe(f"Fecha: {_fmt_fecha(doc.get('fecha',''))}"), align="C", ln=1)
        if valido_hasta:
            self.set_x(140)
            self.set_text_color(*self.CYAN_RGB)
            self.cell(55, 4, _safe(f"Válida hasta: {valido_hasta}"), align="C", ln=1)

        # Datos cliente
        self.set_xy(15, 38)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*self.TEXT_RGB)
        self.cell(0, 5, "Cliente", ln=1)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*self.TEXT2_RGB)
        cliente_line = doc.get("cliente_nombre", "")
        if doc.get("cliente_dni"): cliente_line += f"    •    DNI/RUC: {doc['cliente_dni']}"
        if doc.get("cliente_tel"): cliente_line += f"    •    Tel: {doc['cliente_tel']}"
        self.cell(0, 5, _safe(cliente_line), ln=1)
        self.cell(0, 5, _safe(f"Atendido por: {doc.get('vendedor_nombre','')}    •    Método: {doc.get('metodo_pago','').title()}"), ln=1)

        self.ln(4)
        self._render_tabla(doc.get("items", []))
        self._render_totales(doc, mostrar_igv)

        if doc.get("notas"):
            self.ln(3)
            self.set_font("Helvetica", "I", 9)
            self.set_text_color(*self.TEXT2_RGB)
            self.multi_cell(0, 4.5, _safe(f"Notas: {doc['notas']}"))

        if leyenda:
            self.ln(8)
            self.set_draw_color(*self.LINE_RGB)
            self.line(15, self.get_y(), 195, self.get_y())
            self.ln(3)
            self.set_font("Helvetica", "I", 8.5)
            self.set_text_color(*self.TEXT2_RGB)
            self.multi_cell(0, 4, _safe(leyenda))

    def _render_tabla(self, items):
        # Cabecera de tabla
        self.set_fill_color(248, 250, 252)
        self.set_text_color(*self.TEXT2_RGB)
        self.set_font("Helvetica", "B", 9)
        self.set_draw_color(*self.LINE_RGB)
        h = 7
        # Anchos
        w_desc, w_cant, w_pu, w_sub = 110, 18, 26, 26
        self.cell(w_desc, h, "PRODUCTO / SERVICIO", border="B", fill=True)
        self.cell(w_cant, h, "CANT.", border="B", fill=True, align="C")
        self.cell(w_pu,   h, "P. UNIT.",   border="B", fill=True, align="R")
        self.cell(w_sub,  h, "SUBTOTAL", border="B", fill=True, align="R", ln=1)

        # Filas
        self.set_text_color(*self.TEXT_RGB)
        self.set_font("Helvetica", "", 9.5)
        for it in items:
            # NO se hace distinción visual entre inventario y externo — invisible al cliente
            desc = _safe(it.get("descripcion",""))
            cant = it.get("cantidad", 1)
            pu = float(it.get("precio_unit", 0))
            sub = float(it.get("subtotal", cant * pu))
            # multi_cell para descripciones largas
            y0 = self.get_y()
            x0 = self.get_x()
            self.multi_cell(w_desc, 5.5, desc, border=0)
            y1 = self.get_y()
            alto = y1 - y0
            self.set_xy(x0 + w_desc, y0)
            self.cell(w_cant, alto, str(cant), align="C")
            self.cell(w_pu,   alto, _money(pu), align="R")
            self.cell(w_sub,  alto, _money(sub), align="R", ln=1)
            # Línea sutil entre filas
            self.set_draw_color(*self.LINE_RGB)
            self.line(15, self.get_y(), 195, self.get_y())

    def _render_totales(self, doc, mostrar_igv):
        self.ln(3)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*self.TEXT2_RGB)
        # Reservamos lado derecho
        label_x = 130; val_x = 165
        # Subtotal
        self.set_xy(label_x, self.get_y())
        self.cell(35, 6, "Subtotal:", align="R")
        self.cell(30, 6, _money(doc.get("subtotal", 0)), align="R", ln=1)
        if mostrar_igv:
            self.set_x(label_x)
            self.cell(35, 6, "IGV (18%):", align="R")
            self.cell(30, 6, _money(doc.get("igv", 0)), align="R", ln=1)
        # Total
        self.set_x(label_x)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*self.BRAND_RGB)
        self.cell(35, 8, "TOTAL:", align="R")
        self.cell(30, 8, _money(doc.get("total", 0)), align="R", ln=1)


# ---------- Punto de entrada ----------
def generar_pdf(doc: dict) -> str:
    """Recibe el doc completo de /api/sales/:id y devuelve la ruta absoluta del PDF."""
    cfg = api.load_config()
    empresa = cfg.get("empresa", {})
    tipo = doc.get("tipo", "boleta")

    if tipo == "boleta":
        pdf = ComtecPDF("Boleta de venta", empresa, accent="brand")
        pdf.add_page()
        pdf.render_doc(doc, mostrar_igv=True,
                       leyenda="Gracias por su compra. Conserve este comprobante. "
                               "Cambios y devoluciones según política de la tienda.")
        path = _out_path("BOLETA", doc.get("boleta_numero","SN"))
    elif tipo == "proforma":
        pdf = ComtecPDF("Proforma / Cotización", empresa, accent="cyan")
        pdf.add_page()
        validez = doc.get("valido_hasta")
        validez_fmt = ""
        if validez:
            try: validez_fmt = datetime.strptime(validez, "%Y-%m-%d").strftime("%d/%m/%Y")
            except Exception: validez_fmt = validez
        pdf.render_doc(doc, mostrar_igv=True, valido_hasta=validez_fmt,
                       leyenda="Este documento es una cotización y NO constituye comprobante de pago. "
                               "Los precios y disponibilidad están sujetos a confirmación dentro del período de validez.")
        path = _out_path("PROFORMA", doc.get("boleta_numero","SN"))
    else:  # nota_venta
        pdf = ComtecPDF("Nota de venta (interno)", empresa, accent="brand")
        pdf.add_page()
        pdf.render_doc(doc, mostrar_igv=False,
                       leyenda="USO INTERNO. Este documento no es un comprobante de pago oficial.")
        path = _out_path("NOTA", doc.get("boleta_numero","SN"))

    pdf.output(str(path))
    return str(path)

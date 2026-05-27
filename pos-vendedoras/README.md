# ComTec POS — Programa para vendedoras

App de escritorio (Windows / Linux) en **Python + PyQt6** para que vendedoras
y administradoras de ComTec registren boletas, proformas y notas de venta,
con generación de **PDF al instante**.

Se conecta a la misma API que el dashboard web — todo lo que se registra aquí
aparece automáticamente en el panel del admin en internet.

## Características

- 🔑 Login con la misma cuenta del dashboard web
- 📊 Dashboard con tus ventas del mes
- 🧾 **3 tipos de documento:**
  - **Boleta** — con IGV 18%, descuenta stock
  - **Proforma / Cotización** — con período de validez, no descuenta stock
  - **Nota de venta** — uso interno, sin IGV
- 🛒 Selector de productos del inventario en vivo
- ➕ Agregar productos **externos** (de otro distribuidor) — invisibles al cliente en el PDF
- 📄 PDF generado al instante con la paleta del logo

## Requisitos

- **Python 3.10 o superior** ([descargar](https://www.python.org/downloads/))
- Conexión a internet (para sincronizar con el backend en Render)

## Primera instalación

```powershell
cd D:\ppp\comtec-html\pos-vendedoras

# Crear entorno virtual (recomendado)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt
```

## Ejecutar

```powershell
.\venv\Scripts\Activate.ps1   # si cerraste la terminal
python main.py
```

Login con cualquier cuenta de **admin** o **vendedor**:

| Rol       | Email              | Password    |
|-----------|--------------------|-------------|
| Admin     | admin@comtec.pe    | admin123    |
| Vendedora | maria@comtec.pe    | vendedor123 |
| Vendedora | luz@comtec.pe      | vendedor123 |

## Configuración

Edita `config.json` para cambiar:

- `api_url` — URL del backend (por defecto apunta a Render)
- `empresa` — datos que aparecen en el PDF (nombre, RUC, dirección, etc.)
- `pdf.validez_proforma_dias` — días de validez por defecto (default 7)
- `pdf.carpeta_salida` — dónde se guardan los PDFs. Vacío = `Documentos/ComTec PDF/`

## Generar .exe para instalar en otros PCs

```powershell
.\venv\Scripts\Activate.ps1
pip install pyinstaller
pyinstaller --onefile --windowed --name "ComTec POS" --icon=assets\logo.jpeg `
            --add-data "assets;assets" `
            --add-data "config.json;." `
            main.py
```

El `.exe` queda en `dist\ComTec POS.exe`. Es un único archivo de ~50 MB, se copia
a cualquier PC de Windows y se ejecuta sin necesitar Python instalado.

## Estructura

```
pos-vendedoras/
├── main.py               # Punto de entrada
├── api.py                # Cliente HTTP + sesión
├── theme.py              # Colores y stylesheet
├── login_window.py       # Pantalla de login
├── main_window.py        # Ventana principal + sidebar
├── views.py              # Dashboard + lista de documentos
├── nuevo_documento.py    # Diálogo para crear boleta/proforma/nota
├── pdf_generator.py      # Plantillas PDF (fpdf2)
├── config.json           # Configuración
├── requirements.txt      # Dependencias
└── assets/logo.jpeg
```

## Notas importantes

**Productos externos:** Cuando agregas un producto "externo" (clic en `+ Item externo`),
internamente queda marcado para que el admin pueda ver el margen en el dashboard web,
pero en el **PDF del cliente aparece exactamente igual** que un producto del inventario.
Sin etiquetas, sin pistas.

**Sincronización:** Todo se guarda en el servidor — si dos vendedoras venden el mismo producto
al mismo tiempo, el stock se descuenta correctamente porque el backend lo hace en transacción.

**Sin internet:** Por ahora la app requiere conexión. Si ves "ConnectionError", verifica tu
conexión o que el backend esté arriba (https://comtec-ds64.onrender.com/api/health debe responder).

import re
import unicodedata

from pypdf import PdfReader


_BULLET_PREFIX = re.compile(r'^(?:[•\-–—*]+|\d+[.)\-:])\s*')


def _normalize_line(value):
    text = unicodedata.normalize('NFKC', str(value or ''))
    text = text.replace('\r', '\n')
    return re.sub(r'\s+', ' ', text).strip()


def _clean_indicator_line(line):
    text = _normalize_line(line)
    if not text:
        return ''
    text = _BULLET_PREFIX.sub('', text).strip()
    text = re.sub(r'^[\(\[]?\d+[\)\]]\s*', '', text).strip()
    return re.sub(r'\s+', ' ', text).strip()


def extraer_indicadores_desde_pdf(uploaded_file):
    """Extrae indicadores desde un PDF de texto plano, sin duplicados y en orden."""

    if uploaded_file is None:
        return []

    if hasattr(uploaded_file, 'seek'):
        uploaded_file.seek(0)

    reader = PdfReader(uploaded_file)
    encontrados = []
    vistos = set()

    for page in reader.pages:
        page_text = page.extract_text() or ''
        if not page_text:
            continue

        for raw_line in page_text.splitlines():
            line = _clean_indicator_line(raw_line)
            if not line:
                continue

            lowered = line.lower()
            if lowered in {'indicador', 'indicadores'}:
                continue
            if re.fullmatch(r'p[aá]gina\s+\d+(?:\s+de\s+\d+)?', lowered):
                continue
            if re.fullmatch(r'page\s+\d+(?:\s+of\s+\d+)?', lowered):
                continue

            key = lowered.casefold()
            if key in vistos:
                continue

            vistos.add(key)
            encontrados.append(line)

    return encontrados
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch, cm
from django.conf import settings
import os
from django.apps import apps
from datetime import datetime
import io
from html import escape
from django.db.models import Sum
from fondos.models import CargaHoraria

class FondoPDFGenerator:
    def __init__(self, buffer):
        self.buffer = buffer
        self.styles = getSampleStyleSheet()
        self.width, self.height = landscape(LETTER)
        self.margin = 1.5 * cm

    def _get_estilo_titulo(self):
        return ParagraphStyle(
            'TituloInforme',
            parent=self.styles['Heading1'],
            fontSize=10,
            alignment=1, # Centrado
            spaceAfter=6,
            fontName='Helvetica-Bold'
        )

    def _get_estilo_normal(self):
        return ParagraphStyle(
            'TextoNormal',
            parent=self.styles['Normal'],
            fontSize=8,
            leading=10,
            alignment=4 # Justificado
        )
    
    def _get_estilo_celda(self):
        return ParagraphStyle(
            'TextoCelda',
            parent=self.styles['Normal'],
            fontSize=7, 
            leading=8,
            alignment=0 # Izquierda
        )

    def _get_estilo_celda_center(self):
        return ParagraphStyle(
            'TextoCeldaCenter',
            parent=self.styles['Normal'],
            fontSize=7, 
            leading=8,
            alignment=1 # Centrado
        )

    def _limpiar_texto(self, texto):
        if not texto or str(texto) == 'None':
            return "-"
        return str(texto).replace('\n', '<br/>')

    def generar_pdf(self, fondo, informe_data=None):
        # 1. Configuración de Página
        doc = SimpleDocTemplate(
            self.buffer,
            pagesize=landscape(LETTER),
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=self.margin,
            bottomMargin=self.margin
        )
        
        elementos = []

        # --- TÍTULO PRINCIPAL ---
        carrera_titulo = fondo.carrera.nombre.upper() if fondo.carrera else "INGENIERÍA DE SISTEMAS"
        titulo_texto = f"FONDO DE TIEMPO - CARRERA DE {carrera_titulo}"
        elementos.append(Paragraph(titulo_texto, self._get_estilo_titulo()))
        elementos.append(Spacer(1, 0.3*cm))

        estilo_normal = self._get_estilo_normal()
        estilo_celda_center = self._get_estilo_celda_center()
        estilo_celda = self._get_estilo_celda()

        # --- 2. CABECERA ---
        
        estilo_header_bold = ParagraphStyle('HeaderBold', parent=estilo_normal, fontName='Helvetica-Bold', fontSize=7, alignment=0, leading=8)
        estilo_docente_label = ParagraphStyle('DocenteLabel', parent=estilo_normal, fontName='Helvetica-Bold', fontSize=8, alignment=0, leading=9)
        estilo_docente_val_right = ParagraphStyle('DocenteValRight', parent=estilo_normal, fontName='Helvetica-Bold', fontSize=8, alignment=2, leading=9)
        estilo_docente_actividad = ParagraphStyle('DocenteActividad', parent=estilo_docente_label, leftIndent=1.5*cm)
        estilo_tabla_col3 = ParagraphStyle('TablaCol3', parent=estilo_normal, fontSize=6.5, alignment=1, leading=7.5)

        # Columna 1
        facultad_texto = fondo.carrera.facultad.title() if fondo.carrera else "Facultad de Ingeniería y Tecnología"
        carrera_texto = fondo.carrera.nombre.title() if fondo.carrera else "Carrera"
        col1_data = [
            [Paragraph("Universidad Autónoma del Beni<br/>José Ballivián", estilo_header_bold)],
            [Paragraph(facultad_texto, estilo_header_bold)],
            [Paragraph(f"Carrera de {carrera_texto}", estilo_header_bold)],
        ]
        col1_table = Table(col1_data, colWidths=[5.5*cm])
        col1_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))

        # Columna 2
        cat_docencia = fondo.categorias.filter(tipo='docente').first()
        rows_docente = []
        nombre_docente = fondo.docente.nombre_completo.title() if fondo.docente else "Docente"
        val_horas = float(fondo.horas_semana) if fondo.horas_semana is not None else 0
        horas_texto = f"Carga Horaria Total: {val_horas:g} Hrs/Sem" if val_horas > 0 else ""
        rows_docente.append([Paragraph(f"Docente: {nombre_docente}", estilo_docente_label), Paragraph(horas_texto, estilo_docente_val_right)])
        
        # Obtener asignaturas dinámicas de Jefatura (CargaHoraria)
        cargas_docencia = CargaHoraria.objects.filter(
            docente=fondo.docente, 
            calendario=fondo.calendario_academico, 
            categoria='docente'
        )
        
        if cargas_docencia.exists():
            asignaturas_list = []
            semanas_anio = float(fondo.semanas_año) if fondo.semanas_año else 1
            for carga in cargas_docencia:
                horas_sem = float(carga.horas) / semanas_anio
                asignaturas_list.append(f"{carga.titulo_actividad} ({horas_sem:.2f} Hrs/Sem)")
            asignatura_texto = "<br/>".join(asignaturas_list)
        else:
            asignatura_texto = fondo.asignatura if fondo.asignatura else "Sin asignaturas"
            
        # Tabla anidada para alineación (Label | Contenido)
        lbl_asig = Paragraph("Asignatura:", estilo_docente_label)
        val_asig = Paragraph(asignatura_texto, estilo_docente_label)
        t_asig = Table([[lbl_asig, val_asig]], colWidths=[1.8*cm, 7.8*cm])
        t_asig.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
        rows_docente.append([t_asig, ''])
        
        if cat_docencia:
            for act in cat_docencia.actividades.all().order_by('orden', 'id'):
                h_sem = float(act.horas_semana or 0)
                detalle = self._limpiar_texto(act.detalle)
                rows_docente.append([Paragraph(f"{detalle}", estilo_docente_actividad), Paragraph(f"{h_sem:g} Hrs/Sem", estilo_docente_val_right)])
        
        dedicacion_texto = fondo.docente.get_dedicacion_display() if fondo.docente else "-"
        rows_docente.append([Paragraph(f"Tiempo de dedicación: {dedicacion_texto}", estilo_docente_label), ''])
        
        col2_table = Table(rows_docente, colWidths=[5.5*cm, 4.5*cm])
        col2_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0.2*cm),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('SPAN', (0,1), (1,1)),
            ('SPAN', (0,-1), (1,-1)),
        ]))

        # Columna 3
        # Sincronización de Clases Aula (Total de horas anuales asignadas por Jefatura)
        total_clases_aula = CargaHoraria.objects.filter(
            docente=fondo.docente, 
            calendario=fondo.calendario_academico, 
            categoria='docente'
        ).aggregate(total=Sum('horas'))['total'] or 0
        total_clases_aula = float(total_clases_aula)

        horas_contrato = fondo.contrato_horas
        horas_vacacion = fondo.horas_vacacion
        horas_feriados = fondo.horas_feriados
        horas_efectivas = float(fondo.horas_efectivas)
        
        dias_vacacion = fondo.docente.calcular_dias_vacacion(fondo.gestion) if fondo.docente else 0
        semanas_clase = total_clases_aula / 40.0 if total_clases_aula > 0 else 0
        funciones_sustantivas = horas_efectivas - total_clases_aula

        def p_c3(txt, align=1, bold=False):
            font = 'Helvetica-Bold' if bold else 'Helvetica'
            return Paragraph(str(txt), ParagraphStyle('p3', parent=estilo_tabla_col3, alignment=align, fontName=font))

        col3_data = [
            ['', p_c3('Semanas/Año'), p_c3('Hrs/Año')],
            [p_c3('Contrato:', 2, True), p_c3('52'), p_c3(f'{horas_contrato}')],
            [p_c3('Clases Aula:', 2, True), p_c3(f'{semanas_clase:.2f}'), p_c3(f'{total_clases_aula:.2f}')],
            [p_c3('Funciones Sustantivas:', 2, True), '', p_c3(f'{funciones_sustantivas:.2f}')],
            [p_c3('Vacación(días):', 2, True), p_c3(f'{dias_vacacion}'), p_c3(f'{horas_vacacion}')],
            [p_c3('Feriados Nacionales y Locales:', 2, True), '', p_c3(f'{horas_feriados}')],
            [p_c3('<font backColor="#9CC2E5">Horas efectivas</font>', 2, True), '', p_c3(f'{horas_efectivas:.2f}', 1, True)]
        ]
        
        col3_table = Table(col3_data, colWidths=[4.2*cm, 2.0*cm, 2.0*cm])
        col3_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 1),
            ('RIGHTPADDING', (0,0), (-1,-1), 1),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BACKGROUND', (1, 1), (1, 1), colors.HexColor('#E6B8B7')),
            ('BACKGROUND', (1, 4), (1, 4), colors.HexColor('#C4D79B')),
        ]))

        tabla_cabecera = Table([[col1_table, col2_table, col3_table]], colWidths=[5.7*cm, 10.0*cm, 8.8*cm])
        tabla_cabecera.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (0,0), (0,-1), 'LEFT'),
            ('ALIGN', (1,0), (1,-1), 'CENTER'),
            ('ALIGN', (2,0), (2,-1), 'RIGHT'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        tabla_cabecera.hAlign = 'CENTER'
        elementos.append(tabla_cabecera)
        elementos.append(Spacer(1, 15))

        # --- 3. CUERPO: TABLA DE ACTIVIDADES ---
        
        headers_1 = ['N°', 'INDICADORES', '', 'Hrs/Sem', 'Hrs/Año', 'Total\nHrs/Año', '%', 'Evidencias']
        headers_2 = ['', 'ITEM', 'DETALLE', '', '', '', '', '']
        col_widths = [0.8*cm, 3.0*cm, 8.5*cm, 1.3*cm, 1.3*cm, 1.8*cm, 1.0*cm, 6.8*cm]
        
        datos_tabla = [headers_1, headers_2]
        
        total_global = 0
        categorias = fondo.categorias.all().order_by('id')
        
        # Sumar CargaHoraria al total global
        total_cargas = CargaHoraria.objects.filter(docente=fondo.docente, calendario=fondo.calendario_academico, categoria='docente').aggregate(total=Sum('horas'))['total'] or 0
        total_global += float(total_cargas)

        for cat in categorias:
            for act in cat.actividades.all():
                total_global += float(act.horas_año or 0)
        if total_global == 0: total_global = 1

        # ESTILOS INICIALES (SIN GRID EN EL CUERPO)
        estilos_tabla = [
            ('BOX', (0,0), (-1,-1), 0.5, colors.black), # Borde exterior
            ('INNERGRID', (0,0), (-1,1), 0.5, colors.black), # Headers internos (evita duplicar BOX)
            ('LINEBELOW', (0,1), (-1,1), 0.5, colors.black), # Línea inferior headers
            ('LINEAFTER', (0,0), (0,1), 0.5, colors.Color(0.9, 0.9, 0.9)), # Ocultar linea entre N e ITEM en header
            ('LINEAFTER', (1,2), (-2,-2), 0.5, colors.black), # Líneas verticales internas (desde col 1)
            ('BACKGROUND', (0,0), (-1,1), colors.Color(0.9, 0.9, 0.9)), 
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('ALIGN', (2,2), (2,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('FONTNAME', (0,0), (-1,1), 'Helvetica-Bold'),
            
            # SPANS HEADER
            ('SPAN', (0,0), (0,1)), ('SPAN', (1,0), (2,0)), 
            ('SPAN', (3,0), (3,1)), ('SPAN', (4,0), (4,1)), 
            ('SPAN', (5,0), (5,1)), ('SPAN', (6,0), (6,1)), 
            ('SPAN', (7,0), (7,1)),
        ]

        cat_index = 1
        row_cursor = 2
        
        for cat in categorias:
            actividades = cat.actividades.all().order_by('orden', 'id')
            
            cargas = []
            if cat.tipo == 'docente':
                cargas = CargaHoraria.objects.filter(docente=fondo.docente, calendario=fondo.calendario_academico, categoria='docente').order_by('id')
            
            n_filas = actividades.count() + len(cargas)
            
            total_cat = 0
            for c in cargas: total_cat += float(c.horas)
            for act in actividades:
                total_cat += float(act.horas_año or 0)
            
            porc_cat = (total_cat / total_global) * 100
            nombre_cat = cat.get_tipo_display().upper()
            
            if n_filas > 0:
                start_row = row_cursor
                end_row = row_cursor + n_filas - 1
                
                # Combinar Cargas y Actividades
                items_mix = []
                for c in cargas: items_mix.append(('carga', c))
                for a in actividades: items_mix.append(('actividad', a))
                
                for idx, (tipo_obj, obj) in enumerate(items_mix):
                    es_primera = (idx == 0)
                    es_ultima = (idx == n_filas - 1)
                    
                    if tipo_obj == 'carga':
                        detalle = self._limpiar_texto(obj.titulo_actividad)
                        anual = float(obj.horas)
                        semanas_anio = float(fondo.semanas_año) if fondo.semanas_año else 1
                        hs = anual / semanas_anio
                        semanas_calc = semanas_anio
                        evidencia_texto = obj.documento_respaldo if obj.documento_respaldo else "Asignación Jefatura"
                    else:
                        act = obj
                        hs = float(act.horas_semana or 0)
                        anual = float(act.horas_año or 0)
                        # CORRECCIÓN ERROR 500: Calcular semanas matemáticamente
                        semanas_calc = (anual / hs) if hs > 0 else 0
                        
                        detalle = self._limpiar_texto(act.detalle)
                        
                        raw_evidencia = str(act.evidencias).strip() if act.evidencias else ""
                        if raw_evidencia.startswith('http') or raw_evidencia.startswith('www'):
                            evidencia_texto = "Respaldo en sistema"
                        elif 'http' in raw_evidencia:
                            evidencia_texto = raw_evidencia.split('http')[0].strip()
                            if evidencia_texto.endswith('-'):
                                evidencia_texto = evidencia_texto[:-1].strip()
                        else:
                            evidencia_texto = self._limpiar_texto(act.evidencias) if act.evidencias else "-"
                    
                    curr_row = start_row + idx

                    if es_primera:
                        # Ponemos el TOTAL y % solo en la primera celda
                        row = [
                            f"{cat_index}",
                            Paragraph(f"<b>{nombre_cat}</b>", self._get_estilo_celda_center()),
                            Paragraph(detalle, self._get_estilo_celda()),
                            f"{hs:.2f}",
                            f"{semanas_calc:.2f}",
                            f"{total_cat:.2f}", # DATO
                            f"{porc_cat:.2f}", # DATO
                            Paragraph(evidencia_texto, self._get_estilo_celda())
                        ]
                    else:
                        # Dejamos vacías las celdas de Total y %
                        row = ['', '', Paragraph(detalle, self._get_estilo_celda()), f"{hs:.2f}", f"{anual:.2f}", '', '', Paragraph(evidencia_texto, self._get_estilo_celda())]
                        
                    datos_tabla.append(row)

                    # --- LÓGICA DE BORDES HORIZONTALES (CLAVE PARA EL DISEÑO) ---
                    if es_ultima:
                        # Si es la última fila de la categoría, cerramos con línea completa
                        estilos_tabla.append(('LINEBELOW', (0, curr_row), (-1, curr_row), 0.5, colors.black))
                    else:
                        # Si es intermedia, dibujamos línea SALTEANDO las columnas fusionadas
                        # Dibujamos bajo Detalle, Hs, Sem (Cols 2,3,4)
                        estilos_tabla.append(('LINEBELOW', (2, curr_row), (4, curr_row), 0.5, colors.black))
                        # Dibujamos bajo Evidencias (Col 7)
                        estilos_tabla.append(('LINEBELOW', (7, curr_row), (7, curr_row), 0.5, colors.black))
                        # IMPORTANTE: NO dibujamos línea bajo 0 (N), 1 (Item), 5 (Total), 6 (%)
                        # Esto hace que visualmente se vean unidas.

                # --- FUSIÓN VERTICAL (SPAN) ---
                estilos_tabla.append(('SPAN', (0, start_row), (0, end_row))) # N°
                estilos_tabla.append(('SPAN', (1, start_row), (1, end_row))) # ITEM
                estilos_tabla.append(('SPAN', (5, start_row), (5, end_row))) # TOT
                estilos_tabla.append(('SPAN', (6, start_row), (6, end_row))) # %
                
                # Alineación Vertical
                estilos_tabla.append(('VALIGN', (0, start_row), (1, end_row), 'MIDDLE')) 
                estilos_tabla.append(('VALIGN', (5, start_row), (6, end_row), 'MIDDLE')) 
                
                row_cursor += n_filas
            else:
                # Caso vacío
                row = [f"{cat_index}", Paragraph(f"<b>{nombre_cat}</b>", self._get_estilo_celda_center()), Paragraph("Sin actividades", self._get_estilo_celda()), "-", "-", "0", "0%", "-"]
                datos_tabla.append(row)
                estilos_tabla.append(('LINEBELOW', (0, row_cursor), (-1, row_cursor), 0.5, colors.black))
                row_cursor += 1
            
            cat_index += 1

        # Total General
        row_total = ['TOTAL HORAS', '', '', '', '', f"{int(total_global)}", '100', '']
        datos_tabla.append(row_total)
        estilos_tabla.append(('FONTNAME', (0, row_cursor), (-1, row_cursor), 'Helvetica-Bold'))
        estilos_tabla.append(('BACKGROUND', (0, row_cursor), (-1, row_cursor), colors.Color(0.95, 0.95, 0.95)))
        # Fusionar columnas 0 y 1 para eliminar la línea vertical entre ellas
        estilos_tabla.append(('SPAN', (0, row_cursor), (1, row_cursor)))
        estilos_tabla.append(('INNERGRID', (0, row_cursor), (-1, row_cursor), 0.5, colors.black))

        tabla_actividades = Table(datos_tabla, colWidths=col_widths, repeatRows=1)
        tabla_actividades.setStyle(TableStyle(estilos_tabla))
        tabla_actividades.hAlign = 'CENTER'
        elementos.append(tabla_actividades)
        
        # --- 4. CONCLUSIONES ---
        if informe_data:
            elementos.append(Spacer(1, 10))
            elementos.append(Paragraph("<b>CONCLUSIONES Y EVALUACIÓN</b>", estilo_celda_center))
            contenido_logros = [
                [Paragraph("<b>LOGROS:</b>", estilo_celda), Paragraph(self._limpiar_texto(informe_data.logros), estilo_normal)],
                [Paragraph("<b>DIFICULTADES:</b>", estilo_celda), Paragraph(self._limpiar_texto(informe_data.dificultades), estilo_normal)],
                [Paragraph("<b>EVALUACIÓN DIRECTOR:</b>", estilo_celda), Paragraph(self._limpiar_texto(informe_data.evaluacion_director), estilo_normal)],
            ]
            tabla_conclusiones = Table(contenido_logros, colWidths=[3*cm, 21.7*cm])
            tabla_conclusiones.setStyle(TableStyle([
                ('GRID', (0,0), (-1,-1), 0.5, colors.black),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BACKGROUND', (0,0), (0,-1), colors.Color(0.95, 0.95, 0.95)),
            ]))
            tabla_conclusiones.hAlign = 'CENTER'
            elementos.append(tabla_conclusiones)

        doc.build(elementos)

    @staticmethod
    def generar_reporte_individual(fondo):
        buffer = io.BytesIO()
        reporte = FondoPDFGenerator(buffer)
        informe_data = getattr(fondo, 'informe', None)
        if not informe_data and hasattr(fondo, 'informes'):
             informe_data = fondo.informes.last()
        reporte.generar_pdf(fondo, informe_data)
        buffer.seek(0)
        return buffer
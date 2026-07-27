# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand

from fondos.models import Carrera, Materia


materias_data = [
    # 1er Semestre
    {"sigla": "CIS-ALG-o11101", "nombre": "ALGEBRA I", "semestre": 1, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-FIS-o11102", "nombre": "FÍSICA I", "semestre": 1, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-CAL-o11103", "nombre": "CÁLCULO I", "semestre": 1, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-PRO-o11104", "nombre": "PROGRAMACIÓN I", "semestre": 1, "horas_teoricas": 4, "horas_practicas": 4},
    {"sigla": "CIS-SIE-o11201", "nombre": "SISTEMAS ECONÓMICOS", "semestre": 1, "horas_teoricas": 3, "horas_practicas": 3},
    {"sigla": "CIS-ITE-o11202", "nombre": "INGLÉS TÉCNICO I", "semestre": 1, "horas_teoricas": 3, "horas_practicas": 3},

    # 2do Semestre
    {"sigla": "CIS-ALG-o12105", "nombre": "ALGEBRA II", "semestre": 2, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-CAL-o12106", "nombre": "CÁLCULO II", "semestre": 2, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-FIS-o12107", "nombre": "FÍSICA III", "semestre": 2, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-PRO-o12301", "nombre": "PROGRAMACIÓN II", "semestre": 2, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-ADE-o12203", "nombre": "ADMINISTRACIÓN DE EMPRESAS", "semestre": 2, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-ITE-o12204", "nombre": "INGLÉS TÉCNICO II", "semestre": 2, "horas_teoricas": 3, "horas_practicas": 3},

    # 3er Semestre
    {"sigla": "CIS-EST-o13108", "nombre": "ESTADÍSTICA I", "semestre": 3, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-CAL-o13109", "nombre": "CÁLCULO III", "semestre": 3, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-MAD-o13302", "nombre": "MATEMÁTICA DISCRETA", "semestre": 3, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-PRO-o13303", "nombre": "PROGRAMACIÓN III", "semestre": 3, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-COE-o13205", "nombre": "COMUNICACIÓN ORAL Y ESCRITA", "semestre": 3, "horas_teoricas": 2, "horas_practicas": 2},
    {"sigla": "CIS-MIC-o13304", "nombre": "METODOLOGÍA DE LA INVESTIGACIÓN I", "semestre": 3, "horas_teoricas": 2, "horas_practicas": 2},

    # 4to Semestre
    {"sigla": "CIS-EDA-o14305", "nombre": "ESTRUCTURA DE DATOS I", "semestre": 4, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-BDA-o14306", "nombre": "BASE DE DATOS I", "semestre": 4, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-EST-o14110", "nombre": "ESTADÍSTICA II", "semestre": 4, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-SDI-o14307", "nombre": "SISTEMAS DIGITALES", "semestre": 4, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-MEN-o14308", "nombre": "MÉTODOS NUMÉRICOS", "semestre": 4, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-ADA-o14309", "nombre": "ANÁLISIS Y DISEÑO DE ALGORITMOS", "semestre": 4, "horas_teoricas": 4, "horas_practicas": 2},

    # 5to Semestre
    {"sigla": "CIS-ACO-o15310", "nombre": "ARQUITECTURA DE COMPUTADORAS", "semestre": 5, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-BDA-o15311", "nombre": "BASE DE DATOS II", "semestre": 5, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-INS-o15312", "nombre": "INGENIERÍA DE SISTEMAS", "semestre": 5, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-SII-o15313", "nombre": "SISTEMAS DE INFORMACIÓN I", "semestre": 5, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-INO-o15314", "nombre": "INVESTIGACIÓN OPERATIVA I", "semestre": 5, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-EDA-o15401", "nombre": "ESTRUCTURA DE DATOS II", "semestre": 5, "horas_teoricas": 4, "horas_practicas": 2},

    # 6to Semestre
    {"sigla": "CIS-COB-o16206", "nombre": "CONTABILIDAD BÁSICA", "semestre": 6, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-SIO-o16315", "nombre": "SISTEMAS OPERATIVOS", "semestre": 6, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-RED-o16316", "nombre": "REDES I", "semestre": 6, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-SII-o16402", "nombre": "SISTEMAS DE INFORMACIÓN II", "semestre": 6, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-INO-o16403", "nombre": "INVESTIGACIÓN OPERATIVA II", "semestre": 6, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-INS-o16317", "nombre": "INGENIERÍA DE SOFTWARE I", "semestre": 6, "horas_teoricas": 4, "horas_practicas": 2},

    # 7mo Semestre
    {"sigla": "CIS-INM-o17404", "nombre": "INGENIERÍA DE MÉTODOS", "semestre": 7, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-SIG-o17405", "nombre": "SISTEMAS DE INFORMACIÓN GEOGRÁFICA", "semestre": 7, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-TEM-o17406", "nombre": "TECNOLOGÍAS EMERGENTES", "semestre": 7, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-ILE-o17207", "nombre": "INGENIERÍA LEGAL / ÉTICA Y DEONTOLOGÍA", "semestre": 7, "horas_teoricas": 2, "horas_practicas": 2},
    {"sigla": "CIS-MER-o17208", "nombre": "MERCADOTECNIA", "semestre": 7, "horas_teoricas": 2, "horas_practicas": 2},
    {"sigla": "CIS-PEP-o17209", "nombre": "PREPARACIÓN Y EVALUACIÓN DE PROYECTOS", "semestre": 7, "horas_teoricas": 4, "horas_practicas": 2},

    # 8vo Semestre (Tronco Común)
    {"sigla": "CIS-GEP-o18318", "nombre": "GESTIÓN DE PROYECTOS", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-GEC-o18319", "nombre": "GESTIÓN DE CALIDAD", "semestre": 8, "horas_teoricas": 2, "horas_practicas": 2},
    {"sigla": "CIS-MSS-o18407", "nombre": "MODELACIÓN Y SIMULACIÓN DE SISTEMAS I", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-MIC-o18408", "nombre": "METODOLOGÍA DE LA INVESTIGACIÓN II", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},

    # 8vo Semestre (Mención Ingeniería de Software)
    {"sigla": "CIS-TBD-e18320", "nombre": "TALLER DE BASE DE DATOS", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-INS-e18412", "nombre": "INGENIERÍA DE SOFTWARE II", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},

    # 8vo Semestre (Mención Teleinformática)
    {"sigla": "CIS-CEL-e18011", "nombre": "CIRCUITOS ELÉCTRICOS", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},
    {"sigla": "CIS-RED-e18416", "nombre": "REDES II", "semestre": 8, "horas_teoricas": 4, "horas_practicas": 2},

    # 9no Semestre
    {"sigla": "CIS-PRP-o19001", "nombre": "PRÁCTICA PROFESIONAL", "semestre": 9, "horas_teoricas": 0, "horas_practicas": 0},

    # 10mo Semestre
    {"sigla": "CIS-MOG-o10411", "nombre": "MODALIDAD DE GRADUACIÓN", "semestre": 10, "horas_teoricas": 0, "horas_practicas": 0},
]


class Command(BaseCommand):
    help = "Puebla las materias oficiales de Ingeniería de Sistemas (PDC 2021-2025)."

    def handle(self, *args, **options):
        carrera = Carrera.objects.filter(nombre__iexact="Ingeniería de Sistemas").first()
        carrera_created = False

        if carrera is None:
            carrera, carrera_created = Carrera.objects.get_or_create(
                codigo="CIS",
                defaults={
                    "nombre": "Ingeniería de Sistemas",
                    "facultad": "Facultad de Ingeniería y Tecnología",
                    "activo": True,
                },
            )

        creadas = 0
        existentes = 0

        for materia_data in materias_data:
            _, created = Materia.objects.get_or_create(
                sigla=materia_data["sigla"],
                defaults={
                    "nombre": materia_data["nombre"],
                    "carrera": carrera,
                    "semestre": materia_data["semestre"],
                    "horas_teoricas": materia_data["horas_teoricas"],
                    "horas_practicas": materia_data["horas_practicas"],
                },
            )

            if created:
                creadas += 1
            else:
                existentes += 1

        if carrera_created:
            self.stdout.write(self.style.SUCCESS(f"Carrera creada: {carrera.nombre}"))
        else:
            self.stdout.write(f"Carrera usada: {carrera.nombre}")

        self.stdout.write(self.style.SUCCESS(f"Materias creadas: {creadas}"))
        self.stdout.write(self.style.WARNING(f"Materias ya existentes: {existentes}"))

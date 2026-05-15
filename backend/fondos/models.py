from django.db import models
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator, MinLengthValidator
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings
from django.db.models.functions import Lower, Trim
from simple_history.models import HistoricalRecords
from cryptography.fernet import Fernet, InvalidToken
import base64
import hashlib
import os


class DatosLaborales(models.Model):
    """
    'ADN Laboral' universal para cualquier persona que trabaja en la U.A.B.J.B.

    Este modelo centraliza los datos de empleo que antes estaban en Docente:
    - CI (Cédula de Identidad)
    - Fecha de ingreso (base para cálculo de antigüedad)
    - Días de vacación (según antigüedad, Art. 11 y 24)
    - Horas de feriados de la gestión

    Sirve para TODOS los roles: Docente, Director, Jefe de Estudios, IIISYP.
    Una sola persona = un solo registro de DatosLaborales, sin importar
    cuántos roles tenga.
    """

    ci = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Cédula de Identidad"
    )
    fecha_ingreso = models.DateField(
        default=timezone.now,
        help_text="Fecha de ingreso a la institución para cálculo de antigüedad"
    )
    dias_vacacion = models.IntegerField(
        default=15,
        help_text="Días de vacación correspondientes según antigüedad"
    )
    horas_feriados_gestion = models.IntegerField(
        default=128,
        help_text="Total de horas de feriados en la gestión académica"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Datos Laborales"
        verbose_name_plural = "Datos Laborales"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.ci} - Ingreso: {self.fecha_ingreso}"

    def calcular_antiguedad(self, gestion=None):
        """Calcula la antigüedad en años para una gestión dada."""
        if not gestion:
            gestion = timezone.now().year
        if not self.fecha_ingreso:
            return 0
        return max(0, gestion - self.fecha_ingreso.year)

    def calcular_dias_vacacion(self, gestion=None):
        """Calcula días de vacación según antigüedad (Art. 11 y 24)."""
        antiguedad = self.calcular_antiguedad(gestion)
        if antiguedad >= 10:
            return 30
        elif antiguedad >= 5:
            return 20
        return 15  # De 1 a 5 años (y por defecto)

    def clean(self):
        """Validaciones personalizadas."""
        super().clean()

        if self.fecha_ingreso:
            fecha_fundacion = timezone.now().date().replace(year=1967, month=11, day=18)
            hoy = timezone.now().date()
            if self.fecha_ingreso > hoy:
                raise ValidationError({
                    'fecha_ingreso': 'La fecha de ingreso no puede ser una fecha futura.'
                })
            if self.fecha_ingreso < fecha_fundacion:
                raise ValidationError({
                    'fecha_ingreso': 'La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).'
                })


class Docente(models.Model):
    """Modelo para almacenar información personal de docentes (sin carrera).

    Los datos de empleo (vacaciones, feriados, fecha_ingreso, CI) ahora
    viven en DatosLaborales. Este modelo se enfoca en la identidad
    académica del docente.
    """

    CATEGORIA_CHOICES = [
        ('catedratico', 'Catedrático'),
        ('adjunto', 'Adjunto'),
        ('asistente', 'Asistente'),
    ]

    DEDICACION_CHOICES = [
        ('tiempo_completo', 'Tiempo Completo'),
        ('medio_tiempo', 'Medio Tiempo'),
        ('horario_16', 'Horario 16hrs/mes'),
        ('horario_24', 'Horario 24hrs/mes'),
        ('horario_40', 'Horario 40hrs/mes'),
        ('horario_48', 'Horario 48hrs/mes'),
    ]

    # === Datos personales (independientes de carrera) ===
    nombres = models.CharField(max_length=100)
    apellido_paterno = models.CharField(max_length=100)
    apellido_materno = models.CharField(max_length=100, blank=True)

    # === Datos laborales compartidos ===
    datos_laborales = models.OneToOneField(
        DatosLaborales,
        on_delete=models.CASCADE,
        related_name='docente',
        help_text="Datos de empleo compartidos (CI, vacaciones, feriados, antigüedad)"
    )

    # === Contacto ===
    email = models.EmailField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)

    activo = models.BooleanField(
        default=True,
        help_text="Indica si el docente está activo en la institución"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Docente"
        verbose_name_plural = "Docentes"
        ordering = ['apellido_paterno', 'apellido_materno', 'nombres']

    def __str__(self):
        return f"{self.apellido_paterno} {self.apellido_materno} {self.nombres}"

    @property
    def nombre_completo(self):
        return f"{self.nombres} {self.apellido_paterno} {self.apellido_materno}".strip()

    @property
    def ci(self):
        """Propiedad de compatibilidad: accede al CI desde DatosLaborales."""
        return self.datos_laborales.ci if self.datos_laborales else None

    @property
    def fecha_ingreso(self):
        """Propiedad de compatibilidad: accede a fecha_ingreso desde DatosLaborales."""
        return self.datos_laborales.fecha_ingreso if self.datos_laborales else None

    @property
    def dias_vacacion(self):
        """Propiedad de compatibilidad: accede a dias_vacacion desde DatosLaborales."""
        return self.datos_laborales.dias_vacacion if self.datos_laborales else 0

    @dias_vacacion.setter
    def dias_vacacion(self, value):
        """Setter de compatibilidad para tests y código legacy."""
        if self.datos_laborales:
            self.datos_laborales.dias_vacacion = value
            self.datos_laborales.save()

    @property
    def horas_feriados_gestion(self):
        """Propiedad de compatibilidad: accede a horas_feriados_gestion desde DatosLaborales."""
        return self.datos_laborales.horas_feriados_gestion if self.datos_laborales else 0

    @horas_feriados_gestion.setter
    def horas_feriados_gestion(self, value):
        """Setter de compatibilidad para tests y código legacy."""
        if self.datos_laborales:
            self.datos_laborales.horas_feriados_gestion = value
            self.datos_laborales.save()

    def calcular_antiguedad(self, gestion=None):
        """Calcula la antigüedad en años para una gestión dada."""
        if self.datos_laborales:
            return self.datos_laborales.calcular_antiguedad(gestion)
        return 0

    def calcular_dias_vacacion(self, gestion=None):
        """Calcula días de vacación según antigüedad (Art. 11 y 24)."""
        if self.datos_laborales:
            return self.datos_laborales.calcular_dias_vacacion(gestion)
        return 15


class DocenteCarrera(models.Model):
    """Vínculo de un docente con una carrera específica.

    Un mismo Docente puede tener múltiples DocenteCarrera,
    cada uno con su propia categoría y dedicación.
    """

    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name='vinculos_carrera'
    )
    carrera = models.ForeignKey(
        'Carrera',
        on_delete=models.PROTECT,
        related_name='docentes_carrera'
    )

    # === Datos específicos del vínculo con esta carrera ===
    categoria = models.CharField(max_length=20, choices=Docente.CATEGORIA_CHOICES)
    dedicacion = models.CharField(max_length=20, choices=Docente.DEDICACION_CHOICES)
    activo = models.BooleanField(default=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Vínculo Docente-Carrera"
        verbose_name_plural = "Vínculos Docente-Carrera"
        unique_together = ['docente', 'carrera']
        ordering = ['carrera__nombre', 'docente__apellido_paterno']

    def __str__(self):
        return f"{self.docente.nombre_completo} — {self.carrera.nombre}"

    @property
    def horas_semanales_maximas(self):
        """Retorna las horas semanales fijas según tipo de dedicación."""
        mapa_horas = {
            'tiempo_completo': 40,
            'medio_tiempo': 20,
            'horario_16': 4,
            'horario_24': 6,
            'horario_40': 10,
            'horario_48': 12,
        }
        return mapa_horas.get(self.dedicacion, 0)

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()

        # Validación de capacidad: no superar 40h/sem entre todos los vínculos activos.
        if self.pk:
            otros = DocenteCarrera.objects.filter(
                docente=self.docente, activo=True
            ).exclude(pk=self.pk)
        else:
            otros = DocenteCarrera.objects.filter(
                docente=self.docente, activo=True
            )

        horas_totales = sum(v.horas_semanales_maximas for v in otros)
        horas_totales += self.horas_semanales_maximas

        if horas_totales > 40:
            raise ValidationError({
                'dedicacion': (
                    f'No se puede asignar esta dedicación: el docente ya tiene '
                    f'{horas_totales - self.horas_semanales_maximas}h/sem asignadas en otras carreras. '
                    f'Con esta dedicación llegaría a {horas_totales}h/sem, superando el límite de 40h/sem.'
                )
            })

    def save(self, *args, **kwargs):
        """Garantiza que full_clean() (y por tanto clean()) se ejecute antes de guardar."""
        self.full_clean()
        return super().save(*args, **kwargs)


class SaldoVacacionesGestion(models.Model):
    """
    Saldo de vacaciones por docente y gestión académica.
    Permite especificar de forma granular los días de vacación disponibles
    para cada docente en cada año/gestión.
    """
    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name='saldos_vacaciones')
    gestion = models.IntegerField(
        validators=[MinValueValidator(2020), MaxValueValidator(2100)],
        help_text="Año/Gestión académica"
    )
    dias_disponibles = models.IntegerField(
        help_text="Días de vacación disponibles para esta gestión"
    )
    
    class Meta:
        verbose_name = "Saldo de Vacaciones"
        verbose_name_plural = "Saldos de Vacaciones"
        unique_together = ['docente', 'gestion']
        ordering = ['-gestion', 'docente']
    
    def __str__(self):
        return f"{self.docente.nombre_completo} - {self.gestion}: {self.dias_disponibles} días"
    
    def clean(self):
        """
        Validar que si hay FondoDeTiempo aprobados para este docente en esta gestión,
        NO se permita cambiar el saldo de vacaciones (consistencia regulatoria).
        """
        super().clean()
        
        # Solo validar si el objeto ya existe (está siendo actualizado)
        if self.pk:
            saldo_anterior = SaldoVacacionesGestion.objects.get(pk=self.pk)
            
            # Si los días cambiaron
            if saldo_anterior.dias_disponibles != self.dias_disponibles:
                # Verificar si hay fondos aprobados
                fondos_aprobados = FondoTiempo.objects.filter(
                    docente=self.docente,
                    gestion=self.gestion,
                    estado='aprobado_director'
                ).count()
                
                if fondos_aprobados > 0:
                    raise ValidationError({
                        'dias_disponibles': (
                            f'⚠️ NO SE PUEDE MODIFICAR: Hay {fondos_aprobados} Fondo(s) de Tiempo '
                            f'aprobado(s) para este docente en la gestión {self.gestion}. '
                            f'Cambiar el saldo de vacaciones desalinearía las horas_efectivas '
                            f'legalmente aprobadas. Contacte al administrador si necesita corregir.'
                        )
                    })
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class FacultadCatalogo(models.Model):
    """Catálogo editable de facultades para formularios de carrera."""

    nombre = models.CharField(max_length=200, unique=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Facultad"
        verbose_name_plural = "Facultades"
        ordering = ['nombre']

    def __str__(self):
        return self.nombre

    @staticmethod
    def _normalizar(texto):
        """Normaliza texto: minúsculas, sin tildes, sin espacios extra."""
        import unicodedata
        texto = texto.strip().lower()
        texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
        return ' '.join(texto.split())

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        if not self.nombre or not self.nombre.strip():
            raise ValidationError({'nombre': 'El nombre de la facultad es obligatorio.'})

        nombre_normalizado = self._normalizar(self.nombre)

        # Comparar con todos los registros existentes ignorando mayúsculas y acentos
        qs = FacultadCatalogo.objects.all()
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        for fac in qs:
            if self._normalizar(fac.nombre) == nombre_normalizado:
                raise ValidationError({
                    'nombre': f'Ya existe una facultad con nombre equivalente: "{fac.nombre}".'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Carrera(models.Model):
    """Carreras de la universidad"""

    DEFAULT_FACULTADES = [
        'Facultad de Ingeniería y Tecnología',
        'Facultad de Ciencias y Tecnologia',
        'Facultad de Ciencias de la Salud',
        'Facultad de Ciencias Juridicas, Politicas y Sociales',
        'Facultad de Ciencias Economicas y Financieras',
        'Facultad de Humanidades y Ciencias de la Educacion',
        'Facultad de Ciencias Agropecuarias',
    ]
    
    nombre = models.CharField(max_length=200, unique=True)
    codigo = models.CharField(max_length=20, unique=True, validators=[MinLengthValidator(2)])
    facultad = models.CharField(max_length=200)
    mision = models.TextField(blank=True, default='')
    vision = models.TextField(blank=True, default='')
    perfil_profesional = models.TextField(blank=True, default='', help_text='Descripción del perfil profesional del egresado')
    objetivo_carrera = models.TextField(blank=True, default='', help_text='Objetivo general de la carrera')
    responsable = models.CharField(max_length=200, blank=True, default='', help_text='Nombre/cargo del responsable de la carrera')
    resolucion_ministerial = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Número/código de la resolución ministerial o universitaria que respalda la carrera',
    )
    fecha_resolucion = models.DateField(
        null=True,
        blank=True,
        help_text='Fecha oficial de la resolución ministerial o universitaria',
    )
    logo_carrera = models.ImageField(upload_to='carreras/', null=True, blank=True)
    logo_carrera_cifrada = models.BinaryField(null=True, blank=True, editable=False)
    logo_carrera_mime = models.CharField(max_length=64, blank=True, default='')
    activo = models.BooleanField(default=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()
    
    class Meta:
        verbose_name = "Carrera"
        verbose_name_plural = "Carreras"
        ordering = ['facultad', 'nombre']
    
    def __str__(self):
        return f"{self.nombre} - {self.facultad}"

    @classmethod
    def get_facultad_values(cls):
        # Solo devolver facultades del catálogo editable
        # Sin valores por defecto - el usuario las gestiona manualmente
        return list(
            FacultadCatalogo.objects.order_by('nombre').values_list('nombre', flat=True)
        )

    def clean(self):
        super().clean()
        self.codigo = (self.codigo or '').strip().upper()
        self.facultad = (self.facultad or '').strip()

        if not self.codigo:
            raise ValidationError({'codigo': 'El codigo de carrera es obligatorio.'})
        if not (self.facultad or '').strip():
            raise ValidationError({'facultad': 'La facultad es obligatoria y no puede estar vacía.'})
        
        # Validar facultad solo si hay facultades en el catálogo
        facultades_validas = set(self.get_facultad_values())
        if facultades_validas and self.facultad not in facultades_validas:
            raise ValidationError({'facultad': 'La facultad seleccionada no es valida.'})
        
        if self.fecha_resolucion and self.fecha_resolucion > timezone.now().date():
            raise ValidationError({'fecha_resolucion': 'La fecha de resolución no puede ser futura.'})

    @staticmethod
    def _get_cipher():
        key_from_env = getattr(settings, 'PROFILE_IMAGE_ENCRYPTION_KEY', '')
        if key_from_env:
            key = key_from_env.encode('utf-8') if isinstance(key_from_env, str) else key_from_env
        else:
            digest = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
            key = base64.urlsafe_b64encode(digest)
        return Fernet(key)

    def set_logo_carrera_cifrada(self, uploaded_file):
        image_bytes = uploaded_file.read()
        if not image_bytes:
            raise ValidationError("La imagen está vacía.")

        mime_type = getattr(uploaded_file, 'content_type', '') or 'image/jpeg'
        encrypted = self._get_cipher().encrypt(image_bytes)

        self.logo_carrera_cifrada = encrypted
        self.logo_carrera_mime = mime_type

        # Compatibilidad: limpiar almacenamiento físico anterior.
        if self.logo_carrera and self.logo_carrera.name:
            self.logo_carrera.delete(save=False)
        self.logo_carrera = None

    def clear_logo_carrera(self):
        if self.logo_carrera and self.logo_carrera.name:
            self.logo_carrera.delete(save=False)
        self.logo_carrera = None
        self.logo_carrera_cifrada = None
        self.logo_carrera_mime = ''

    def get_logo_carrera_data_uri(self):
        if not self.logo_carrera_cifrada:
            return None

        try:
            decrypted = self._get_cipher().decrypt(bytes(self.logo_carrera_cifrada))
        except InvalidToken:
            return None

        b64_image = base64.b64encode(decrypted).decode('ascii')
        mime = self.logo_carrera_mime or 'image/jpeg'
        return f"data:{mime};base64,{b64_image}"


class Materia(models.Model):
    nombre = models.CharField(max_length=200)
    sigla = models.CharField(max_length=20, unique=True, validators=[MinLengthValidator(2)])
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, related_name='materias')
    semestre = models.IntegerField()
    horas_teoricas = models.IntegerField(default=0)
    horas_practicas = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower(Trim('sigla')),
                name='materia_sigla_unique_ci_trim',
            ),
        ]

    def clean(self):
        super().clean()
        self.sigla = (self.sigla or '').strip().upper()
        if not self.sigla:
            raise ValidationError({'sigla': 'La sigla de la materia es obligatoria.'})

    def __str__(self):
        return f"{self.sigla} - {self.nombre}"

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def horas_totales(self):
        return (self.horas_teoricas or 0) + (self.horas_practicas or 0)


class CalendarioAcademico(models.Model):
    """Calendario académico según Art. 15, 18 del reglamento"""
    
    PERIODO_CHOICES = [
        ('1', 'Primer Semestre'),
        ('2', 'Segundo Semestre'),
        ('anual', 'Anual'),
    ]
    
    gestion = models.IntegerField(
        validators=[MinValueValidator(2020), MaxValueValidator(2100)],
        help_text="Año académico"
    )
    periodo = models.CharField(max_length=10, choices=PERIODO_CHOICES)
    fecha_inicio = models.DateField(help_text="Inicio del periodo académico")
    fecha_fin = models.DateField(help_text="Fin del periodo académico")
    fecha_inicio_presentacion_proyectos = models.DateField(
        help_text="Inicio de presentación de proyectos y programas analíticos"
    )
    fecha_limite_presentacion_proyectos = models.DateField(
        help_text="Fecha límite para presentar proyectos"
    )
    semanas_efectivas = models.IntegerField(
        default=16,
        help_text="Número de semanas efectivas del periodo"
    )
    activo = models.BooleanField(
        default=False,
        help_text="Solo puede haber un calendario activo por periodo"
    )
    
    class Meta:
        verbose_name = "Calendario Académico"
        verbose_name_plural = "Calendarios Académicos"
        ordering = ['-gestion', '-periodo']
        unique_together = ['gestion', 'periodo']
    
    def __str__(self):
        return f"Gestión {self.gestion} - {self.get_periodo_display()}"
    
    def save(self, *args, **kwargs):
        """Al guardar, si este calendario está activo, desactiva cualquier otro."""
        if self.activo:
            # Desactiva todos los demás calendarios que estén activos.
            # El .exclude(pk=self.pk) es crucial para no desactivarse a sí mismo
            # antes de guardar, especialmente al editar un calendario ya activo.
            CalendarioAcademico.objects.filter(activo=True).exclude(pk=self.pk).update(activo=False)
        super().save(*args, **kwargs)


class FondoTiempo(models.Model):
    """Modelo principal para el fondo de tiempo anual de un docente"""
    
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('presentado_jefe', 'Presentado a Jefe de Estudios'),
        ('observado', 'Con Observaciones'),
        ('presentado_director', 'Presentado a Director de Carrera'),
        ('aprobado_director', 'Aprobado por Director de Carrera'),
        ('en_ejecucion', 'En Ejecución'),
        ('informe_presentado', 'Informe Presentado'),
        ('finalizado', 'Finalizado'),
        ('rechazado', 'Rechazado'),
        ('archivado', 'Archivado'),
    ]
    
    PERIODO_CHOICES = [
        ('1', 'Primer Semestre'),
        ('2', 'Segundo Semestre'),
        ('anual', 'Anual'),
    ]
    
    TIPO_FONDO_CHOICES = [
        ('semestral', 'Semestral/Anual'),
        ('largo_plazo', 'Largo Plazo'),
    ]
    
    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name='fondos_tiempo')
    carrera = models.ForeignKey(Carrera, on_delete=models.PROTECT, related_name='fondos_tiempo')
    calendario_academico = models.ForeignKey(
        CalendarioAcademico,
        on_delete=models.PROTECT,
        related_name='fondos',
        null=True,
        blank=True,
        help_text="Calendario académico al que pertenece este fondo (si aplica)"
    )
    
    gestion = models.IntegerField(validators=[MinValueValidator(2020), MaxValueValidator(2100)])
    periodo = models.CharField(
        max_length=10, 
        choices=PERIODO_CHOICES,
        blank=True,
        help_text="Periodo académico según calendario (si aplica)"
    )
    asignatura = models.CharField(max_length=200, blank=True, help_text="Asignatura o descripción general del fondo")
    
    tipo_fondo = models.CharField(
        max_length=20,
        choices=TIPO_FONDO_CHOICES,
        default='semestral',
        help_text="Define si el fondo es para un periodo académico específico o a largo plazo."
    )
    
    # Configuración temporal
    semanas_año = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        default=Decimal('45.8'),
        help_text="Número de semanas efectivas del año para cálculo de horas anuales"
    )
    horas_semana = models.DecimalField(max_digits=5, decimal_places=2, default=0, help_text="Horas semanales del docente según su dedicación")
    horas_vacacion = models.IntegerField(default=120)
    horas_feriados = models.IntegerField(default=0) # Often not subtracted from total effective hours
    contrato_horas = models.IntegerField(default=2080)
    clases_aula_horas = models.IntegerField(default=240)
    funciones_sustantivas_horas = models.IntegerField(default=1124)
    horas_efectivas = models.DecimalField(max_digits=6, decimal_places=2, default=1832.0)
    
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default='borrador')
    observaciones = models.TextField(blank=True)
    
    # Programa analítico
    tiene_programa_analitico = models.BooleanField(
        default=False,
        help_text="Indica si se adjuntó el programa analítico (obligatorio Art. 15)"
    )
    programa_analitico_url = models.URLField(
        blank=True,
        help_text="URL del programa analítico (Google Drive, etc.)"
    )
    fecha_presentacion = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Fecha de presentación a Director de Carrera"
    )
    
    # Sistema de permisos
    archivado = models.BooleanField(default=False, help_text="Fondo archivado (no visible, no eliminado)")
    comentarios_admin = models.TextField(blank=True, help_text="Observaciones del administrador o director")
    fecha_aprobacion = models.DateTimeField(blank=True, null=True, help_text="Fecha en que fue aprobado")
    fecha_validacion = models.DateTimeField(blank=True, null=True, help_text="Fecha en que fue validado")
    
    aprobado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fondos_aprobados',
        help_text="Usuario que aprobó el fondo"
    )
    validado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fondos_validados',
        help_text="Usuario que validó el fondo"
    )
    
    fecha_inicio_ejecucion = models.DateTimeField(null=True, blank=True)
    fecha_informe = models.DateTimeField(null=True, blank=True)
    fecha_finalizacion = models.DateTimeField(null=True, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Fondo de Tiempo"
        verbose_name_plural = "Fondos de Tiempo"
        ordering = ['-gestion', 'docente']
        # Se elimina unique_together para permitir fondos a largo plazo sin periodo/asignatura definidos.
        # Se recomienda implementar una `UniqueConstraint` condicional en la base de datos
        # o una validación personalizada en el método `clean` o `save` del modelo.
        # unique_together = ['docente', 'gestion', 'periodo', 'asignatura']
        constraints = [
            models.UniqueConstraint(
                fields=['docente', 'gestion', 'periodo', 'asignatura'],
                condition=models.Q(tipo_fondo='semestral'),
                name='unique_semestral_fondo'
            )
        ]

    def __str__(self):
        return f"{self.docente.nombre_completo} - {self.gestion} - {self.asignatura}"
    
    @property
    def porcentaje_completado(self):
        if not self.horas_efectivas or self.horas_efectivas == 0:
            return Decimal('0.00')
        
        # Operación puramente Decimal
        resultado = (self.total_asignado / self.horas_efectivas) * 100
        
        # Retornar redondeado a 2 decimales
        return resultado.quantize(Decimal('0.01'))
    
    @property
    def horas_disponibles(self):
        return self.horas_efectivas - self.total_asignado
    
    def puede_presentar(self):
        """Verifica si el fondo puede ser presentado a Director"""
        return (
            self.estado == 'borrador' and
            self.tiene_programa_analitico and
            self.total_asignado > 0
        )
    
    def puede_editar(self, usuario):
        """Determina si un usuario puede editar este fondo"""
        estados_editables = ['borrador', 'observado', 'en_ejecucion']

        # Solo un iiisyp (que es staff) puede editar. Directores y Jefes no.
        if usuario.is_staff and hasattr(usuario, 'perfil') and usuario.perfil.rol == 'iiisyp':
            return self.estado in estados_editables
        
        # El docente dueño puede editar si el estado lo permite.
        if hasattr(usuario, 'perfil') and usuario.perfil.docente:
            return (
                self.docente == usuario.perfil.docente and
                self.estado in estados_editables
            )
        
        return False
    
    def puede_cambiar_estado(self, usuario, nuevo_estado=None):
        """
        Valida permisos para cambiar el estado del Fondo de Tiempo.
        
        - 'observado': Solo jefe_estudios (del mismo programa) o admin
        - Otros cambios: Solo admin o director (is_staff)
        """
        # Necesario ser staff
        if not usuario.is_staff:
            return False
        
        # Si se especifica nuevo estado, hacer validaciones adicionales
        if nuevo_estado == 'observado':
            # Solo admin o jefe_estudios pueden cambiar a 'observado'
            if hasattr(usuario, 'perfil') and usuario.perfil:
                rol = usuario.perfil.rol
                if rol in ['iiisyp', 'jefe_estudios']:
                    return True
            return False
        
        # Para otros estados, basta con ser staff
        return True
    
    def puede_archivar(self, usuario):
        """Solo admin puede archivar"""
        return usuario.is_staff

    def _obtener_vinculo(self):
        """Obtiene el vínculo DocenteCarrera activo para este fondo."""
        if not self.docente_id or not self.carrera_id:
            return None
        return DocenteCarrera.objects.filter(
            docente=self.docente,
            carrera=self.carrera,
            activo=True
        ).first()

    def _obtener_horas_vacacion_docente(self):
        """
        Obtiene las horas de vacación para el docente en la gestión actual.

        Vacaciones son de la PERSONA (Docente.dias_vacacion).
        Horas diarias se calculan según la dedicación del VÍNCULO (DocenteCarrera).
        """
        vinculo = self._obtener_vinculo()
        if not self.docente or not vinculo:
            return 0

        # Intenta obtener del saldo específico de la gestión
        try:
            saldo = SaldoVacacionesGestion.objects.get(
                docente=self.docente,
                gestion=self.gestion
            )
            dias_vacacion = saldo.dias_disponibles
            horas_diarias = Decimal(vinculo.horas_semanales_maximas) / 5
            return int(Decimal(dias_vacacion) * horas_diarias)
        except SaldoVacacionesGestion.DoesNotExist:
            pass

        # Fallback: usa el valor del docente
        dias_vacacion = self.docente.dias_vacacion or 0
        if dias_vacacion <= 0:
            dias_vacacion = self.docente.calcular_dias_vacacion(self.gestion)

        horas_diarias = Decimal(vinculo.horas_semanales_maximas) / 5
        return int(Decimal(dias_vacacion) * horas_diarias)

    def _obtener_horas_feriados_docente(self):
        """
        Calcula horas de feriados PROPORCIONALES a la dedicación del vínculo.

        Feriados son de la PERSONA (Docente.horas_feriados_gestion).
        Horas diarias se calculan según la dedicación del VÍNCULO (DocenteCarrera).
        """
        vinculo = self._obtener_vinculo()
        if not self.docente or not vinculo:
            return 0

        dias_feriados = self.docente.horas_feriados_gestion or 128

        if dias_feriados == 128:
            horas_diarias = Decimal(vinculo.horas_semanales_maximas) / 5
            return int(Decimal(16) * horas_diarias)
        else:
            return int(dias_feriados)

    def _recalcular_horas_automaticas(self):
        """
        Regla UABJB — Cálculo de horas efectivas según dedicación del docente.

        HORAS SEMANALES: se obtienen del vínculo DocenteCarrera(docente, carrera).
        VACACIONES Y FERIADOS: se obtienen del Docente (son de la persona).
        """
        if not self.docente:
            return

        # Buscar el vínculo DocenteCarrera para esta carrera
        vinculo = DocenteCarrera.objects.filter(
            docente=self.docente,
            carrera=self.carrera,
            activo=True
        ).first()

        if not vinculo:
            # Si no hay vínculo, no se puede calcular
            return

        horas_semana = vinculo.horas_semanales_maximas

        # 1. Horas semanales del vínculo
        self.horas_semana = Decimal(horas_semana)

        # 2. CONTRATO HORAS DINÁMICO: horas_semanales × 52 semanas
        self.contrato_horas = int(self.horas_semana * 52)

        # 3. Horas de vacación PROPORCIONALES a la dedicación
        self.horas_vacacion = self._obtener_horas_vacacion_docente()

        # 4. Horas de feriados PROPORCIONALES a la dedicación
        self.horas_feriados = self._obtener_horas_feriados_docente()

        # 5. Cálculo final: contrato - vacacion - feriados (redondeo hacia abajo)
        horas_disponibles_reglamentarias = (
            int(self.contrato_horas)
            - int(self.horas_vacacion)
            - int(self.horas_feriados)
        )

        self.horas_efectivas = Decimal(max(horas_disponibles_reglamentarias, 0))

    def clean(self):
        super().clean()

        # Sin docente no es posible validar reglas de carga horaria.
        if not self.docente:
            return

        # ============================================================
        # VALIDACIÓN 1: Bloqueo por Estado
        # ============================================================
        # Si el fondo está en un estado bloqueado (presentado, aprobado, etc.),
        # NO permitir cambios. Solo 'borrador' y 'observado' son editables.
        
        ESTADOS_BLOQUEADOS = [
            'presentado_jefe',
            'presentado_director',
            'aprobado_director',
            'en_ejecucion',
            'informe_presentado',
            'finalizado',
            'archivado'
        ]
        
        ESTADOS_EDITABLES = ['borrador', 'observado', 'rechazado']
        
        # Si el fondo ya existe en DB, verificar si está en estado bloqueado
        if self.pk:
            fondo_actual = FondoTiempo.objects.get(pk=self.pk)
            
            # Si está en estado bloqueado, comparar con cambios
            if fondo_actual.estado in ESTADOS_BLOQUEADOS:
                # Campos que NO pueden cambiar una vez presentado
                campos_criticos = [
                    'docente', 'carrera', 'gestion', 'periodo',
                    'horas_vacacion', 'horas_feriados', 'horas_efectivas'
                ]
                
                cambios_detectados = False
                for campo in campos_criticos:
                    if getattr(self, campo) != getattr(fondo_actual, campo):
                        cambios_detectados = True
                        break
                
                if cambios_detectados:
                    raise ValidationError({
                        'estado': (
                            f'No se puede editar un Fondo de Tiempo en estado '
                            f'"{fondo_actual.get_estado_display()}". '
                            f'Solo se pueden editar fondos en estado "Borrador" u "Observado".'
                        )
                    })
            
            # Si pasó, al menos el estado actual es editable
            if self.estado not in ESTADOS_EDITABLES + [fondo_actual.estado]:
                raise ValidationError({
                    'estado': (
                        f'Transición de estado no permitida. '
                        f'Estados editables: {", ".join([dict(self.ESTADO_CHOICES)[s] for s in ESTADOS_EDITABLES])}.'
                    )
                })

        # ============================================================
        # VALIDACIÓN 2: Recalor de horas
        # ============================================================
        # Recalcula aquí también para que la validación use valores actualizados.
        self._recalcular_horas_automaticas()

        # Validación reglamentaria: suma de las 7 dimensiones no debe exceder las horas efectivas.
        total_dimensiones = Decimal('0.00')
        if self.pk:
            total_dimensiones = self.categorias.aggregate(total=models.Sum('total_horas'))['total'] or Decimal('0.00')

        if Decimal(total_dimensiones) > Decimal(self.horas_efectivas):
            raise ValidationError({
                'horas_efectivas': (
                    'La suma de las 7 dimensiones no puede superar las horas disponibles '
                    f'({self.horas_efectivas}). Total actual: {total_dimensiones}.'
                )
            })
        
        # ============================================================
        # VALIDACIÓN 3: Consistencia con SaldoVacacionesGestion
        # ============================================================
        # Si el estado es aprobado y hay cambios en saldo de vacaciones, alertar
        if self.pk:
            fondo_actual = FondoTiempo.objects.get(pk=self.pk)
            
            if fondo_actual.estado == 'aprobado_director':
                # Verificar si el saldo de vacaciones ha cambiado
                horas_vacacion_anterior = fondo_actual.horas_vacacion
                horas_vacacion_nueva = self._obtener_horas_vacacion_docente()
                
                if horas_vacacion_nueva != horas_vacacion_anterior:
                    raise ValidationError({
                        'horas_vacacion': (
                            f'⚠️ ALERTA DE CONSISTENCIA: El saldo de vacaciones del docente ha sido '
                            f'modificado después de la aprobación. Horas anteriores: {horas_vacacion_anterior}, '
                            f'Horas actuales: {horas_vacacion_nueva}. '
                            f'Si continúa, el Fondo de Tiempo quedará desalineado con lo aprobado legalmente. '
                            f'Contacte al administrador para resolver.'
                        )
                    })
    
    def save(self, *args, **kwargs):
        self._recalcular_horas_automaticas()
        self.full_clean()

        super(FondoTiempo, self).save(*args, **kwargs)
        
    @property
    def total_asignado(self):
      return self.categorias.aggregate(
        total=models.Sum('total_horas')
    )['total'] or 0


class CategoriaFuncion(models.Model):
    """Categorías de funciones sustantivas"""
    
    TIPO_CHOICES = [
        ('docente', 'Docente'),
        ('investigacion', 'Investigación'),
        ('extension', 'Extensión e Interacción Social'),
        ('asesorias', 'Asesorías y Tutorías'),
        ('tribunales', 'Tribunales'),
        ('administrativo', 'Administrativo'),
        ('vida_universitaria', 'Vida Universitaria'),
    ]
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='categorias')
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    total_horas = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        verbose_name = "Categoría de Función"
        verbose_name_plural = "Categorías de Funciones"
        ordering = ['fondo_tiempo', 'tipo']
        unique_together = ['fondo_tiempo', 'tipo']
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.total_horas}h ({self.porcentaje}%)"


def evidencia_upload_path(instance, filename):
    """Genera la ruta de archivo: /uploads/docente_id/gestion_YYYY/categoria/filename"""
    try:
        fondo = instance.categoria.fondo_tiempo
        docente_id = fondo.docente.id
        gestion = fondo.gestion
        categoria_tipo = instance.categoria.tipo
        return f'uploads/docente_{docente_id}/gestion_{gestion}/{categoria_tipo}/{filename}'
    except Exception:
        return f'uploads/uncategorized/{filename}'

class Actividad(models.Model):
    """Actividades específicas dentro de cada categoría"""
    
    categoria = models.ForeignKey(CategoriaFuncion, on_delete=models.CASCADE, related_name='actividades')
    detalle = models.CharField(max_length=300)
    horas_semana = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    horas_año = models.DecimalField(max_digits=6, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    evidencias = models.TextField(blank=True, default='')
    archivo_evidencia = models.FileField(
        upload_to=evidencia_upload_path, 
        null=True, 
        blank=True,
        help_text="Prueba visual (Imagen/PDF)"
    )
    orden = models.IntegerField(default=0)
    proyecto = models.ForeignKey(
        'Proyecto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='actividades',
        help_text="Proyecto al que pertenece esta actividad"
    )
    
    class Meta:
        verbose_name = "Actividad"
        verbose_name_plural = "Actividades"
        ordering = ['categoria', 'orden', 'id']
    
    def __str__(self):
        return f"{self.detalle} - {self.horas_año}h/año"


class CargaHoraria(models.Model):
    """Asignación de horas a un docente por parte de una autoridad (Jefe de Estudios)."""
    
    CATEGORIA_CHOICES = CategoriaFuncion.TIPO_CHOICES
    PARALELO_CHOICES = [
        ('A', 'A'),
        ('B', 'B'),
        ('C', 'C'),
        ('D', 'D'),
        ('E', 'E'),
        ('F', 'F'),
    ]
    DIA_SEMANA_CHOICES = [
        ('lunes', 'Lunes'),
        ('martes', 'Martes'),
        ('miercoles', 'Miercoles'),
        ('jueves', 'Jueves'),
        ('viernes', 'Viernes'),
        ('sabado', 'Sabado'),
    ]

    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name='cargas_horarias')
    calendario = models.ForeignKey(CalendarioAcademico, on_delete=models.PROTECT, related_name='cargas_horarias')
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES)
    materia = models.ForeignKey(
        Materia,
        on_delete=models.PROTECT,
        related_name='asignaciones_horarias',
        null=True,
        blank=True,
        help_text='Materia del plan de estudios asignada al docente.'
    )
    paralelo = models.CharField(max_length=1, choices=PARALELO_CHOICES, default='A')
    dia_semana = models.CharField(max_length=10, choices=DIA_SEMANA_CHOICES, default='lunes')
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    aula = models.CharField(max_length=100, default='', blank=True)
    horas = models.PositiveIntegerField(help_text="Cantidad de horas anuales asignadas para esta actividad.")
    documento_respaldo = models.CharField(
        max_length=100,
        blank=True,
        help_text='Opcional. Ej: "Memo #123", "Res. HCF #456/2024"'
    )
    creado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='cargas_creadas')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Carga Horaria"
        verbose_name_plural = "Cargas Horarias"
        ordering = ['-calendario__gestion', 'docente', 'categoria']
        unique_together = ['docente', 'calendario', 'materia', 'paralelo', 'dia_semana', 'hora_inicio']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(hora_fin__gt=models.F('hora_inicio')),
                name='cargahoraria_hora_fin_gt_inicio',
            ),
        ]

    def clean(self):
        if self.hora_inicio and self.hora_fin and self.hora_fin <= self.hora_inicio:
            raise ValidationError({'hora_fin': 'La hora de fin debe ser mayor que la hora de inicio.'})

    def __str__(self):
        materia_txt = self.materia.sigla if self.materia else 'SIN-MATERIA'
        return (
            f"{self.docente.nombre_completo} - {materia_txt} {self.paralelo} "
            f"({self.dia_semana} {self.hora_inicio}-{self.hora_fin})"
        )


class Proyecto(models.Model):
    """Proyectos obligatorios según Art. 14-17 del reglamento"""
    
    TIPO_CHOICES = [
        ('investigacion', 'Investigación'),
        ('extension', 'Extensión Universitaria'),
        ('interaccion', 'Interacción Social'),
    ]
    
    MODALIDAD_CHOICES = [
        ('presencial', 'Presencial'),
        ('virtual', 'Virtual'),
        ('hibrida', 'Híbrida'),
    ]
    
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('presentado', 'Presentado'),
        ('aprobado', 'Aprobado'),
        ('en_ejecucion', 'En Ejecución'),
        ('finalizado', 'Finalizado'),
        ('observado', 'Con Observaciones'),
    ]
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='proyectos')
    categoria = models.ForeignKey(CategoriaFuncion, on_delete=models.CASCADE, related_name='proyectos')
    titulo = models.CharField(max_length=200)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    
    # Campos obligatorios según Art. 16
    antecedentes = models.TextField(help_text="Antecedentes del proyecto (Art. 16)")
    justificacion = models.TextField(help_text="Justificación del proyecto (Art. 16)")
    objetivos = models.TextField(help_text="Objetivos del proyecto (Art. 16)")
    problema = models.TextField(blank=True, help_text="Problema que aborda el proyecto (Art. 16)")
    cronograma = models.JSONField(default=dict, blank=True, help_text="Cronograma: lugar, fecha, hora")
    
    # Para cursos/seminarios (Art. 17)
    es_curso_seminario = models.BooleanField(default=False)
    bibliografia = models.TextField(blank=True)
    grupo_objetivo = models.CharField(max_length=200, blank=True)
    requisitos_asistencia = models.TextField(blank=True)
    modalidad = models.CharField(max_length=20, choices=MODALIDAD_CHOICES, default='presencial')
    frecuencia = models.CharField(max_length=100, blank=True)
    horas_diarias = models.IntegerField(null=True, blank=True)
    material_didactico = models.TextField(blank=True)
    
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='borrador')
    fecha_presentacion = models.DateField(null=True, blank=True)
    fecha_aprobacion = models.DateField(null=True, blank=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Proyecto"
        verbose_name_plural = "Proyectos"
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        return f"{self.titulo} ({self.get_tipo_display()})"


class InformeFondo(models.Model):
    """Informes según Art. 28 del reglamento"""
    
    TIPO_CHOICES = [
        ('parcial', 'Informe Parcial'),
        ('final', 'Informe Final de Gestión'),
    ]
    
    CUMPLIMIENTO_CHOICES = [
        ('cumplido', 'Cumplido'),
        ('parcial', 'Cumplimiento Parcial'),
        ('incumplido', 'Incumplido'),
    ]
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='informes')
    elaborado_por = models.ForeignKey(User, on_delete=models.PROTECT, related_name='informes_elaborados')
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    fecha_elaboracion = models.DateField(auto_now_add=True)
    
    resumen_ejecutivo = models.TextField(help_text="Resumen de las actividades realizadas")
    actividades_realizadas = models.TextField(help_text="Detalle de actividades ejecutadas")
    resultados = models.TextField(help_text="Resultados obtenidos")
    logros = models.TextField(help_text="Logros alcanzados")
    dificultades = models.TextField(blank=True, help_text="Dificultades encontradas") 
    evidencias = models.TextField(blank=True, help_text="Evidencias de cumplimiento")
    observaciones = models.TextField(blank=True)
    
    cumplimiento = models.CharField(max_length=15, choices=CUMPLIMIENTO_CHOICES, blank=True)
    evaluacion_director = models.TextField(blank=True)
    fecha_evaluacion = models.DateField(null=True, blank=True)
    evaluado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='informes_evaluados')
    archivo_adjunto = models.FileField(
        upload_to='informes_evidencia/',
        null=True,
        blank=True,
        help_text="Archivo de evidencia adjunto al informe (PDF, ZIP, etc.)"
    )
    fecha_modificacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Informe de Fondo"
        verbose_name_plural = "Informes de Fondos"
        ordering = ['-fecha_elaboracion']
    
    def __str__(self):
        return f"Informe {self.get_tipo_display()} - {self.fondo_tiempo.docente.nombre_completo}"


class ObservacionFondo(models.Model):
    """Hilo de conversación de observaciones"""
    
    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='observaciones_detalladas')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    # Estado de resolución
    resuelta = models.BooleanField(default=False)
    resuelta_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='observaciones_resueltas')
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Observación"
        verbose_name_plural = "Observaciones"
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        return f"Observación #{self.id} - Fondo {self.fondo_tiempo.id}"
    
    def marcar_resuelta(self, usuario):
        """Marca el hilo como resuelto"""
        from django.utils import timezone
        self.resuelta = True
        self.resuelta_por = usuario
        self.fecha_resolucion = timezone.now()
        self.save()
    
    def reabrir(self):
        """Reabre el hilo si se agrega un nuevo mensaje"""
        if self.resuelta:
            self.resuelta = False
            self.resuelta_por = None
            self.fecha_resolucion = None
            self.save()


class MensajeObservacion(models.Model):
    """Mensaje individual dentro de un hilo de observación"""

    observacion = models.ForeignKey(ObservacionFondo, on_delete=models.CASCADE, related_name='mensajes')
    autor = models.ForeignKey(User, on_delete=models.PROTECT, related_name='mensajes_observacion')
    texto = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)
    es_admin = models.BooleanField(default=False)  # True si lo envió un admin/director
    
    class Meta:
        verbose_name = "Mensaje de Observación"
        verbose_name_plural = "Mensajes de Observación"
        ordering = ['fecha']
    
    def __str__(self):
        return f"Mensaje de {self.autor.username} - {self.fecha.strftime('%d/%m/%Y %H:%M')}"


class HistorialFondo(models.Model):
    """Historial de cambios para auditoría"""

    TIPO_CAMBIO_CHOICES = [
        ('creacion', 'Creación'),
        ('edicion', 'Edición'),
        ('presentacion', 'Presentación'),
        ('validacion', 'Validación'),
        ('aprobacion', 'Aprobación'),
        ('observacion', 'Observación'),
        ('rechazo', 'Rechazo'),
        ('inicio_ejecucion', 'Inicio de Ejecución'),
        ('informe_presentado', 'Informe Presentado'),
        ('finalizacion', 'Finalización'),
        ('archivado', 'Archivado'),
    ]

    fondo_tiempo = models.ForeignKey(FondoTiempo, on_delete=models.CASCADE, related_name='historial')
    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    fecha = models.DateTimeField(auto_now_add=True)
    tipo_cambio = models.CharField(max_length=20, choices=TIPO_CAMBIO_CHOICES)
    descripcion = models.TextField()
    estado_anterior = models.CharField(max_length=30, blank=True)
    estado_nuevo = models.CharField(max_length=30, blank=True)
    datos_cambio = models.JSONField(default=dict, blank=True, help_text="Snapshot de los datos modificados")

    class Meta:
        verbose_name = "Historial"
        verbose_name_plural = "Historiales"
        ordering = ['-fecha']
    
    def __str__(self):
        return f"{self.get_tipo_cambio_display()} - {self.fecha.strftime('%d/%m/%Y %H:%M')}"


class AsignacionCarrera(models.Model):
    """Vincula un usuario con una carrera, un rol y, opcionalmente, un docente."""

    ROLES = [
        ('iiisyp', 'Instituto I.I.S. y P.'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='asignaciones_carrera')
    carrera = models.ForeignKey(Carrera, on_delete=models.SET_NULL, null=True, blank=True, related_name='asignaciones_carrera')
    rol = models.CharField(max_length=20, choices=ROLES)
    docente = models.ForeignKey(Docente, on_delete=models.SET_NULL, null=True, blank=True, related_name='asignaciones_carrera')
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Asignación de Carrera"
        verbose_name_plural = "Asignaciones de Carrera"
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'carrera', 'rol'],
                name='uniq_usuario_carrera_rol_asignacion',
            ),
        ]

    def __str__(self):
        usuario = self.user.username if self.user else 'Sin usuario'
        carrera = self.carrera.nombre if self.carrera else 'Sin carrera'
        return f"{usuario} - {carrera} - {self.get_rol_display()}"


class PerfilUsuario(models.Model):
    """Perfil extendido para usuarios del sistema.

    Ahora incluye acceso a DatosLaborales para que los roles administrativos
    puros (Director, Jefe de Estudios, IIISYP) tengan sus propios derechos
    de vacaciones y feriados, aunque no tengan ficha de Docente.
    """

    ROLES = [
        ('iiisyp', 'Instituto I.I.S. y P.'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente'),
    ]

    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='perfil')
    docente = models.ForeignKey(Docente, on_delete=models.SET_NULL, null=True, blank=True, related_name='perfiles_usuario')

    # === Datos laborales: si el usuario es administrativo puro,
    #     tiene sus propios DatosLaborales. Si también es Docente,
    #     puede compartir los del docente (ver propiedad). ===
    datos_laborales = models.ForeignKey(
        DatosLaborales,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='perfiles',
        help_text="Datos de empleo para usuarios administrativos. "
                  "Si es null y tiene docente, se usan los del docente."
    )

    ci = models.CharField(max_length=20, blank=True, null=True, unique=True, verbose_name='Cedula de Identidad')
    rol = models.CharField(max_length=20, choices=ROLES, default='docente')
    carrera = models.ForeignKey(Carrera, on_delete=models.SET_NULL, null=True, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    foto_perfil = models.ImageField(upload_to='perfiles/', null=True, blank=True)
    foto_perfil_cifrada = models.BinaryField(null=True, blank=True, editable=False)
    foto_perfil_mime = models.CharField(max_length=64, blank=True, default='')
    debe_cambiar_password = models.BooleanField(default=True, help_text="Indica si el usuario debe cambiar su contraseña en el próximo inicio de sesión")
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Perfil de Usuario"
        verbose_name_plural = "Perfiles de Usuarios"
        constraints = [
            models.UniqueConstraint(
                fields=['carrera', 'rol'],
                name='unico_iiisyp_por_carrera',
                condition=models.Q(rol='iiisyp', activo=True)
            ),
            models.UniqueConstraint(
                fields=['carrera', 'rol'],
                name='unico_director_por_carrera',
                condition=models.Q(rol='director', activo=True)
            ),
            models.UniqueConstraint(
                fields=['carrera', 'rol'],
                name='unico_jefe_por_carrera',
                condition=models.Q(rol='jefe_estudios', activo=True)
            ),
        ]

    def __str__(self):
        username = self.user.username if self.user else 'Sin usuario'
        return f"{username} - {self.get_rol_display()}"

    # ================================================================
    # Acceso unificado a DatosLaborales (Docente y Administrativo)
    # ================================================================

    def obtener_datos_laborales(self):
        """
        Retorna los DatosLaborales de este usuario.

        Prioridad:
        1. Si tiene datos_laborales propios → los retorna
        2. Si tiene docente vinculado → retorna docente.datos_laborales
        3. Si no tiene ninguno → retorna None

        Esto garantiza que una persona con doble rol (ej: Director + Docente)
        tenga un solo saldo de vacaciones.
        """
        if self.datos_laborales:
            return self.datos_laborales
        if self.docente and self.docente.datos_laborales:
            return self.docente.datos_laborales
        return None

    @property
    def fecha_ingreso(self):
        """Accede a fecha_ingreso desde DatosLaborales (propio o del docente)."""
        datos = self.obtener_datos_laborales()
        return datos.fecha_ingreso if datos else None

    @property
    def dias_vacacion(self):
        """Accede a dias_vacacion desde DatosLaborales (propio o del docente)."""
        datos = self.obtener_datos_laborales()
        return datos.dias_vacacion if datos else 0

    @property
    def horas_feriados_gestion(self):
        """Accede a horas_feriados_gestion desde DatosLaborales."""
        datos = self.obtener_datos_laborales()
        return datos.horas_feriados_gestion if datos else 0

    def calcular_antiguedad(self, gestion=None):
        """Calcula la antigüedad en años."""
        datos = self.obtener_datos_laborales()
        if datos:
            return datos.calcular_antiguedad(gestion)
        return 0

    def calcular_dias_vacacion(self, gestion=None):
        """Calcula días de vacación según antigüedad (Art. 11 y 24)."""
        datos = self.obtener_datos_laborales()
        if datos:
            return datos.calcular_dias_vacacion(gestion)
        return 15

    # ================================================================
    # Métodos existentes
    # ================================================================

    def get_asignaciones_activas(self):
        if not self.user_id:
            return AsignacionCarrera.objects.none()
        return self.user.asignaciones_carrera.filter(activo=True).select_related('carrera', 'docente')

    def get_carreras_activas(self):
        if not self.user_id:
            return Carrera.objects.none()
        return Carrera.objects.filter(
            asignaciones_carrera__user=self.user,
            asignaciones_carrera__activo=True,
        ).distinct()

    def get_carrera_activa_id(self):
        return self.carrera_id

    @staticmethod
    def _get_cipher():
        key_from_env = getattr(settings, 'PROFILE_IMAGE_ENCRYPTION_KEY', '')
        if key_from_env:
            key = key_from_env.encode('utf-8') if isinstance(key_from_env, str) else key_from_env
        else:
            digest = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
            key = base64.urlsafe_b64encode(digest)
        return Fernet(key)

    def set_foto_perfil_cifrada(self, uploaded_file):
        image_bytes = uploaded_file.read()
        if not image_bytes:
            raise ValidationError("La imagen está vacía.")

        mime_type = getattr(uploaded_file, 'content_type', '') or 'image/jpeg'
        encrypted = self._get_cipher().encrypt(image_bytes)

        self.foto_perfil_cifrada = encrypted
        self.foto_perfil_mime = mime_type

        # Limpieza de compatibilidad: elimina el archivo físico si existía en el almacenamiento antiguo.
        if self.foto_perfil and self.foto_perfil.name:
            self.foto_perfil.delete(save=False)
        self.foto_perfil = None

    def clear_foto_perfil(self):
        if self.foto_perfil and self.foto_perfil.name:
            self.foto_perfil.delete(save=False)
        self.foto_perfil = None
        self.foto_perfil_cifrada = None
        self.foto_perfil_mime = ''

    def get_foto_perfil_data_uri(self):
        # Intenta primero con la foto propia del usuario
        if self.foto_perfil_cifrada:
            try:
                decrypted = self._get_cipher().decrypt(bytes(self.foto_perfil_cifrada))
                b64_image = base64.b64encode(decrypted).decode('ascii')
                mime = self.foto_perfil_mime or 'image/jpeg'
                return f"data:{mime};base64,{b64_image}"
            except InvalidToken:
                pass
        
        # Si no tiene foto propia, intenta usar la de su carrera asignada
        if self.carrera and self.carrera.logo_carrera_cifrada:
            try:
                # Usa el mismo cipher para desencriptar el logo de carrera
                decrypted = self._get_cipher().decrypt(bytes(self.carrera.logo_carrera_cifrada))
                b64_image = base64.b64encode(decrypted).decode('ascii')
                mime = self.carrera.logo_carrera_mime or 'image/jpeg'
                return f"data:{mime};base64,{b64_image}"
            except InvalidToken:
                pass
        
        # Sin foto propia ni carrera asignada, devuelve None
        return None


@receiver(post_save, sender=User)
def crear_perfil_usuario(sender, instance, created, **kwargs):
    if created:
        rol_inicial = 'iiisyp' if instance.is_superuser else 'docente'
        # Si es superusuario (creado por consola), no obligar cambio de contraseña
        debe_cambiar = not instance.is_superuser
        PerfilUsuario.objects.create(user=instance, rol=rol_inicial, debe_cambiar_password=debe_cambiar)

@receiver(post_save, sender=User)
def guardar_perfil_usuario(sender, instance, **kwargs):
    perfil = PerfilUsuario.objects.filter(user=instance).first()

    if not perfil:
        return

    updates = {'activo': instance.is_active}

    if instance.is_superuser:
        updates['rol'] = 'iiisyp'
        updates['debe_cambiar_password'] = False

    for field, value in updates.items():
        setattr(perfil, field, value)

    perfil.save(update_fields=list(updates.keys()))

@receiver(post_save, sender=Docente)
def crear_datos_laborales_si_no_existen(sender, instance, created, **kwargs):
    """
    Si un Docente se crea sin datos_laborales (migración legacy),
    crear un registro de DatosLaborales con sus datos actuales.
    """
    if not instance.datos_laborales_id:
        # Esto no debería pasar en código nuevo, pero es seguro para legacy
        datos, created_dl = DatosLaborales.objects.get_or_create(
            ci=instance.ci if hasattr(instance, 'ci') and instance.ci else f"TEMP_{instance.pk}",
            defaults={
                'fecha_ingreso': instance.fecha_ingreso if hasattr(instance, 'fecha_ingreso') else timezone.now().date(),
                'dias_vacacion': instance.dias_vacacion if hasattr(instance, 'dias_vacacion') else 15,
                'horas_feriados_gestion': instance.horas_feriados_gestion if hasattr(instance, 'horas_feriados_gestion') else 128,
            }
        )
        if created_dl:
            Docente.objects.filter(pk=instance.pk).update(datos_laborales=datos)

@receiver(post_save, sender=Actividad)
@receiver(post_delete, sender=Actividad)
def actualizar_horas_categoria(sender, instance, **kwargs):
    """Actualiza el total de horas de la categoría al modificar actividades"""
    categoria = instance.categoria
    total = categoria.actividades.aggregate(models.Sum('horas_año'))['horas_año__sum'] or 0
    categoria.total_horas = total
    categoria.save()

@receiver(post_save, sender=Docente)
def actualizar_fondos_docente(sender, instance, **kwargs):
    """
    Sincroniza los fondos de tiempo cuando cambian datos críticos del docente
    (antigüedad, vacaciones) para recalcular horas efectivas.
    """
    fondos = FondoTiempo.objects.filter(docente=instance)
    for fondo in fondos:
        fondo.save()

@receiver(post_save, sender=DocenteCarrera)
def actualizar_fondos_al_cambiar_vinculo(sender, instance, **kwargs):
    """
    Sincroniza los fondos de tiempo cuando cambia la dedicación del vínculo.
    """
    fondos = FondoTiempo.objects.filter(
        docente=instance.docente,
        carrera=instance.carrera
    )
    for fondo in fondos:
        fondo.save()


@receiver(post_save, sender=AsignacionCarrera)
@receiver(post_delete, sender=AsignacionCarrera)
def auto_poblar_responsable_carrera(sender, instance, **kwargs):
    """
    Cuando se asigna un director a una carrera, auto-pobla el campo
    'responsable' de la Carrera con el nombre completo del docente
    vinculado al director. Si no hay docente vinculado, usa el nombre
    del usuario.
    """
    if instance.rol != 'director' or not instance.activo:
        return

    carrera = getattr(instance, 'carrera', None)
    if not carrera:
        return

    # Determinar el nombre del responsable
    responsable_nombre = ''
    if instance.docente:
        responsable_nombre = instance.docente.nombre_completo
    elif instance.user:
        responsable_nombre = f"{instance.user.first_name} {instance.user.last_name}".strip() or instance.user.username

    if responsable_nombre and carrera.responsable != responsable_nombre:
        Carrera.objects.filter(pk=carrera.pk).update(responsable=responsable_nombre)


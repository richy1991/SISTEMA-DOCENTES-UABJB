# backend/core/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from catalogos.models import Direccion


class UsuarioPOA(models.Model):
    """
    Vincula a un Docente del sistema principal con un rol dentro del módulo POA.
    Controla quién puede elaborar, dirigir o revisar documentos POA.
    """
    ROL_CHOICES = [
        ('elaborador',      'Elaborador del POA'),
        ('director_carrera','Director de Carrera'),
        ('revisor_1',       'Entidad Revisora 1'),
        ('revisor_2',       'Entidad Revisora 2'),
        ('revisor_3',       'Entidad Revisora 3'),
        ('revisor_4',       'Entidad Revisora 4'),
    ]

    docente = models.ForeignKey(
        'fondos.Docente',
        on_delete=models.CASCADE,
        related_name='accesos_poa',
        verbose_name='Docente',
    )
    rol = models.CharField(max_length=30, choices=ROL_CHOICES, verbose_name='Rol POA')
    nombre_entidad = models.CharField(
        max_length=150, blank=True,
        help_text='Para roles de revisor: nombre de la entidad revisora (ej. DAF, VRA)',
    )
    activo = models.BooleanField(default=True)
    fecha_asignacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('docente', 'rol')]
        verbose_name = 'Usuario POA'
        verbose_name_plural = 'Usuarios POA'
        ordering = ['rol', 'docente__apellido_paterno']

    def __str__(self):
        return f"{self.docente.nombre_completo} — {self.get_rol_display()}"


class DocumentoPOA(models.Model):
    ESTADO_CHOICES = [
        ('elaboracion', 'En elaboración'),
        ('revision',    'En revisión'),
        ('aprobado',    'Aprobado'),
        ('ejecucion',   'En ejecución'),
    ]

    gestion = models.IntegerField(verbose_name="Año de Gestión")
    unidad_solicitante = models.CharField(max_length=200)
    programa = models.CharField(max_length=200)
    objetivo_gestion_institucional = models.TextField()
    elaborado_por = models.ForeignKey('UsuarioPOA', on_delete=models.SET_NULL, null=True, blank=True, related_name="documentos_elaborados")
    jefe_unidad = models.ForeignKey('UsuarioPOA', on_delete=models.SET_NULL, null=True, blank=True, related_name="documentos_jefe")
    fecha_elaboracion = models.DateField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='elaboracion', verbose_name='Estado')

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        # Evitar duplicados exactos: misma gestión + misma unidad + mismo programa
        unique_together = ('gestion', 'unidad_solicitante', 'programa')

    def __str__(self):
        return f"{self.programa} ({self.gestion})"

#objetivos especificos que pertenece a un solo documento poa

class ObjetivoEspecifico(models.Model):
    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name="objetivos")
    codigo = models.CharField(max_length=20, blank=True)
    descripcion = models.TextField()

    def __str__(self):
        return f"{self.codigo}: {self.descripcion[:50]}..."
    

#actividades que pertenece a un solo objetivo especifico    

class Actividad(models.Model):
    ESTADOS = [
        ('programado', 'Programado'),
        ('en_proceso', 'En Proceso'),
        ('ejecutado', 'Ejecutado'),
        ('suspendido', 'Suspendido'),
    ]

    UNIDADES_INDICADOR = [
        ('numero', 'Número'),
        ('porcentaje', 'Porcentaje'),
    ]

    objetivo = models.ForeignKey(ObjetivoEspecifico, on_delete=models.CASCADE, related_name="actividades")
    codigo = models.CharField(max_length=20)  # 510-0-1
    nombre = models.CharField(max_length=300)
    responsable = models.CharField(max_length=500)
    productos_esperados = models.TextField()
    mes_inicio = models.CharField(max_length=20)
    mes_fin = models.CharField(max_length=20)
    # Ahora almacenamos la descripción del indicador como texto libre (no FK)
    indicador_descripcion = models.TextField(null=True, blank=True)
    indicador_unidad = models.CharField(max_length=50, choices=UNIDADES_INDICADOR, default='numero')
    indicador_linea_base = models.IntegerField()
    indicador_meta = models.IntegerField()
    monto_funcion = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monto_inversion = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADOS, default='programado')

    @property
    def indicador_descripcion_texto(self):
        """Retorna solo la descripción del indicador"""
        # Antes indicador_descripcion era FK; ahora es texto, así que lo devolvemos directamente
        return self.indicador_descripcion if self.indicador_descripcion else None
    # Ya no validamos por FK en save() porque ahora se almacena texto libre.

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"



#detalle de los presupuestos solicitados por actividad

class DetallePresupuesto(models.Model):
    actividad = models.ForeignKey(Actividad, on_delete=models.CASCADE, related_name='detalles_presupuesto')
    TIPOS = [
        ('funcion', 'Funcionamiento'),
        ('funcionamiento', 'Funcionamiento'),  # alias para front
        ('inversion', 'Inversión'),
    ]
    tipo = models.CharField(max_length=20, choices=TIPOS, default='funcion', db_index=True)
    # Guardaremos los códigos/etiquetas como texto corto (no FK).
    # Usamos CharField para preservar formatos como ceros a la izquierda y
    # para mejorar búsquedas y validación en formularios.
    partida = models.CharField(max_length=50, db_index=True)
    item = models.CharField(max_length=150)
    unidad_medida = models.CharField(max_length=50)
    caracteristicas = models.TextField(blank=True)
    # En desarrollo se solicita que la cantidad sea un entero (número de unidades)
    cantidad = models.IntegerField()
    costo_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    costo_total = models.DecimalField(max_digits=12, decimal_places=2)
    mes_requerimiento = models.CharField(max_length=50)

    def save(self, *args, **kwargs):
        self.costo_total = self.cantidad * self.costo_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.actividad} - {self.item} ({self.cantidad})"
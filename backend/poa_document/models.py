# backend/core/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from catalogos.models import Direccion


class UsuarioPOA(models.Model):
    """
    Vincula a un usuario del sistema con un rol dentro del módulo POA.
    Controla quién puede elaborar, dirigir o revisar documentos POA.
    El campo docente es opcional para permitir usuarios que no son docentes.
    """
    ROL_CHOICES = [
        ('elaborador',      'Elaborador del POA'),
        ('director_carrera','Director de Carrera'),
        ('revisor_1',       'Entidad Revisora 1'),
        ('revisor_2',       'Entidad Revisora 2'),
        ('revisor_3',       'Entidad Revisora 3'),
        ('revisor_4',       'Entidad Revisora 4'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='accesos_poa',
        verbose_name='Usuario del sistema',
        null=True,
        blank=True,
    )
    docente = models.ForeignKey(
        'fondos.Docente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accesos_poa_docente',
        verbose_name='Docente vinculado',
    )
    rol = models.CharField(max_length=30, choices=ROL_CHOICES, verbose_name='Rol POA')
    nombre_entidad = models.CharField(
        max_length=150, blank=True,
        help_text='Para roles de revisor: nombre de la entidad revisora (ej. DAF, VRA)',
    )
    activo = models.BooleanField(default=True)
    fecha_asignacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Usuario POA'
        verbose_name_plural = 'Usuarios POA'
        ordering = ['rol', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'rol'],
                condition=models.Q(user__isnull=False),
                name='unique_user_rol_poa',
            ),
        ]

    def __str__(self):
        if self.user:
            nombre = self.user.get_full_name() or self.user.username
            return f"{nombre} — {self.get_rol_display()}"
        if self.docente:
            return f"{self.docente.nombre_completo} — {self.get_rol_display()}"
        return f"UsuarioPOA #{self.pk} — {self.get_rol_display()}"


class DocumentoPOA(models.Model):
    ESTADO_CHOICES = [
        ('elaboracion', 'En elaboración'),
        ('revision',    'En revisión'),
        ('observado',   'Observado'),
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
    # Comentarios/ajustes que registra la entidad revisora durante la revisión del documento.
    observaciones = models.TextField(blank=True, default='')
    ciclo_revision_actual = models.PositiveIntegerField(default=0)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        # Evitar duplicados exactos: misma gestión + misma unidad + mismo programa
        unique_together = ('gestion', 'unidad_solicitante', 'programa')

    def __str__(self):
        return f"{self.programa} ({self.gestion})"


class RevisionDocumentoPOA(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('aprobado', 'Aprobado'),
        ('observado', 'Observado'),
    ]

    TIPO_REVISOR_CHOICES = [
        ('entidad', 'Entidad Revisora'),
        ('director', 'Director de Carrera'),
    ]

    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name='revisiones')
    ciclo_revision = models.PositiveIntegerField(default=1)
    revisor = models.ForeignKey(UsuarioPOA, on_delete=models.PROTECT, related_name='revisiones_documento_poa')
    tipo_revisor = models.CharField(max_length=20, choices=TIPO_REVISOR_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    observaciones = models.TextField(blank=True, default='')
    fecha_asignacion = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(null=True, blank=True)
    respondido_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='respuestas_revision_poa')
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Revision de Documento POA'
        verbose_name_plural = 'Revisiones de Documento POA'
        ordering = ['tipo_revisor', 'fecha_asignacion']
        constraints = [
            models.UniqueConstraint(
                fields=['documento', 'ciclo_revision', 'revisor'],
                name='unique_revision_documento_poa_por_ciclo',
            ),
        ]

    def __str__(self):
        return f"Revision #{self.pk} - Documento {self.documento_id} - {self.revisor}"


class HistorialDocumentoPOA(models.Model):
    TIPO_EVENTO_CHOICES = [
        ('creacion', 'Creacion'),
        ('edicion', 'Edicion'),
        ('envio_revision', 'Envio a revision'),
        ('aprobacion_revision', 'Aprobacion de revision'),
        ('observacion_revision', 'Observacion de revision'),
        ('aprobacion_final', 'Aprobacion final'),
    ]

    documento = models.ForeignKey(DocumentoPOA, on_delete=models.CASCADE, related_name='historial')
    usuario = models.ForeignKey(User, on_delete=models.PROTECT, related_name='historial_documentos_poa')
    fecha = models.DateTimeField(auto_now_add=True)
    tipo_evento = models.CharField(max_length=30, choices=TIPO_EVENTO_CHOICES)
    descripcion = models.TextField()
    estado_anterior = models.CharField(max_length=30, blank=True)
    estado_nuevo = models.CharField(max_length=30, blank=True)
    datos_evento = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Historial de Documento POA'
        verbose_name_plural = 'Historiales de Documento POA'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.get_tipo_evento_display()} - Documento {self.documento_id}"

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


# ─── Sistema de conversaciones POA ────────────────────────────────────────────

class ComentarioPOA(models.Model):
    """
    Hilo de conversación vinculado a un DocumentoPOA.
    Permite la comunicación entre el elaborador y la entidad revisora.
    Los hilos se eliminan automáticamente cuando la gestión finaliza
    (se sugiere una tarea periódica o señal en base al campo gestion).
    """
    documento = models.ForeignKey(
        DocumentoPOA,
        on_delete=models.CASCADE,
        related_name='comentarios',
        verbose_name='Documento POA',
    )
    # Copia del año de gestión para facilitar la limpieza por gestión
    gestion = models.IntegerField(verbose_name='Año de Gestión', db_index=True)
    abierto = models.BooleanField(default=True, verbose_name='Hilo activo')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Conversación POA'
        verbose_name_plural = 'Conversaciones POA'
        ordering = ['-creado_en']

    def save(self, *args, **kwargs):
        if not self.gestion and self.documento_id:
            self.gestion = self.documento.gestion
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Conversación #{self.pk} — Doc POA {self.documento_id} ({self.gestion})"


class MensajeComentarioPOA(models.Model):
    """Mensaje individual dentro de un hilo de conversación POA."""

    comentario = models.ForeignKey(
        ComentarioPOA,
        on_delete=models.CASCADE,
        related_name='mensajes',
        verbose_name='Hilo de conversación',
    )
    autor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='mensajes_poa',
        verbose_name='Autor',
    )
    texto = models.TextField(verbose_name='Mensaje')
    # True si el mensaje lo envió un revisor/director (no el elaborador)
    es_revisor = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mensaje POA'
        verbose_name_plural = 'Mensajes POA'
        ordering = ['fecha']

    def __str__(self):
        return f"Mensaje de {self.autor.username} — {self.fecha.strftime('%d/%m/%Y %H:%M')}"
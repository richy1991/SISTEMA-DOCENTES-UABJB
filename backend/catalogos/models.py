from django.db import models

class ItemCatalogo(models.Model):
    detalle = models.CharField(max_length=255, default='')
    unidad_medida = models.CharField(max_length=50, default="Sin unidad")
    partida = models.CharField(max_length=50, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['partida']),
        ]

    def __str__(self):
        return self.detalle

class Direccion(models.Model):
    nombre = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.nombre

class OperacionCatalogo(models.Model):
    # Referencia directa a la clase Direccion definida en este módulo (evita string key a otra app)
    direccion = models.ForeignKey(Direccion, on_delete=models.CASCADE)
    servicio = models.CharField(max_length=200)
    proceso = models.CharField(max_length=200)
    operacion = models.CharField(max_length=300)
    producto_intermedio = models.CharField(max_length=300, blank=True)
    indicador = models.TextField(blank=True)

    def __str__(self):
        return self.operacion

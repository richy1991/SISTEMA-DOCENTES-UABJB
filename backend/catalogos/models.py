from django.db import models

class PartidaPresupuestaria(models.Model):
    nombre = models.CharField(max_length=255)
    codigo = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

class ItemCatalogo(models.Model):
    descripcion = models.CharField(max_length=255, default="Sin descripción")
    unidad_medida = models.CharField(max_length=50, default="Sin unidad")
    partida = models.ForeignKey(PartidaPresupuestaria, on_delete=models.CASCADE, related_name='items', default=1)

    def __str__(self):
        return self.descripcion

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

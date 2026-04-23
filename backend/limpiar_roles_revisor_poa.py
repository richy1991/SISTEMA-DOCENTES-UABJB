#!/usr/bin/env python
"""
Script para limpiar roles de entidades revisoras del módulo POA de la base de datos.
Elimina los accesos de tipo revisor_1, revisor_2, revisor_3, revisor_4.
"""
import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from poa_document.models import UsuarioPOA

def limpiar_roles_revisor():
    """Elimina los roles de entidad revisora."""
    roles_a_eliminar = ['revisor_1', 'revisor_2', 'revisor_3', 'revisor_4']

    print("=" * 60)
    print("LIMPIEZA DE ROLES DE ENTIDAD REVISORA - MÓDULO POA")
    print("=" * 60)

    # Contar antes
    for rol in roles_a_eliminar:
        count = UsuarioPOA.objects.filter(rol=rol).count()
        print(f"  {rol}: {count} registros")

    # Eliminar
    eliminados = UsuarioPOA.objects.filter(rol__in=roles_a_eliminar).delete()
    print(f"\nTotal eliminados: {eliminados[0]} registros")

    # Verificar limpieza
    print("\nVerificación post-limpieza:")
    for rol in roles_a_eliminar:
        count = UsuarioPOA.objects.filter(rol=rol).count()
        print(f"  {rol}: {count} registros")

    # Mostrar accesos restantes
    print("\n" + "=" * 60)
    print("ACCESOS POA RESTANTES:")
    print("=" * 60)
    for acceso in UsuarioPOA.objects.all().select_related('user'):
        print(f"  - {acceso.user.username if acceso.user else 'Sin usuario'} | {acceso.rol} | Activo: {acceso.activo}")

    print("\n¡Limpieza completada!")

if __name__ == '__main__':
    limpiar_roles_revisor()
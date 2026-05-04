"""
Script de Diagnóstico: Identifica y Recupera Usuarios Inactivos
================================================================
Este script detecta usuarios que se han marcado como inactivos y permite
reactivarlos para que vuelvan a ser visibles en el sistema.

Uso:
    python diagnosticar_usuarios.py [listar|activar_todo]

Ejemplos:
    python diagnosticar_usuarios.py listar          # Muestra usuarios inactivos
    python diagnosticar_usuarios.py activar_todo    # Reactiva todos los usuarios inactivos
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario

def listar_usuarios_inactivos():
    """Lista todos los usuarios inactivos en el sistema"""
    print("\n" + "="*80)
    print("REPORTE DE USUARIOS INACTIVOS EN EL SISTEMA")
    print("="*80)
    
    inactivos = User.objects.filter(is_active=False)
    
    if not inactivos.exists():
        print("\n✓ BIEN: No hay usuarios inactivos en el sistema.")
        print("\n" + "="*80)
        return
    
    print(f"\n⚠️  ENCONTRADOS: {inactivos.count()} usuario(s) inactivo(s)\n")
    print("-"*80)
    print(f"{'ID':<4} {'Username':<20} {'Email':<30} {'Rol':<15} {'Vinculado a Docente':<15}")
    print("-"*80)
    
    for user in inactivos:
        perfil = getattr(user, 'perfil', None)
        rol = perfil.rol if perfil else 'N/A'
        tiene_docente = 'SI' if (perfil and perfil.docente_id) else 'NO'
        email = user.email or 'N/A'
        
        print(f"{user.id:<4} @{user.username:<19} {email:<30} {str(rol):<15} {tiene_docente:<15}")
    
    print("-"*80)
    print("\n💡 Estos usuarios no aparecerán en búsquedas ni en el gestor de usuarios")
    print("   hasta que se reactiven.\n")
    print("="*80)

def activar_todos_usuarios():
    """Reactiva todos los usuarios inactivos"""
    print("\n" + "="*80)
    print("REACTIVACION DE USUARIOS INACTIVOS")
    print("="*80)
    
    inactivos = User.objects.filter(is_active=False)
    
    if not inactivos.exists():
        print("\n✓ No hay usuarios inactivos para reactivar.")
        print("="*80)
        return
    
    print(f"\nSe reactivarán {inactivos.count()} usuario(s).\n")
    print("¿Deseas continuar? (escribe 'SI' para confirmar)")
    confirmacion = input("> ").strip().upper()
    
    if confirmacion != 'SI':
        print("\n❌ Operación cancelada.")
        print("="*80)
        return
    
    reactivados = 0
    for user in inactivos:
        user.is_active = True
        user.save(update_fields=['is_active'])
        reactivados += 1
        print(f"  ✓ Reactivado: @{user.username}")
    
    print("\n" + "-"*80)
    print(f"✅ {reactivados} usuario(s) reactivado(s) correctamente.")
    print("-"*80)
    print("\nEstos usuarios ahora serán visibles en:")
    print("  • Gestor de Usuarios")
    print("  • Búsqueda de contactos para chat")
    print("  • Búsqueda de usuarios para asignar roles")
    print("\n" + "="*80)

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print(f"Uso: python {sys.argv[0]} [listar|activar_todo]\n")
        return
    
    comando = sys.argv[1].lower()
    
    if comando == 'listar':
        listar_usuarios_inactivos()
    elif comando == 'activar_todo':
        activar_todos_usuarios()
    else:
        print(f"❌ Comando '{comando}' no reconocido.")
        print(f"Uso: python {sys.argv[0]} [listar|activar_todo]")

if __name__ == '__main__':
    main()

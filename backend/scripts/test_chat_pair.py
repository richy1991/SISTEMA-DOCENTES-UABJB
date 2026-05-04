#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from poa_document.models import MensajeChat
from poa_document.api.views import MensajeChatViewSet
from rest_framework.test import APIRequestFactory

User = get_user_model()

def main():
    u1, _ = User.objects.get_or_create(username='test_sender', defaults={'email':'s@x.com'})
    u2, _ = User.objects.get_or_create(username='test_receiver', defaults={'email':'r@x.com'})

    # Clean previous messages between them
    MensajeChat.objects.filter((__import__('django.db.models').Q(emisor=u1) & __import__('django.db.models').Q(receptor=u2)) | (__import__('django.db.models').Q(emisor=u2) & __import__('django.db.models').Q(receptor=u1))).delete()

    MensajeChat.objects.create(emisor=u1, receptor=u2, texto='hola desde u1')
    MensajeChat.objects.create(emisor=u2, receptor=u1, texto='respuesta de u2')

    factory = APIRequestFactory()
    request = factory.get('/api/poa/mensajes-chat/', {'peer_user_id': str(u2.id)})
    request.user = u1

    view = MensajeChatViewSet()
    view.request = request
    qs = view.get_queryset()

    print('Mensajes recuperados para user', u1.username, 'con peer', u2.username)
    for m in qs:
        print(m.id, m.emisor_id, '->', m.receptor_id, ':', m.texto)

if __name__ == '__main__':
    main()

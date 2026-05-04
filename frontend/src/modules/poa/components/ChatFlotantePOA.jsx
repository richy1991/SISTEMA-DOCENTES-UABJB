import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, SendHorizontal, X, ChevronDown, Search, Trash2, Ban, MoreVertical } from 'lucide-react';
import Dialog from './base/Dialog';
import {
  getChatContactosPOA,
  buscarUsuariosChatPOA,
  getMensajesChatPOA,
  enviarMensajeChatPOA,
  vaciarChatPOA,
  getEstadoBloqueoChatPOA,
  bloquearUsuarioChatPOA,
  desbloquearUsuarioChatPOA,
} from '../../../apis/poa.api';

const toNumericId = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const resolveUserId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return toNumericId(value);
  const candidates = [value?.id, value?.user_id, value?.pk, value?.user?.id, value?.user?.pk, value?.user_detalle?.id];
  for (const candidate of candidates) {
    const resolved = toNumericId(candidate);
    if (resolved) return resolved;
  }
  return null;
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const formatNombre = (contacto) => contacto?.nombre_completo || contacto?.nombre || contacto?.username || 'Usuario';

const isConnectionRefused = (err) => {
  const code = err?.code || err?.cause?.code;
  const message = String(err?.message || '').toLowerCase();
  return code === 'ERR_NETWORK' || message.includes('connection refused') || !err?.response;
};

const isAuthExpired = (err) => {
  const status = err?.response?.status;
  return status === 401 || status === 403;
};

function ChatFlotantePOA({ currentUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loadingContactos, setLoadingContactos] = useState(false);
  const [contactosSugeridos, setContactosSugeridos] = useState([]);
  const [contactosRecientes, setContactosRecientes] = useState([]);
  const [contactoDefault, setContactoDefault] = useState(null);
  const [requiereSeleccion, setRequiereSeleccion] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showVaciarDialog, setShowVaciarDialog] = useState(false);
  const [bloqueoEstado, setBloqueoEstado] = useState({ bloqueado_por_mi: false, bloqueado_por_peer: false });
  const [alertaAsignacion, setAlertaAsignacion] = useState(null);
  const [pollingPaused, setPollingPaused] = useState(false);
  const searchContainerRef = useRef(null);
  const chatListRef = useRef(null);
  const actionsMenuRef = useRef(null);
  const notifiedConnectionRef = useRef(false);

  const currentUserSnapshot = useMemo(() => currentUser || getStoredUser(), [currentUser]);
  const [localCurrentUser, setLocalCurrentUser] = useState(currentUserSnapshot);
  const currentUserId = useMemo(() => resolveUserId(localCurrentUser), [localCurrentUser]);
  const currentUsername = useMemo(() => String(localCurrentUser?.username || '').toLowerCase(), [localCurrentUser]);
  const peerActual = selectedPeer || contactoDefault || (alertaAsignacion ? null : contactosRecientes[0] || contactosSugeridos[0] || null);
  const peerActualId = resolveUserId(peerActual);
  const chatsActivos = useMemo(() => {
    const pool = [...contactosRecientes, ...contactosSugeridos];
    const seen = new Set();
    const unique = [];
    for (const contacto of pool) {
      const id = resolveUserId(contacto);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(contacto);
    }
    return unique;
  }, [contactosRecientes, contactosSugeridos]);

  const formatHora = useCallback((fecha) => {
    if (!fecha) return '';
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const fetchEstadoBloqueo = useCallback(async (peerId) => {
    if (!peerId) {
      setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
      return;
    }
    try {
      const res = await getEstadoBloqueoChatPOA(peerId);
      const data = res?.data || {};
      setBloqueoEstado({
        bloqueado_por_mi: Boolean(data.bloqueado_por_mi),
        bloqueado_por_peer: Boolean(data.bloqueado_por_peer),
      });
    } catch {
      setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
    }
  }, []);

  const fetchMensajes = useCallback(async (peerId, options = {}) => {
    const { silent = false } = options;
    if (!peerId) return;
    if (!silent) setLoadingMensajes(true);
    try {
      const res = await getMensajesChatPOA(peerId);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const listFiltered = list.filter((msg) => {
        const emisorId = resolveUserId(msg?.emisor || msg?.autor);
        const receptorId = resolveUserId(msg?.receptor || msg?.destinatario);
        if (!currentUserId) return true;
        return (
          (emisorId === currentUserId && receptorId === peerId) ||
          (emisorId === peerId && receptorId === currentUserId)
        );
      });
      setMensajes(listFiltered);
      setPollingPaused(false);
      notifiedConnectionRef.current = false;
    } catch (err) {
      if (isAuthExpired(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('Tu sesión expiró. Vuelve a iniciar sesión.');
          notifiedConnectionRef.current = true;
        }
        return;
      }
      if (!silent) setMensajes([]);
      const refused = isConnectionRefused(err);
      if (refused) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('No hay conexión con el servidor de chat.');
          notifiedConnectionRef.current = true;
        }
      } else if (!silent) {
        toast.error('No se pudo cargar el chat.');
      }
    } finally {
      if (!silent) setLoadingMensajes(false);
    }
  }, [currentUserId]);

  const cargarContactos = async () => {
    setLoadingContactos(true);
    try {
      const res = await getChatContactosPOA();
      const data = res.data || {};
      const list = Array.isArray(data.contactos) ? data.contactos : [];
      const recientes = Array.isArray(data.contactos_recientes) ? data.contactos_recientes : [];
      const defaultContact = data.contacto_default || null;
      const alerta = data.alerta_asignacion || null;
      setContactosSugeridos(list);
      setContactosRecientes(recientes);
      setContactoDefault(defaultContact);
      setRequiereSeleccion(Boolean(data.requiere_seleccion));
      setAlertaAsignacion(alerta);

      const autoSelected = alerta
        ? null
        : (defaultContact && resolveUserId(defaultContact)
          ? defaultContact
          : (recientes.length === 1 ? recientes[0] : (list.length === 1 ? list[0] : null)));

      if (autoSelected && !alerta) {
        setSelectedPeer(autoSelected);
        await fetchEstadoBloqueo(resolveUserId(autoSelected));
        await fetchMensajes(resolveUserId(autoSelected), { silent: false });
      } else {
        setSelectedPeer(null);
        setMensajes([]);
        setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
      }
    } catch (err) {
      if (isAuthExpired(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('Tu sesión expiró. Vuelve a iniciar sesión.');
          notifiedConnectionRef.current = true;
        }
        return;
      }
      setContactosSugeridos([]);
      setContactosRecientes([]);
      setContactoDefault(null);
      setRequiereSeleccion(false);
      setAlertaAsignacion(null);
      setSelectedPeer(null);
      setMensajes([]);
      if (isConnectionRefused(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('Servidor desconectado. Verifica que Django esté ejecutándose en 127.0.0.1:8000.');
          notifiedConnectionRef.current = true;
        }
      } else {
        toast.error(err?.response?.data?.detail || 'No se pudieron cargar los contactos.');
      }
    } finally {
      setLoadingContactos(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const init = async () => {
      // si no hay usuario resuelto, pedir al backend
      if (!currentUserSnapshot || !resolveUserId(currentUserSnapshot)) {
        try {
          const res = await getCurrentUserPOA();
          setLocalCurrentUser(res.data || null);
        } catch (e) {
          // ignore, seguir con lo que haya
        }
      }
      await cargarContactos();
    };
    init();
  }, [open]);

  useEffect(() => {
    if (!open || !peerActualId || pollingPaused) return undefined;
    const intervalId = window.setInterval(() => {
      fetchMensajes(peerActualId, { silent: true });
    }, 1800);
    return () => window.clearInterval(intervalId);
  }, [open, peerActualId, fetchMensajes, pollingPaused]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearch(false);
      }
      if (chatListRef.current && !chatListRef.current.contains(event.target)) {
        setShowChatList(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBuscar = async (value) => {
    setSearch(value);
    const q = String(value || '').trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await buscarUsuariosChatPOA(q);
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const filtered = list.filter((u) => resolveUserId(u) !== currentUserId);
      setSearchResults(filtered.slice(0, 10));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const seleccionarContacto = async (contacto) => {
    const peerId = resolveUserId(contacto);
    if (!peerId) return;
    setSelectedPeer(contacto);
    setBloqueoEstado({ bloqueado_por_mi: false, bloqueado_por_peer: false });
    setShowChatList(false);
    setShowActionsMenu(false);
    await fetchEstadoBloqueo(peerId);
    await fetchMensajes(peerId, { silent: false });
  };

  useEffect(() => {
    if (!open) return;
    fetchEstadoBloqueo(peerActualId);
  }, [open, peerActualId, fetchEstadoBloqueo]);

  const handleToggleBloqueo = async () => {
    const peerId = resolveUserId(peerActual);
    if (!peerId) {
      toast.error('Selecciona un contacto.');
      return;
    }
    try {
      if (bloqueoEstado.bloqueado_por_mi) {
        await desbloquearUsuarioChatPOA(peerId);
        toast.success('Usuario desbloqueado.');
      } else {
        await bloquearUsuarioChatPOA(peerId);
        toast.success('Usuario bloqueado.');
      }
      await fetchEstadoBloqueo(peerId);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo actualizar el bloqueo.');
    } finally {
      setShowActionsMenu(false);
    }
  };

  const handleEnviar = async () => {
    const textoLimpio = String(texto || '').trim();
    const peerId = resolveUserId(selectedPeer || contactoDefault || contactosRecientes[0] || contactosSugeridos[0]);

    if (!peerId) {
      toast.error('No hay un contacto disponible para chat.');
      return;
    }
    if (bloqueoEstado.bloqueado_por_mi) {
      toast.error('Desbloquea al usuario para enviar mensajes.');
      return;
    }
    if (bloqueoEstado.bloqueado_por_peer) {
      toast.error('Este usuario te bloqueó y no puede recibir mensajes.');
      return;
    }
    if (textoLimpio.length < 2) {
      toast.error('Escribe un mensaje valido.');
      return;
    }

    setSending(true);
    try {
      await enviarMensajeChatPOA(peerId, textoLimpio);
      setTexto('');
      if (!selectedPeer) {
        const pool = [...contactosRecientes, ...contactosSugeridos];
        const peer = selectedPeer || contactoDefault || pool.find((c) => resolveUserId(c) === peerId) || null;
        if (peer) setSelectedPeer(peer);
      }
      await fetchMensajes(peerId, { silent: true });
    } catch (err) {
      if (isConnectionRefused(err)) {
        setPollingPaused(true);
        if (!notifiedConnectionRef.current) {
          toast.error('No hay conexión con el servidor de chat.');
          notifiedConnectionRef.current = true;
        }
        return;
      }
      toast.error(err?.response?.data?.detail || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleVaciarChat = async () => {
    const peerId = resolveUserId(selectedPeer || contactoDefault || contactosRecientes[0] || contactosSugeridos[0]);
    if (!peerId) {
      toast.error('Selecciona un contacto para vaciar el chat.');
      return;
    }
    setShowVaciarDialog(true);
  };

  const confirmarVaciarChat = async () => {
    const peerId = resolveUserId(selectedPeer || contactoDefault || contactosRecientes[0] || contactosSugeridos[0]);
    if (!peerId) return;
    try {
      await vaciarChatPOA(peerId);
      setMensajes([]);
      await cargarContactos();
      toast.success('Chat vaciado correctamente.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo vaciar el chat.');
    } finally {
      setShowChatList(false);
    }
  };

  const listaVisible = search.trim().length >= 2 ? searchResults : null;

  const renderContacto = (contacto, extraClass = '') => {
    const id = resolveUserId(contacto);
    const activo = id && id === peerActualId;
    return (
      <button
        key={id || String(contacto?.username || Math.random())}
        onClick={() => seleccionarContacto(contacto)}
        className={`w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${activo ? 'bg-cyan-700/35 border-cyan-500/60 text-white' : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-100'} ${extraClass}`}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{formatNombre(contacto)}</p>
          <p className="text-[11px] text-slate-400 truncate">@{contacto?.username || 'sin-usuario'}</p>
          {contacto?.ultimo_mensaje && (
            <p className="text-[11px] text-slate-400 truncate mt-1">{contacto.ultimo_mensaje}</p>
          )}
        </div>
        <ChevronDown size={14} className={`shrink-0 ${activo ? 'text-cyan-200 rotate-180' : 'text-slate-500'}`} />
      </button>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-[5.5rem] right-32 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center text-white z-[121] bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700 border-2 border-white/25"
        title="Mensajes"
      >
        <MessageCircle size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[122]">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-6 bottom-24 w-[390px] max-w-[calc(100vw-1.5rem)] h-[640px] max-h-[calc(100vh-8rem)] rounded-3xl border border-cyan-300/30 bg-slate-950/95 overflow-hidden shadow-2xl flex flex-col">
            <div className="relative z-20 border-b border-slate-700 bg-gradient-to-r from-cyan-600 to-teal-600">
              <div className="px-4 py-3 flex items-center gap-2">
                <MessageCircle size={16} className="text-white" />
                <div className="text-white font-bold text-sm truncate">
                  {peerActual ? ` ${formatNombre(peerActual)}` : 'Chat'}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => {
                      setShowSearch((prev) => !prev);
                      setShowChatList(false);
                    }}
                    className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center"
                    title="Buscar usuario"
                  >
                    <Search size={15} />
                  </button>
                  <div className="relative" ref={chatListRef}>
                    <button
                      onClick={() => {
                        setShowChatList((prev) => !prev);
                        setShowSearch(false);
                      }}
                      className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center"
                      title="Historial de chats"
                    >
                      <ChevronDown size={15} className={showChatList ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    {showChatList && (
                      <div className="absolute right-0 top-10 w-72 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 shadow-2xl p-2 space-y-2 z-[140]">
                        {loadingContactos && <p className="text-xs text-slate-400 px-2 py-1">Cargando chats...</p>}
                        {!loadingContactos && chatsActivos.length === 0 && (
                          <p className="text-xs text-slate-400 px-2 py-1">No hay chats activos.</p>
                        )}
                        {!loadingContactos && chatsActivos.map((contacto) => renderContacto(contacto))}
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={actionsMenuRef}>
                    <button
                      onClick={() => {
                        setShowActionsMenu((prev) => !prev);
                        setShowChatList(false);
                        setShowSearch(false);
                      }}
                      className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center"
                      title="Opciones"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {showActionsMenu && (
                      <div className="absolute right-0 top-10 w-52 rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden z-[140]">
                        <button
                          onClick={handleVaciarChat}
                          className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800 flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Vaciar chat
                        </button>
                        <button
                          onClick={handleToggleBloqueo}
                          className="w-full px-3 py-2 text-left text-sm text-amber-300 hover:bg-amber-500/10 flex items-center gap-2"
                        >
                          <Ban size={14} /> {bloqueoEstado.bloqueado_por_mi ? 'Desbloquear usuario' : 'Bloquear usuario'}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center"
                    title="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {alertaAsignacion && (
                <div className="px-3 pb-3">
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-950/80 px-3 py-3 text-amber-100 shadow-xl">
                    <p className="text-sm font-bold">{alertaAsignacion.titulo}</p>
                    <p className="text-xs text-amber-100/85 mt-1 leading-relaxed">{alertaAsignacion.mensaje}</p>
                    <button
                      type="button"
                      onClick={() => navigate(alertaAsignacion.link || '/poa/accesos')}
                      className="mt-3 inline-flex items-center justify-center rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors"
                    >
                      {alertaAsignacion.texto_link || 'Asignar'}
                    </button>
                  </div>
                </div>
              )}

              {showSearch && (
                <div className="px-3 pb-3" ref={searchContainerRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => handleBuscar(e.target.value)}
                      placeholder="Buscar usuario por nombre o usuario"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm outline-none focus:border-cyan-500"
                    />
                  </div>
                  {searching && <p className="text-xs text-cyan-100/80 mt-2">Buscando...</p>}
                  {search.trim().length >= 2 && (
                    <div className="mt-2 max-h-44 overflow-y-auto pr-1 space-y-2">
                      {listaVisible.length > 0 ? (
                        listaVisible.map((contacto) => renderContacto(contacto))
                      ) : (
                        <p className="text-xs text-cyan-100/80">Sin resultados.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="relative flex-1 overflow-y-auto p-3 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[size:14px_14px]">
              {!peerActual && !loadingContactos && (
                <p className="text-xs text-slate-300 bg-slate-900/70 inline-block px-2 py-1 rounded">Selecciona un contacto para ver el chat.</p>
              )}
              {peerActual && loadingMensajes && <p className="text-xs text-slate-300">Cargando mensajes...</p>}
              {peerActual && !loadingMensajes && mensajes.length === 0 && (
                <p className="text-xs text-slate-300 bg-slate-900/70 inline-block px-2 py-1 rounded">No hay mensajes todavía.</p>
              )}
              {mensajes.map((msg) => {
                const autorId = resolveUserId(msg?.emisor || msg?.autor);
                const autorUsername = String(msg?.emisor_username || msg?.autor_username || '').toLowerCase();
                const esMio = (currentUserId && autorId === currentUserId) || (!!currentUsername && autorUsername === currentUsername);
                return (
                  <div key={msg.id} className={`mb-2 flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 border ${esMio ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-white text-slate-900 border-slate-200'}`}>
                      <p className="text-sm break-words">{msg?.texto}</p>
                      <p className={`text-[10px] mt-1 text-right ${esMio ? 'text-cyan-100/90' : 'text-slate-500'}`}>
                        {formatHora(msg?.fecha)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {peerActual && (bloqueoEstado.bloqueado_por_mi || bloqueoEstado.bloqueado_por_peer) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
                  <div className="max-w-xs rounded-xl border border-amber-600/50 bg-amber-950/85 text-amber-100 text-center text-sm px-4 py-3 shadow-xl">
                    {bloqueoEstado.bloqueado_por_peer
                      ? `${formatNombre(peerActual)} te bloqueo.`
                      : 'Bloqueado.'}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-700 bg-slate-900">
              <div className="flex items-center gap-2">
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEnviar();
                    }
                  }}
                  placeholder={
                    bloqueoEstado.bloqueado_por_peer
                      ? 'No puedes enviar mensajes a este usuario'
                      : bloqueoEstado.bloqueado_por_mi
                        ? 'Usuario bloqueado por ti'
                        : (peerActual ? 'Escribe un mensaje...' : 'Selecciona un contacto primero')
                  }
                  disabled={
                    sending ||
                    bloqueoEstado.bloqueado_por_mi ||
                    bloqueoEstado.bloqueado_por_peer ||
                    (!peerActual && contactosSugeridos.length === 0 && contactosRecientes.length === 0)
                  }
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <button
                  onClick={handleEnviar}
                  disabled={
                    sending ||
                    bloqueoEstado.bloqueado_por_mi ||
                    bloqueoEstado.bloqueado_por_peer ||
                    (!peerActual && contactosSugeridos.length === 0 && contactosRecientes.length === 0)
                  }
                  className="w-10 h-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white flex items-center justify-center"
                >
                  <SendHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={showVaciarDialog}
        type="warning"
        title="Vaciar chat"
        message="¿Seguro que deseas vaciar este chat? Esta acción eliminará los mensajes de ambos lados."
        confirmText="Aceptar"
        cancelText="Cancelar"
        onConfirm={confirmarVaciarChat}
        onCancel={() => setShowVaciarDialog(false)}
        onClose={() => setShowVaciarDialog(false)}
      />
    </>
  );
}

export default ChatFlotantePOA;

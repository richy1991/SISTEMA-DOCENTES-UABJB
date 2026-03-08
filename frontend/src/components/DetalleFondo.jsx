import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { getFondoTiempoDetalle, crearActividad, eliminarActividad, presentarFondoADirector, aprobarFondo } from '../apis/api';
import api from '../apis/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import DistribuirHoras from './DistribuirHoras';
import FormularioActividad from './FormularioActividad';
import FormularioObservar from './FormularioObservar';
import BotonFlotanteObservaciones from './BotonFlotanteObservaciones';
import FormularioPresentarInforme from './FormularioPresentarInforme';
import FormularioEvaluarInforme from './FormularioEvaluarInforme';
import ThemeToggle from './ThemeToggle';
import CargaHorariaManager from './CargaHorariaManager';
import toast from 'react-hot-toast';
import ValidacionRequisitos from './ValidacionRequisitos';
import PDFPreviewModal from './PDFPreviewModal';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
const CATEGORIAS_BLOQUEADAS = [];

// --- ICONOS ---
const PaperAirplaneIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const ExclamationTriangleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
  </svg>
);

const CheckBadgeIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowPathIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-3.181-3.182l-3.182 3.182m0 0a8.25 8.25 0 01-11.664 0l-3.182-3.182" />
  </svg>
);

const PlusIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const LockClosedIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const PlayCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
  </svg>
);

const DocumentTextIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DocumentMagnifyingGlassIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const PencilIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
  </svg>
);

const TrashIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const DocenteIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.221 69.17 69.17 0 00-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
  </svg>
);

const InvestigacionIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

const ExtensionIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.963A3.426 3.426 0 0012 15.75c1.262 0 2.427-.393 3.379-1.085m-6.758 0a3.426 3.426 0 01-3.379-1.085 3.426 3.426 0 01-3.379 1.085C4.26 15.366 3 16.827 3 18.75V19.5a.75.75 0 00.75.75h12.586a.75.75 0 00.75-.75v-.75c0-1.923-1.26-3.384-3.006-3.963zM12 6a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
  </svg>
);

const AsesoriasIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

const TribunalesIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
  </svg>
);

const AdministrativoIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.67.38m-4.5-8.006c-1.572-.236-3.176-.387-4.812-.387s-3.24.15-4.812.387m4.812 0v4.5m0-4.5c.325 0 .649.01.976.029.935.058 1.848.179 2.735.357.811.16 1.596.374 2.343.633.587.204 1.144.457 1.66.754.516.336.991.75 1.39 1.238.358.397.667.857.914 1.368.204.42.36.877.463 1.352M6.75 14.15c-.194.165-.42.295-.67.38m0 0c-.877.294-1.593.766-2.09 1.337A2.18 2.18 0 003.75 17.385v2.866M6.75 14.15a2.18 2.18 0 01.75-1.661V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
);

const VidaUniversitariaIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
  </svg>
);

const ExternalLinkIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

const CATEGORY_ICONS = {
  'docente': DocenteIcon,
  'investigacion': InvestigacionIcon,
  'extension': ExtensionIcon,
  'asesorias': AsesoriasIcon,
  'tribunales': TribunalesIcon,
  'administrativo': AdministrativoIcon,
  'vida_universitaria': VidaUniversitariaIcon,
};

function DetalleFondo({ isDark }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [fondo, setFondo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [error, setError] = useState(null);
  const [mostrarFormActividad, setMostrarFormActividad] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [mostrarFormObservar, setMostrarFormObservar] = useState(false);
  const [mostrarModalAprobar, setMostrarModalAprobar] = useState(false);
  const observacionesRef = useRef();
  const [observacionesPendientes, setObservacionesPendientes] = useState(0);
  const [actividadAEditar, setActividadAEditar] = useState(null);
  const [mostrarFormEditar, setMostrarFormEditar] = useState(false);
  const [actividadAEliminar, setActividadAEliminar] = useState(null);
  const scrollPosRef = useRef(0);
  const contenedorRef = useRef(null);
  const refWidgetReferencia = useRef(null);
  const refWidgetAcciones = useRef(null);
  const refWidgetCarga = useRef(null);
  const [esStaff, setEsStaff] = useState(false);
  const [mostrarFormPresentarInforme, setMostrarFormPresentarInforme] = useState(false);
  const [mostrarFormEvaluarInforme, setMostrarFormEvaluarInforme] = useState(false);
  const [mostrarModalIniciarEjecucion, setMostrarModalIniciarEjecucion] = useState(false);
  const [mostrarModalInforme, setMostrarModalInforme] = useState(false);
  const [mostrarModalPDF, setMostrarModalPDF] = useState(false);
  const [cargaParaEditar, setCargaParaEditar] = useState(null);
  const [slideGrafico, setSlideGrafico] = useState(0);
  const slideGraficoRef = useRef(0);
  const timerGraficoRef = useRef(null);

  // ESTADOS PARA MODAL DE INFORME FINAL
  const [mostrarModalPresentacion, setMostrarModalPresentacion] = useState(false);
  const [informeData, setInformeData] = useState({
    resumen: '',
    logros: '',
    dificultades: '',
    conclusiones: ''
  });
  const [enviandoInforme, setEnviandoInforme] = useState(false);

  const abrirModalPresentacion = () => {
    setMostrarModalPresentacion(true);
  };

  const handleInformeChange = (e) => {
    const { name, value } = e.target;
    setInformeData(prev => ({ ...prev, [name]: value }));
  };

  const enviarInformeFinal = async () => {
    if (!informeData.resumen.trim() || !informeData.logros.trim() || !informeData.dificultades.trim() || !informeData.conclusiones.trim()) {
      toast.error("⚠️ Por favor completa todos los campos obligatorios.");
      return;
    }

    try {
      setEnviandoInforme(true);
      toast.loading('Enviando Informe Final...');
      await api.post(`/fondos-tiempo/${fondo.id}/presentar/`, informeData);
      toast.dismiss();
      toast.success('✅ Informe Final enviado exitosamente');
      setMostrarModalPresentacion(false);
      await cargarDetalle();
    } catch (err) {
      toast.dismiss();
      console.error('Error al presentar informe:', err);
      if (err.response?.data?.error) {
        toast.error(`❌ ${err.response.data.error}`);
      } else {
        toast.error('❌ Error al presentar el informe');
      }
    } finally {
      setEnviandoInforme(false);
    }
  };


  useEffect(() => {
    cargarDetalle();
  }, [id]);

  // Sincronizar altura de Acciones y CargaHoraria con el grupo Balance+Distribución
  useEffect(() => {
    const refEl = refWidgetReferencia.current;
    const accionesEl = refWidgetAcciones.current;
    const cargaEl = refWidgetCarga.current;
    if (!refEl) return;

    const sync = () => {
      const h = refEl.getBoundingClientRect().height;
      if (accionesEl) accionesEl.style.height = h + 'px';
      if (cargaEl) {
        cargaEl.style.height = h + 'px';
        cargaEl.style.overflowY = 'auto';
      }
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(refEl);
    return () => observer.disconnect();
  });

  useEffect(() => {
    const cargarUsuario = async () => {
      try {
        const response = await api.get('/usuario/');
        setUsuarioActual(response.data);
      } catch (err) {
        console.error('Error al cargar usuario:', err);
      }
    };

    cargarUsuario();
  }, []);

  // Timer automático del carrusel de gráfica (avanza cada 5 seg)
  useEffect(() => {
    timerGraficoRef.current = setInterval(() => {
      const next = (slideGraficoRef.current + 1) % 2;
      slideGraficoRef.current = next;
      setSlideGrafico(next);
    }, 5000);
    return () => {
      if (timerGraficoRef.current) clearInterval(timerGraficoRef.current);
    };
  }, []);

  const cargarDetalle = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getFondoTiempoDetalle(id);
      setFondo(response.data);
      const pendientes = response.data.observaciones_detalladas?.filter(obs => !obs.resuelta).length || 0;
      setObservacionesPendientes(pendientes);

      // Verificar si el usuario es staff/director
      try {
        const userResponse = await api.get('/usuario/');
        setEsStaff(userResponse.data.is_staff || false);
      } catch (userErr) {
        console.warn('No se pudo verificar permisos de usuario:', userErr);
        setEsStaff(false);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error al cargar detalle:', err);

      if (err.response?.status === 401) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        setError('Error al cargar el detalle del fondo');
      }
      setLoading(false);
    }
  };

  const handleActualizacionHoras = () => {
    cargarDetalle();
  };

  const cerrarPanel = () => {
    navigate('/fondo-tiempo');
  };

  const abrirFormularioActividad = (categoria) => {
    setCategoriaSeleccionada(categoria);
    setMostrarFormActividad(true);
  };

  const abrirFormularioActividadGlobal = () => {
    const catDefault = fondo.categorias?.find(c => c.tipo === 'vida_universitaria') || fondo.categorias?.[0] || { id: '' };
    setCategoriaSeleccionada({ id: catDefault.id, nombre: catDefault.tipo_display });
    setMostrarFormActividad(true);
  };

  const cerrarFormularioActividad = () => {
    setMostrarFormActividad(false);
    setCategoriaSeleccionada(null);
  };

  const getScrollContainer = () => {
    let element = contenedorRef.current;

    while (element && element !== document.body) {
      const hasScroll = element.scrollHeight > element.clientHeight;
      const overflowY = window.getComputedStyle(element).overflowY;

      if (hasScroll && (overflowY === 'auto' || overflowY === 'scroll')) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  };

  const guardarActividad = async (actividadData) => {
    try {
      const scrollContainer = getScrollContainer();
      scrollPosRef.current = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      await crearActividad(actividadData);
      await api.post('/actividades/', actividadData);
      toast.success('✅ Actividad agregada exitosamente');
      cerrarFormularioActividad();
      await cargarDetalle();

      setTimeout(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = scrollPosRef.current;
        } else {
          window.scrollTo(0, scrollPosRef.current);
        }
      }, 300);
    } catch (err) {
      console.error('Error al guardar actividad:', err);
      if (err.response?.data) {
        const errorMsg = JSON.stringify(err.response.data);
        toast.error(`❌ Error: ${errorMsg}`);
      } else {
        toast.error('❌ Error al guardar la actividad');
      }
    }
  };

  const editarActividadHandler = (actividad) => {
    setActividadAEditar(actividad);
    setCategoriaSeleccionada({
      id: actividad.categoria,
      nombre: actividad.categoria_nombre || 'Categoría'
    });
    setMostrarFormEditar(true);
  };

  const actualizarActividad = async (actividadData) => {
    try {
      const scrollContainer = getScrollContainer();
      scrollPosRef.current = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      await api.put(`/actividades/${actividadAEditar.id}/`, actividadData);
      toast.success('✅ Actividad actualizada exitosamente');
      setMostrarFormEditar(false);
      setActividadAEditar(null);
      await cargarDetalle();

      setTimeout(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = scrollPosRef.current;
        } else {
          window.scrollTo(0, scrollPosRef.current);
        }
      }, 300);
    } catch (err) {
      console.error('Error al actualizar actividad:', err);
      if (err.response?.data) {
        const errorMsg = JSON.stringify(err.response.data);
        toast.error(`❌ Error: ${errorMsg}`);
      } else {
        toast.error('❌ Error al actualizar la actividad');
      }
    }
  };

  const confirmarEliminarActividad = async () => {
    if (!actividadAEliminar) return;

    try {
      const scrollContainer = getScrollContainer();
      scrollPosRef.current = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      await eliminarActividad(actividadAEliminar);
      toast.success('✅ Actividad eliminada');
      setActividadAEliminar(null);
      await cargarDetalle();

      setTimeout(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = scrollPosRef.current;
        } else {
          window.scrollTo(0, scrollPosRef.current);
        }
      }, 300);
    } catch (err) {
      console.error('Error al eliminar:', err);
      toast.error('❌ Error al eliminar la actividad');
    }
  };

  const presentarADirector = async () => {
    try {
      if (fondo.estado === 'observado') {
        // Lógica inteligente: Si está observado, buscamos la observación activa y la resolvemos
        // Esto dispara el cambio de estado en el backend (marcar_resuelta -> presentado)
        const observacionActiva = fondo.observaciones_detalladas?.find(obs => !obs.resuelta);

        if (observacionActiva) {
          await api.post(`/observaciones/${observacionActiva.id}/marcar-resuelta/`);
          toast.success('✅ Correcciones enviadas y fondo presentado nuevamente');
        } else {
          toast.error('No se encontró la observación activa para resolver.');
          return;
        }
      } else {
        // Flujo normal: Borrador -> Presentado
        await presentarFondoADirector(fondo.id);
        toast.success('✅ Fondo presentado al Director exitosamente');
      }
      await cargarDetalle();
    } catch (err) {
      console.error('Error al presentar:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);

      if (err.response?.data?.error) {
        toast.error(`❌ ${err.response.data.error}`);
      } else if (err.response?.data) {
        toast.error(`❌ Error: ${JSON.stringify(err.response.data)}`);
      } else {
        toast.error('❌ Error al presentar el fondo');
      }
    }
  };

  const aprobarFondoHandler = async () => {
    try {
      const response = await aprobarFondo(fondo.id);
      toast.success('✅ Fondo aprobado exitosamente');
      setMostrarModalAprobar(false);
      await cargarDetalle();
    } catch (err) {
      console.error('Error al aprobar:', err);
      if (err.response?.data?.error) {
        toast.error(`❌ ${err.response.data.error}`);
      } else {
        toast.error('❌ Error al aprobar el fondo');
      }
    }
  };

  const descargarPDF = async () => {
    try {
      toast.loading('Generando PDF...');
      setMostrarModalPDF(false);

      const response = await api.get(`/fondos-tiempo/${id}/pdf-oficial/`, {
        responseType: 'blob'  // Importante para archivos binarios
      });

      // Crear un link temporal para descargar
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Nombre del archivo
      const nombreArchivo = `Fondo_${fondo.docente?.nombre_completo?.replace(/ /g, '_')}_${fondo.gestion}_${fondo.periodo}.pdf`;
      link.setAttribute('download', nombreArchivo);

      // Simular click para descargar
      document.body.appendChild(link);
      link.click();

      // Limpiar
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success('📄 PDF descargado exitosamente');

    } catch (error) {
      toast.dismiss();
      console.error('Error al descargar PDF:', error);
      toast.error('❌ Error al generar el PDF');
    }
  };

  const iniciarEjecucionHandler = async () => {
    try {
      await api.post(`/fondos-tiempo/${fondo.id}/iniciar_ejecucion/`);
      toast.success('✅ Ejecución iniciada exitosamente');
      setMostrarModalIniciarEjecucion(false);
      await cargarDetalle();
    } catch (err) {
      console.error('Error al iniciar ejecución:', err);
      if (err.response?.data?.error) {
        toast.error(`❌ ${err.response.data.error}`);
      } else {
        toast.error('❌ Error al iniciar la ejecución');
      }
    }
  };


  const abrirFormularioObservar = () => {
    setMostrarFormObservar(true);
  };

  const cerrarFormularioObservar = () => {
    setMostrarFormObservar(false);
  };

  const handleObservacionEnviada = async () => {
    cerrarFormularioObservar();
    await cargarDetalle();

    // Actualizar las observaciones en el chat flotante
    if (observacionesRef.current) {
      await observacionesRef.current.actualizarObservaciones();
      const pendientes = observacionesRef.current.obtenerPendientes();
      setObservacionesPendientes(pendientes);
    }
  };

  const getPeriodoLabel = (periodo) => {
    const periodos = {
      '1S': 'Primer Semestre',
      '2S': 'Segundo Semestre',
      'A': 'Anual',
      'V': 'Verano'
    };
    return periodos[periodo] || periodo;
  };

  const getEstadoBadgeColor = (estado) => {
    const colores = {
      'borrador': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-500',
      'presentado_director': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      'revision_director': 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
      'aprobado_director': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
      'en_ejecucion': 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      'informe_presentado': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      'finalizado': 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
      'observado': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
      'rechazado': 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
    };
    return colores[estado] || colores['borrador'];
  };

  const obtenerIniciales = (nombre) => {
    if (!nombre) return '??';
    return nombre.split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const validarRequisitos = () => {
    if (!fondo) return { horas: false, docencia: false, docs: false, total: false };

    const horas = Math.abs(fondo.total_asignado - fondo.horas_efectivas) < 0.1;
    const docencia = fondo.categorias?.some(c => c.tipo === 'docente' && parseFloat(c.total_horas) > 0);
    const docs = fondo.tiene_programa_analitico;

    return {
      horas,
      docencia,
      docs,
      total: horas && docencia && docs
    };
  };

  // --- RENDERIZADO INTELIGENTE DE EVIDENCIAS ---
  const renderEvidencia = (actividad) => {
    const texto = actividad.evidencias;
    const archivo = actividad.archivo_evidencia;

    // 1. Prioridad: Si hay archivo adjunto, mostrar botón de descarga
    if (archivo) {
      return (
        <a
          href={archivo}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors border border-indigo-200 dark:border-indigo-800 shadow-sm group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform">
            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
          </svg>
          Ver Archivo
        </a>
      );
    }

    if (!texto) return <span className="text-slate-300 dark:text-slate-600 italic text-xs">-</span>;

    // 2. Detectar URL en el texto (http o www)
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/;
    const match = texto.match(urlRegex);

    if (match) {
      let url = match[0];
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors border border-blue-200 dark:border-blue-800 shadow-sm group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform">
            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
            <path d="M11.603 7.96a.75.75 0 00-1.06-1.06l-2.25 2.25a4 4 0 005.656 5.656l3-3a4 4 0 00-.225-5.865.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.25-1.25z" />
          </svg>
          Ver Respaldo
        </a>
      );
    }

    // 3. Texto normal (Memo, Referencia, etc) - Estilo Badge
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-300 dark:border-slate-600 max-w-full truncate" title={texto}>
        {texto}
      </span>
    );
  };

  const handleEditCarga = (detalle, tipoCategoria) => {
    setCargaParaEditar({ ...detalle, categoria: tipoCategoria });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Edita la asignación en el formulario superior', { icon: '✏️' });
  };

  const handleDeleteCarga = async (id) => {
    if (!confirm("¿Eliminar esta asignación de carga horaria?")) return;
    try {
      await api.delete(`/cargas-horarias/${id}/`);
      toast.success("Asignación eliminada");
      cargarDetalle();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-xl shadow-md max-w-md">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-700 dark:text-red-400 font-semibold mb-2">{error}</p>
              {error.includes('sesión') && (
                <button
                  onClick={() => navigate('/login')}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Ir a Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!fondo) return null;

  const datosGrafico = fondo.categorias
    ?.filter(cat => cat.total_horas > 0)
    .map(cat => ({
      name: cat.tipo_display,
      value: parseFloat(cat.total_horas),
      porcentaje: parseFloat(cat.porcentaje)
    })) || [];

  const puedeEditar = fondo.puede_editar;
  const requisitos = validarRequisitos();
  const esJefeEstudios = usuarioActual?.perfil?.rol === 'jefe_estudios';

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Contenido Simétrico (3 columnas: izq - centro - drch) */}
      <div ref={contenedorRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-7xl mx-auto px-6 py-8">

          {/* Header Card Rediseñado v3 */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-300 dark:border-slate-700 mb-8 relative group">

            {/* Decoración de fondo */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl"></div>
            </div>

            {/* Botón cerrar - Mitad adentro mitad afuera */}
            <div className="absolute -top-3 -right-3 z-50">
              <button
                onClick={cerrarPanel}
                className="p-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all hover:scale-110 shadow-lg border-2 border-slate-300 dark:border-slate-600"
                title="Volver al listado"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 md:p-8 relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center gap-6 lg:gap-8">

              {/* Avatar e Info Principal en fila */}
              <div className="flex flex-col md:flex-row items-center md:items-start lg:items-center gap-5 lg:gap-6 flex-1 w-full lg:w-auto">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-3xl md:text-4xl shadow-lg ring-4 ring-white dark:ring-slate-800/50 transform group-hover:scale-105 transition-transform duration-300">
                    {obtenerIniciales(fondo.docente?.nombre_completo)}
                  </div>
                </div>

                {/* Información Central */}
                <div className="flex-1 text-center md:text-left space-y-2 w-full">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">
                      {fondo.docente?.nombre_completo || 'Docente'}
                    </h1>
                    <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 mt-2 font-medium">
                      <span className="bg-slate-100/80 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-600/50">
                        {fondo.carrera?.nombre || 'Carrera'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center md:justify-start w-full">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/80 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      {fondo.asignatura}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divisor vertical en desktop */}
              <div className="hidden lg:block w-px h-24 bg-slate-200/80 dark:bg-slate-700/80 self-center"></div>

              {/* Widgets de Información Secundaria apilados verticalmente (Categoría arriba de Balance) */}
              <div className="flex flex-col gap-2.5 justify-center w-full lg:w-48 shrink-0">
                {fondo.docente?.categoria && (
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 px-4 py-2 flex items-center justify-start gap-3 w-full shadow-sm hover:shadow transition-shadow">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-bold tracking-widest text-slate-800 dark:text-slate-200 uppercase leading-none pb-0.5">Categoría</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm capitalize leading-tight">
                        {fondo.docente?.categoria}
                      </span>
                    </div>
                  </div>
                )}

                {fondo.docente?.dedicacion && (
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 px-4 py-2 flex items-center justify-start gap-3 w-full shadow-sm hover:shadow transition-shadow">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-bold tracking-widest text-slate-800 dark:text-slate-200 uppercase leading-none pb-0.5">Balance Legal</span>
                      <div className="flex items-center gap-1.5 leading-tight">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{fondo.docente?.dedicacion === 'tiempo_completo' ? 'TC' : fondo.docente?.dedicacion === 'medio_tiempo' ? 'MT' : 'TH'}</span>
                        <span className="text-green-500 font-bold">•</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{fondo.antiguedad} años</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Divisor vertical en desktop */}
              <div className="hidden lg:block w-px h-24 bg-slate-200/80 dark:bg-slate-700/80 self-center"></div>

              {/* Metadata (Estado, Periodo, Gestión) Compacto */}
              <div className="flex flex-col gap-2.5 min-w-[160px] w-full lg:w-48 shrink-0">
                {/* Estado Actual */}
                <div className="px-4 py-2.5 rounded-xl border shadow-sm flex flex-col items-center justify-center bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200 pb-0.5">Estado Actual</span>
                  <p className="text-[15px] font-bold leading-tight text-slate-800 dark:text-slate-200">
                    {fondo.estado_display || fondo.estado?.toUpperCase()}
                  </p>
                </div>

                {/* Periodo y Gestión (Combinados) */}
                <div className="flex gap-2.5 w-full">
                  <div className="flex-1 bg-slate-50/70 dark:bg-slate-800/40 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center py-2 px-1">
                    <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest pb-0.5">Periodo</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{getPeriodoLabel(fondo.periodo)}</span>
                  </div>
                  <div className="flex-1 bg-slate-50/70 dark:bg-slate-800/40 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center py-2 px-1">
                    <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest pb-0.5">Gestión</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{fondo.gestion}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* ================================================= */}
            {/* PANEL IZQUIERDO - Widgets de estado y balance */}
            {/* ================================================= */}
            <div className="lg:col-span-3 flex flex-col space-y-6">

              {/* Grupo alineado: Balance de Horas + Distribución (referencia de altura para Acciones) */}
              <div ref={refWidgetReferencia} className="flex flex-col gap-6">

                {/* Widget Balance de Horas */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Balance de Horas
                  </h3>
                  <div className="space-y-5">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-300 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Requerido</span>
                      <span className="font-black text-slate-800 dark:text-white">{Math.round(fondo.horas_efectivas)}h</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-300 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Asignado</span>
                      <span className="font-black text-green-600 dark:text-green-400">{Math.round(fondo.total_asignado)}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Disponible</span>
                      <span className={`font-black text-lg ${fondo.horas_disponibles < 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                        {Math.round(fondo.horas_disponibles)}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Widget Gráfico Distribución - Carrusel */}
                {datosGrafico.length > 0 && (() => {
                  const totalHoras = datosGrafico.reduce((s, d) => s + d.value, 0);
                  const maxVal = Math.max(...datosGrafico.map(d => d.value));

                  const irASlide = (idx) => {
                    setSlideGrafico(idx);
                    slideGraficoRef.current = idx;
                    // Reiniciar timer
                    if (timerGraficoRef.current) clearInterval(timerGraficoRef.current);
                    timerGraficoRef.current = setInterval(() => {
                      const next = (slideGraficoRef.current + 1) % 2;
                      slideGraficoRef.current = next;
                      setSlideGrafico(next);
                    }, 5000);
                  };

                  return (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Distribución
                      </h3>

                      {/* Área de slides */}
                      <div className="relative overflow-hidden" style={{ height: '11rem' }}>
                        <div
                          className="flex transition-transform duration-500 ease-in-out h-full"
                          style={{ transform: `translateX(-${slideGrafico * 100}%)` }}
                        >
                          {/* SLIDE 1 — PieChart */}
                          <div className="min-w-full h-full flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={datosGrafico}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={58}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {datosGrafico.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${Math.round(value)}h`} />
                                <Legend verticalAlign="bottom" height={18} iconSize={8} wrapperStyle={{ fontSize: '9px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* SLIDE 2 — Figuras geométricas (barras proporcionales) */}
                          <div className="min-w-full h-full flex-shrink-0 flex flex-col justify-between py-1">
                            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                              {datosGrafico.map((entry, index) => {
                                const pct = maxVal > 0 ? (entry.value / maxVal) * 100 : 0;
                                const color = COLORS[index % COLORS.length];
                                return (
                                  <div key={index} className="flex items-center gap-2">
                                    {/* Etiqueta */}
                                    <span
                                      className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate"
                                      style={{ minWidth: '56px', maxWidth: '56px' }}
                                    >
                                      {entry.name?.split(' ')[0]}
                                    </span>
                                    {/* Barra */}
                                    <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-md overflow-hidden">
                                      <div
                                        className="h-full rounded-md transition-all duration-700"
                                        style={{ width: `${pct}%`, backgroundColor: color }}
                                      />
                                    </div>
                                    {/* Valor */}
                                    <span className="text-[9px] font-bold" style={{ color, minWidth: '26px', textAlign: 'right' }}>
                                      {Math.round(entry.value)}h
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Total */}
                            <p className="text-[9px] text-center text-slate-400 dark:text-slate-500 font-medium mt-1">
                              Total: <span className="font-bold text-slate-600 dark:text-slate-300">{Math.round(totalHoras)}h</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Puntos de navegación */}
                      <div className="flex justify-center gap-2 mt-3">
                        {[0, 1].map((i) => (
                          <button
                            key={i}
                            onClick={() => irASlide(i)}
                            className={`transition-all duration-300 rounded-full ${slideGrafico === i
                              ? 'w-4 h-2 bg-blue-500'
                              : 'w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-blue-300 dark:hover:bg-blue-700'
                              }`}
                            title={i === 0 ? 'Gráfico de pastel' : 'Barras comparativas'}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>{/* fin grupo widgets-referencia */}

              {/* Widget Resumen Ejecución */}
              {fondo.estado_ejecutor && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    Ejecución
                  </h3>

                  <div className="space-y-3 text-sm">
                    {fondo.fecha_inicio_ejecucion && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Inicio:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {new Date(fondo.fecha_inicio_ejecucion).toLocaleDateString('es-BO')}
                        </span>
                      </div>
                    )}
                    {fondo.semestre && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Semestre:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{fondo.semestre}</span>
                      </div>
                    )}
                    {fondo.total_horas_ejecutadas && (
                      <div className="flex justify-between pt-2 border-t border-slate-300 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400">Ejecutadas:</span>
                        <span className="font-black text-blue-600 dark:text-blue-400">{fondo.total_horas_ejecutadas}h</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Widget Observaciones Pendientes */}
              {observacionesPendientes > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-orange-600"></div>

                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <span className="text-lg">⚠️</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Pendientes</p>
                      <p className="font-black text-amber-700 dark:text-amber-300 text-2xl">{observacionesPendientes}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* ================================================= */}
            {/* COLUMNA CENTRAL (CONTENIDO PRINCIPAL) */}
            {/* ================================================= */}
            <div className="lg:col-span-6 space-y-8">

              {/* GESTOR DE CARGA HORARIA (JEFE ESTUDIOS/ADMIN) */}
              {fondo && (usuarioActual?.perfil?.rol === 'jefe_estudios' || usuarioActual?.perfil?.rol === 'admin' || usuarioActual?.is_staff) && fondo.calendario_academico && ['borrador', 'observado'].includes(fondo.estado) && (
                <div className="mb-6">
                  <div ref={refWidgetCarga} style={{ minHeight: '4rem' }}>
                    <CargaHorariaManager
                      docenteId={fondo.docente.id}
                      calendarioId={fondo.calendario_academico.id}
                      onCargaUpdate={cargarDetalle}
                      cargaEdicion={cargaParaEditar}
                      onCancelarEdicion={() => setCargaParaEditar(null)}
                    />
                  </div>
                </div>
              )}

              {/* Distribuir Horas (Solo editable en borrador/observado) */}
              {puedeEditar ? (
                <DistribuirHoras
                  fondoId={fondo.id}
                  horasEfectivas={fondo.horas_efectivas}
                  onActualizar={handleActualizacionHoras}
                  onAgregarActividad={abrirFormularioActividadGlobal}
                />
              ) : !esStaff && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm">
                  <p className="text-amber-800 dark:text-amber-300 text-sm font-medium flex items-center gap-2">
                    <span className="text-lg">🔒</span>
                    <span>Solo puedes modificar la distribución cuando el fondo está en <strong>"Borrador"</strong> u <strong>"Observado"</strong>.</span>
                  </p>
                </div>
              )}

            </div>

            {/* ================================================= */}
            {/* PANEL DERECHO - Widget Acciones */}
            {/* ================================================= */}
            <div className="lg:col-span-3 space-y-6">
              <div className="sticky top-24 space-y-6">

                {/* Widget Acciones - alineado con Balance de Horas (top) y Distribución (bottom) */}
                <div ref={refWidgetAcciones} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Acciones
                  </h3>

                  {/* VALIDACIÓN DE REQUISITOS - crece para llenar espacio disponible */}
                  {['borrador', 'observado'].includes(fondo.estado) && !esStaff && (
                    <div className="flex-1 flex flex-col justify-end">
                      <ValidacionRequisitos requisitos={requisitos} fondo={fondo} />
                      {requisitos.total && (
                        <div className="mt-2 p-2.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-2 shadow-sm animate-fade-in">
                          <div className="p-1 bg-green-100 dark:bg-green-800 rounded-full flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-green-800 dark:text-green-300">¡Todo listo!</p>
                            <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5 leading-relaxed">Requisitos cumplidos ya se puede presentar al director.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2.5 mt-auto pt-2">
                    {/* placeholder para que mt-auto funcione cuando no hay validación */}

                    {/* ENLACE AL PROGRAMA ANALÍTICO */}
                    {fondo.tiene_programa_analitico && fondo.programa_analitico_url && (
                      <a
                        href={fondo.programa_analitico_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 rounded-xl font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 flex justify-center items-center gap-2 border border-blue-200 dark:border-blue-800 transition-all shadow-sm hover:shadow-md group text-xs"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        Programa Analítico
                      </a>
                    )}

                    {/* DOCENTE: Presentar */}
                    {fondo.estado === 'borrador' && !esStaff && (
                      <button
                        onClick={presentarADirector}
                        disabled={!requisitos.total}
                        className="w-full py-2 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        Presentar
                      </button>
                    )}

                    {/* DIRECTOR: Revisar */}
                    {fondo.estado === 'presentado_director' && esStaff && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={abrirFormularioObservar}
                          className="py-1.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-md hover:shadow-lg transition-all text-xs"
                        >
                          Observar
                        </button>
                        <button
                          onClick={() => setMostrarModalAprobar(true)}
                          className="py-1.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg transition-all text-xs"
                        >
                          Aprobar
                        </button>
                      </div>
                    )}

                    {/* DOCENTE: Volver a Presentar */}
                    {fondo.estado === 'observado' && !esStaff && (
                      <button
                        onClick={presentarADirector}
                        disabled={!requisitos.total}
                        className="w-full py-2 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] text-xs"
                      >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        Reenviar
                      </button>
                    )}

                    {/* ADMIN: Iniciar Ejecución */}
                    {fondo.estado === 'aprobado_director' && esStaff && (
                      <button
                        onClick={() => setMostrarModalIniciarEjecucion(true)}
                        className="w-full py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <PlayCircleIcon className="w-3.5 h-3.5" />
                        Iniciar
                      </button>
                    )}

                    {/* DOCENTE: Presentar Informe */}
                    {fondo.estado === 'en_ejecucion' && !esStaff && (
                      <button
                        onClick={abrirModalPresentacion}
                        className="w-full py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <DocumentTextIcon className="w-3.5 h-3.5" />
                        Informe
                      </button>
                    )}

                    {/* ADMIN: Evaluar Informe */}
                    {fondo.estado === 'informe_presentado' && esStaff && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => setMostrarModalInforme(true)}
                          className="w-full py-1.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors text-xs"
                        >
                          Ver Informe
                        </button>
                        <button
                          onClick={() => setMostrarFormEvaluarInforme(true)}
                          className="w-full py-2 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                        >
                          <CheckBadgeIcon className="w-3.5 h-3.5" />
                          Evaluar
                        </button>
                      </div>
                    )}

                    {/* Botón PDF */}
                    <button
                      onClick={() => setMostrarModalPDF(true)}
                      className="w-full py-1.5 rounded-xl font-semibold text-slate-600 bg-white border-2 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 flex justify-center items-center gap-1.5 transition-all text-xs"
                    >
                      <span>📄</span> PDF
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* ================================================= */}
            {/* FILA COMPLETA - Actividades Planificadas (col-span-12) */}
            {/* ================================================= */}
            {fondo.categorias && fondo.categorias.length > 0 && (
              <div className="lg:col-span-12 space-y-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3 pb-2 border-b border-slate-300 dark:border-slate-700">
                  <span className="text-2xl">📋</span> Actividades Planificadas
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {(() => {
                    const ORDEN_FUNCIONES = ['docente', 'investigacion', 'extension', 'asesorias', 'tribunales', 'administrativo', 'vida_universitaria'];
                    const categoriasOrdenadas = [...fondo.categorias].sort((a, b) => {
                      return ORDEN_FUNCIONES.indexOf(a.tipo) - ORDEN_FUNCIONES.indexOf(b.tipo);
                    });

                    return categoriasOrdenadas.map((categoria, idx) => {
                      const esBloqueada = CATEGORIAS_BLOQUEADAS.includes(categoria.tipo);
                      const Icon = CATEGORY_ICONS[categoria.tipo] || DocumentTextIcon;
                      const color = COLORS[idx % COLORS.length];

                      return (
                        <div key={categoria.id} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full">

                          {/* Header de categoría con diseño moderno */}
                          <div className="px-6 py-5 flex justify-between items-center bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 relative overflow-hidden">
                            {/* Acento de color superior (como en Distribución) */}
                            <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color }}></div>

                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4 pl-2">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-600">
                                  <Icon className="w-6 h-6" style={{ color: color }} strokeWidth={2} />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {categoria.tipo_display}
                                  </h3>
                                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                      <span className="font-bold" style={{ color: color }}>{categoria.total_horas}</span> hrs asignadas
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>{parseFloat(categoria.porcentaje).toFixed(1)}% del total</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {esBloqueada && <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1"><LockClosedIcon className="w-3 h-3" /> Auto</span>}

                              {/* Botón agregar actividad removido y reubicado en widget Distribución de Horas */}
                            </div>
                          </div>

                          {/* Tabla de actividades */}
                          <div className="p-0 flex-1 flex flex-col">
                            {/* 1. MOSTRAR CARGA HORARIA (JEFATURA) SI EXISTE */}
                            {categoria.detalles_carga && categoria.detalles_carga.length > 0 && (
                              <div className="border-b border-slate-300 dark:border-slate-700">
                                {!esBloqueada && (
                                  <div className="px-6 py-2 bg-blue-50/40 dark:bg-blue-900/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-b border-blue-100 dark:border-blue-800/30 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    Asignación Jefatura (Base de Horas)
                                  </div>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="min-w-full">
                                    <thead>
                                      <tr className="bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-300 dark:border-slate-700">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actividad Asignada</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Horas</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-8">Respaldo</th>
                                        {esJefeEstudios && (
                                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {categoria.detalles_carga.map((detalle, dIdx) => (
                                        <tr key={dIdx} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 last:border-0 transition-colors">
                                          <td className="px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 font-medium">{detalle.titulo_actividad}</td>
                                          <td className="px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-white text-right">{detalle.horas}</td>
                                          <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-slate-400 italic pl-8">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{detalle.respaldo || 'Sin respaldo'}</span>
                                          </td>
                                          {esJefeEstudios && (
                                            <td className="px-6 py-3.5 text-right">
                                              <div className="flex gap-1 justify-end">
                                                <button
                                                  onClick={() => handleEditCarga(detalle, categoria.tipo)}
                                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                  title="Editar asignación"
                                                >
                                                  <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteCarga(detalle.id)}
                                                  className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                  title="Eliminar asignación"
                                                >
                                                  <TrashIcon className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* 2. MOSTRAR ACTIVIDADES MANUALES (SI NO ESTÁ BLOQUEADA) */}
                            {!esBloqueada && (
                              <div>
                                {categoria.detalles_carga && categoria.detalles_carga.length > 0 && categoria.actividades && categoria.actividades.length > 0 && (
                                  <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-y border-slate-300 dark:border-slate-700 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    Planificación de Actividades (Detalle Docente)
                                  </div>
                                )}

                                {categoria.actividades && categoria.actividades.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                      <thead>
                                        <tr className="bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-300 dark:border-slate-700">
                                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/3">
                                            Actividad
                                          </th>
                                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Hrs/Semana
                                          </th>
                                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Hrs/Año
                                          </th>
                                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                                            Evidencias
                                          </th>
                                          {puedeEditar && !esBloqueada && (
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                              Acciones
                                            </th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {categoria.actividades.map((actividad, actIdx) => (
                                          <tr
                                            key={actividad.id}
                                            className={`border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${actIdx === categoria.actividades.length - 1 ? 'border-b-0' : ''
                                              }`}
                                          >
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                              {actividad.detalle}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 text-center">
                                              {actividad.horas_semana}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-sm font-bold text-slate-800 dark:text-white min-w-[3rem]">
                                                {actividad.horas_año}
                                              </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                              {renderEvidencia(actividad)}
                                            </td>
                                            {puedeEditar && !esBloqueada && (
                                              <td className="px-6 py-4 text-right">
                                                <div className="flex gap-1 justify-end">
                                                  <button
                                                    onClick={() => editarActividadHandler(actividad)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    title="Editar actividad"
                                                  >
                                                    <PencilIcon className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() => setActividadAEliminar(actividad.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="Eliminar actividad"
                                                  >
                                                    <TrashIcon className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  (!categoria.detalles_carga || categoria.detalles_carga.length === 0) && (
                                    <div className="text-center py-8 bg-slate-50/30 dark:bg-slate-800/30">
                                      <p className="text-slate-400 dark:text-slate-500 italic text-sm flex flex-col items-center gap-2">
                                        <span className="text-2xl opacity-50">📭</span>
                                        Sin actividades registradas
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    });
                  })()}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>


      {/* BOTÓN OBSERVACIONES - Portal para que quede fijo en la esquina de la pantalla */}
      {ReactDOM.createPortal(
        <div className="fixed bottom-[6.5rem] right-16 z-[9999]">
          <BotonFlotanteObservaciones
            ref={observacionesRef}
            fondoId={fondo.id}
            estadoFondo={fondo.estado_display}
            onObservacionCambiada={async () => {
              await cargarDetalle();
              if (observacionesRef.current) {
                const pendientes = observacionesRef.current.obtenerPendientes();
                setObservacionesPendientes(pendientes);
              }
            }}
          />
        </div>,
        document.body
      )}
      {/* Modal de formulario - Portal para centrar en pantalla */}
      {mostrarFormActividad && categoriaSeleccionada && ReactDOM.createPortal(
        <FormularioActividad
          categoria={categoriaSeleccionada}
          categoriasDisponibles={fondo.categorias.filter(c => c.tipo !== 'docente').map(c => ({ id: c.id, nombre: c.tipo_display, tipo: c.tipo }))}
          onGuardar={guardarActividad}
          onCancelar={cerrarFormularioActividad}
          horasDisponibles={fondo.horas_disponibles}
        />,
        document.body
      )}

      {/* Modal de editar actividad - Portal para centrar en pantalla */}
      {mostrarFormEditar && actividadAEditar && ReactDOM.createPortal(
        <FormularioActividad
          categoria={categoriaSeleccionada}
          actividadInicial={actividadAEditar}
          onGuardar={actualizarActividad}
          onCancelar={() => {
            setMostrarFormEditar(false);
            setActividadAEditar(null);
          }}
          modoEdicion={true}
          horasDisponibles={fondo.horas_disponibles}
        />,
        document.body
      )}

      {/* Modal de observaciones - Portal para centrar en pantalla */}
      {mostrarFormObservar && ReactDOM.createPortal(
        <FormularioObservar
          fondo={fondo}
          onObservar={handleObservacionEnviada}
          onCancelar={cerrarFormularioObservar}
        />,
        document.body
      )}

      {/* ============================================ */}
      {/* NUEVO: Modal Presentar Informe */}
      {/* ============================================ */}
      {
        mostrarFormPresentarInforme && (
          <FormularioPresentarInforme
            fondoId={fondo.id}
            onInformePresentado={async () => {
              setMostrarFormPresentarInforme(false);
              await cargarDetalle();
            }}
            onCancelar={() => setMostrarFormPresentarInforme(false)}
          />
        )
      }

      {/* ============================================ */}
      {/* NUEVO: Modal Evaluar Informe */}
      {/* ============================================ */}
      {
        mostrarFormEvaluarInforme && (
          <FormularioEvaluarInforme
            fondoId={fondo.id}
            onInformeEvaluado={async () => {
              setMostrarFormEvaluarInforme(false);
              await cargarDetalle();
            }}
            onCancelar={() => setMostrarFormEvaluarInforme(false)}
          />
        )
      }

      {/* Modal de confirmación para aprobar */}
      {
        mostrarModalAprobar && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>✅</span> Confirmar Aprobación
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                    ¿Estás seguro de aprobar este fondo?
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Al aprobar:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                    <li>El fondo quedará bloqueado para edición</li>
                    <li>El docente será notificado</li>
                    <li>Se registrará la fecha de aprobación</li>
                    <li>El fondo pasará a estado "Aprobado por Director"</li>
                  </ul>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Docente:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fondo.docente?.nombre_completo || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Asignatura:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fondo.asignatura || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Gestión:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fondo.gestion} - {fondo.periodo_display}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setMostrarModalAprobar(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={aprobarFondoHandler}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                >
                  <CheckBadgeIcon className="w-5 h-5" />
                  <span>Aprobar</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* ============================================ */}
      {/* NUEVO: Modal Iniciar Ejecución */}
      {/* ============================================ */}
      {
        mostrarModalIniciarEjecucion && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>🚀</span> Confirmar Inicio de Ejecución
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                    ¿Estás seguro de iniciar la ejecución?
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Al iniciar:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                    <li>El fondo quedará activo durante el semestre</li>
                    <li>El docente podrá ejecutar las actividades planificadas</li>
                    <li>Se registrará la fecha de inicio</li>
                    <li>El fondo pasará a estado "En Ejecución"</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setMostrarModalIniciarEjecucion(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={iniciarEjecucionHandler}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                >
                  <PlayCircleIcon className="w-6 h-6" />
                  <span>Iniciar</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Ver Informe - Rediseñado */}
      {
        mostrarModalInforme && fondo.informe_actual && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header elegante */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-6 py-4 border-b border-blue-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Informe de Cumplimiento
                      </h2>
                      <p className="text-xs text-blue-100">
                        {fondo.docente?.nombre_completo}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMostrarModalInforme(false)}
                    className="p-2 rounded-lg hover:bg-white/20 text-white transition-all hover:scale-110"
                    title="Cerrar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Contenido con diseño mejorado */}
              <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-900/10 p-6">
                <div className="max-w-3xl mx-auto space-y-5">

                  {/* Actividades Realizadas */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-900/30 dark:to-indigo-900/30 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Actividades Realizadas
                        </h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {fondo.informe_actual.actividades_realizadas}
                      </p>
                    </div>
                  </div>

                  {/* Logros Alcanzados */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Logros Alcanzados
                        </h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {fondo.informe_actual.logros || fondo.informe_actual.resultados || 'No especificado'}
                      </p>
                    </div>
                  </div>

                  {/* Dificultades Encontradas */}
                  {fondo.informe_actual.dificultades && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-900/30 dark:to-orange-900/30 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Dificultades Encontradas
                          </h3>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {fondo.informe_actual.dificultades}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info de fecha */}
                  <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        Presentado el:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {new Date(fondo.informe_actual.fecha_elaboracion).toLocaleDateString('es-BO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* Modal de confirmación para eliminar - Portal para centrar en pantalla */}
      {actividadAEliminar && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🗑️</span> Confirmar Eliminación
              </h2>
            </div>
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 mb-4">
                <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                  ¿Estás seguro de eliminar esta actividad?
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Esta acción no se puede deshacer. La actividad se eliminará permanentemente.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setActividadAEliminar(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminarActividad}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL PREVIEW PDF */}
      <PDFPreviewModal
        isOpen={mostrarModalPDF}
        onClose={() => setMostrarModalPDF(false)}
        pdfUrl={`http://127.0.0.1:8000/api/fondos-tiempo/${id}/pdf-oficial/`}
      />

      {/* MODAL DE REDACCIÓN DE INFORME FINAL */}
      {
        mostrarModalPresentacion && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📝</span> Presentación de Informe Final
                </h2>
                <button onClick={() => setMostrarModalPresentacion(false)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50 dark:bg-slate-900">
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Por favor, complete los siguientes campos para finalizar la ejecución del fondo. Esta información será revisada por el Director de Carrera.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    1. Resumen Ejecutivo (¿Qué se hizo en general?) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="resumen"
                    value={informeData.resumen}
                    onChange={handleInformeChange}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Describa brevemente las actividades principales realizadas..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    2. Logros Alcanzados (Metas cumplidas) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="logros"
                    value={informeData.logros}
                    onChange={handleInformeChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Liste los logros cuantitativos y cualitativos..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    3. Dificultades/Obstáculos (Problemas encontrados) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="dificultades"
                    value={informeData.dificultades}
                    onChange={handleInformeChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Mencione las dificultades que impidieron el cumplimiento total..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    4. Conclusiones y Recomendaciones <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="conclusiones"
                    value={informeData.conclusiones}
                    onChange={handleInformeChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Conclusiones finales y sugerencias para futuras gestiones..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setMostrarModalPresentacion(false)}
                  disabled={enviandoInforme}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarInformeFinal}
                  disabled={enviandoInforme}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  {enviandoInforme ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span>📤</span> Enviar Informe Final
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

    </div>
  );
}

export default DetalleFondo;
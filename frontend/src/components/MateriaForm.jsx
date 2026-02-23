import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

const InputField = ({ label, name, type = 'text', value, onChange, required, error }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const MateriaForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [carreras, setCarreras] = useState([]);
    const [formData, setFormData] = useState({
        nombre: '',
        sigla: '',
        semestre: '',
        carrera: '',
        horas_teoricas: 0,
        horas_practicas: 0,
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const esAdmin = userData?.is_superuser || userData?.perfil?.rol === 'admin' || userData?.perfil?.rol === 'director';

        if (!esAdmin) {
            toast.error("No tienes permisos para gestionar materias");
            navigate('/fondo-tiempo/materias');
            return;
        }

        const fetchCarreras = async () => {
            try {
                const res = await api.get('/carreras/');
                setCarreras(res.data.results || res.data);
            } catch (error) {
                console.error("Error cargando carreras:", error);
                toast.error("Error al cargar carreras");
            }
        };
        fetchCarreras();

        if (id) {
            const fetchMateria = async () => {
                try {
                    const res = await api.get(`/materias/${id}/`);
                    const data = res.data;
                    // Asegurarse de que carrera sea el ID si viene como objeto
                    if (data.carrera && typeof data.carrera === 'object') {
                        data.carrera = data.carrera.id;
                    }
                    setFormData(data);
                } catch (error) {
                    console.error("Error cargando materia:", error);
                    toast.error("Error al cargar la materia");
                }
            };
            fetchMateria();
        }
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});

        try {
            if (id) {
                await api.put(`/materias/${id}/`, formData);
                toast.success('Materia actualizada correctamente');
            } else {
                await api.post('/materias/', formData);
                toast.success('Materia creada correctamente');
            }
            navigate('/fondo-tiempo/materias');
        } catch (err) {
            console.error(err);
            const apiErrors = err.response?.data;
            if (apiErrors) {
                setErrors(apiErrors);
                Object.keys(apiErrors).forEach(key => {
                    const msg = Array.isArray(apiErrors[key]) ? apiErrors[key].join(' ') : apiErrors[key];
                    toast.error(`Error en ${key}: ${msg}`);
                });
            } else {
                toast.error('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                            {id ? 'Editar Materia' : 'Nueva Materia'}
                        </h1>
                        <button
                            onClick={() => navigate('/fondo-tiempo/materias')}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <InputField label="Nombre de la Materia" name="nombre" value={formData.nombre} onChange={handleChange} required error={errors.nombre} />
                            </div>
                            
                            <InputField label="Sigla" name="sigla" value={formData.sigla} onChange={handleChange} required error={errors.sigla} />
                            
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Carrera <span className="text-red-500">*</span></label>
                                <select
                                    name="carrera"
                                    value={formData.carrera}
                                    onChange={handleChange}
                                    required
                                    className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm ${errors.carrera ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                                >
                                    <option value="">Seleccione una carrera</option>
                                    {carreras.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                                {errors.carrera && <p className="text-xs text-red-600 mt-1">{errors.carrera}</p>}
                            </div>

                            <InputField label="Semestre" name="semestre" type="number" value={formData.semestre} onChange={handleChange} required error={errors.semestre} />
                            <InputField label="Horas Teóricas" name="horas_teoricas" type="number" value={formData.horas_teoricas} onChange={handleChange} required error={errors.horas_teoricas} />
                            <InputField label="Horas Prácticas" name="horas_practicas" type="number" value={formData.horas_practicas} onChange={handleChange} required error={errors.horas_practicas} />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : 'Guardar Materia'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MateriaForm;
import React, { useState, useRef, useEffect } from 'react';
import { uploadProfilePicture, deleteProfilePicture } from '../apis/api';
import defaultProfileImg from '../assets/logoPre.jpg';
import toast from 'react-hot-toast';

const ProfilePicture = ({ user, onUpdate }) => {
  // Inicializar con la imagen predeterminada importada
  const [image, setImage] = useState(defaultProfileImg);
  const [isCustomImage, setIsCustomImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Si el usuario tiene una foto de perfil, usarla. Si no, usar default.
    if (user?.perfil?.foto_perfil) {
      setImage(user.perfil.foto_perfil);
      setIsCustomImage(true);
    } else {
      setImage(defaultProfileImg);
      setIsCustomImage(false);
    }
  }, [user]);

  const handleImageChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // 1. Mostrar vista previa inmediatamente
      const previewUrl = URL.createObjectURL(file);
      setImage(previewUrl);
      setIsCustomImage(true);
      setUploadError('');

      // 2. Intentar subir la imagen al backend
      try {
        await uploadProfilePicture(file);
        // La imagen se ha subido. La URL de la vista previa es suficiente por ahora.
        // En una recarga de página, la URL vendrá del backend.
        toast.success('Foto de perfil actualizada');
        if (onUpdate) {
          onUpdate(); // Notificar al padre para que refresque los datos del usuario
        }
      } catch (error) {
        console.error('Error al subir la imagen:', error);
        setUploadError('Error al subir la imagen. Intente de nuevo.');
        // Opcional: Revertir a la imagen anterior si la subida falla
        if (user?.perfil?.foto_perfil) {
          setImage(user.perfil.foto_perfil);
        } else {
          setImage(defaultProfileImg);
          setIsCustomImage(false);
        }
      }
      
      // SOLUCIÓN 1: Limpiar el input para permitir subir la misma imagen si se elimina y se vuelve a agregar
      e.target.value = '';
    }
  };

  const handleDeleteImage = (e) => {
    e.stopPropagation(); // Evitar que se abra el selector de archivos
    
    // SOLUCIÓN 2: Usar toast personalizado en lugar de window.confirm
    toast((t) => (
      <div className="flex flex-col items-center gap-2">
        <p className="font-medium text-sm text-slate-800 dark:text-white">¿Eliminar foto de perfil?</p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteProfilePicture();
                setImage(defaultProfileImg); // Volver a la imagen predeterminada
                setIsCustomImage(false);
                if (fileInputRef.current) fileInputRef.current.value = ''; // Asegurar limpieza del input
                toast.success('Foto eliminada');
                if (onUpdate) {
                  onUpdate(); // Notificar al padre para que refresque los datos del usuario
                }
              } catch (error) {
                console.error('Error al eliminar la imagen:', error);
                setUploadError('Error al eliminar la imagen.');
                toast.error('Error al eliminar');
              }
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs font-bold transition-colors"
          >
            Eliminar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded-md text-xs font-bold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-center',
    });
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    fileInputRef.current.click();
  };

  return (
    <div className="relative w-full h-full mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageChange}
        className="hidden"
        accept="image/png, image/jpeg"
      />
      
      <div className="w-full h-full rounded-full overflow-hidden shadow-md relative group bg-white">
        <img
          src={image}
          alt="Perfil"
          className="w-full h-full object-cover"
          // Si la imagen falla, volvemos a la default
          onError={() => {
            if (image !== defaultProfileImg) {
              setImage(defaultProfileImg);
              setIsCustomImage(false);
            }
          }}
        />

        {/* Overlay Hover - Dividido o Completo */}
        <div className="absolute inset-0 flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {isCustomImage ? (
            <>
              {/* Mitad Izquierda: Cambiar */}
              <div 
                onClick={handleEditClick}
                className="w-1/2 h-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all text-white"
                title="Cambiar foto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[10px] font-bold">CAMBIAR</span>
              </div>
              
              {/* Separador visual */}
              <div className="w-px h-full bg-white/20"></div>

              {/* Mitad Derecha: Eliminar */}
              <div 
                onClick={handleDeleteImage}
                className="w-1/2 h-full bg-red-600/60 hover:bg-red-600/80 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all text-white"
                title="Eliminar foto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-[10px] font-bold">BORRAR</span>
              </div>
            </>
          ) : (
            /* Full Overlay: Subir (cuando es default) */
            <div 
              onClick={handleEditClick}
              className="w-full h-full bg-black/30 hover:bg-black/50 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all text-white"
              title="Subir foto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-xs font-bold">SUBIR FOTO</span>
            </div>
          )}
        </div>
      </div>
      
      {uploadError && <p className="text-red-500 text-xs mt-2 text-center absolute w-full -bottom-6">{uploadError}</p>}
    </div>
  );
};

export default ProfilePicture;

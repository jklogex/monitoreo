import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseTripFromCSV } from '../utils/tripParser';
import { useRequireAuth } from '../lib/auth';
import toast from 'react-hot-toast';

export function TripUploader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    useRequireAuth()
      .then(() => setIsAuthenticated(true))
      .catch((error) => {
        console.error('Error de autenticación:', error);
        toast.error('Por favor, verifica tus credenciales e intenta nuevamente');
      });
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!isAuthenticated) {
      toast.error('Por favor, espera mientras autenticamos...');
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0].map(header => header.trim());
      
      const trips = rows.slice(1)
        .filter(row => row.length === headers.length)
        .map(row => {
          const tripData = {};
          headers.forEach((header, index) => {
            tripData[header] = row[index].trim();
          });
          return parseTripFromCSV(tripData);
        });

      if (trips.length === 0) {
        throw new Error('No se encontraron viajes válidos en el archivo CSV');
      }

      const { error: uploadError } = await supabase
        .from('trips')
        .insert(trips);

      if (uploadError) throw uploadError;

      toast.success(`Se cargaron ${trips.length} viajes exitosamente`);
    } catch (error) {
      console.error('Error al procesar el archivo:', error);
      toast.error(error instanceof Error ? error.message : 'Error al cargar los viajes');
    }
  }, [isAuthenticated]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: !isAuthenticated
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isAuthenticated 
          ? 'border-gray-300 hover:border-blue-500' 
          : 'border-gray-200 bg-gray-50 cursor-not-allowed'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className={`mx-auto h-12 w-12 ${isAuthenticated ? 'text-gray-400' : 'text-gray-300'}`} />
      <p className="mt-2 text-sm text-gray-600">
        {!isAuthenticated 
          ? "Autenticando..."
          : isDragActive
            ? "Suelta el archivo CSV aquí"
            : "Arrastra y suelta un archivo CSV aquí, o haz clic para seleccionar uno"}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Columnas requeridas: ID_Viaje, FECHA DE ENTREGA, NOMBRE CONDUCTOR, DESTINO, PROYECTO, PLACA, PROPIEDAD, JORNADA
      </p>
    </div>
  );
}
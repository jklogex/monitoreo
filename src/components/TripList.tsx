import React, { useEffect, useState } from 'react';
import { Filter, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Trip, TripStatus, TripUpdate } from '../types/database';
import { TripUpdatePanel } from './TripUpdatePanel';
import { ExpandableRow } from './ExpandableRow';
import { StatusFilter } from './StatusFilter';
import { SearchInput } from './SearchInput';
import { SortableHeader } from './SortableHeader';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { SortConfig } from '../types/sorting';
import { sortTrips } from '../utils/sorting';
import { useRequireAuth } from '../lib/auth';

interface LoadingProps {
  message?: string;
}

function Loading({ message = 'Cargando...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">{message}</div>
    </div>
  );
}

export function TripList() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [tripUpdates, setTripUpdates] = useState<Record<string, TripUpdate[]>>({});
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: null,
    direction: 'asc'
  });

  useEffect(() => {
    useRequireAuth()
      .then(() => {
        setIsAuthenticated(true);
        return loadTrips();
      })
      .catch(error => {
        console.error('Authentication error:', error);
        toast.error('Error de autenticación');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const loadAllUpdates = async () => {
      if (isAuthenticated && trips.length > 0) {
        const updatePromises = trips.map(trip => loadTripUpdates(trip.id));
        await Promise.all(updatePromises);
      }
    }
    loadAllUpdates();
  }, [trips, isAuthenticated]);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('delivery_date', { ascending: false });

      if (error) throw error;
      if (data) {
        setTrips(data);
      }
    } catch (error) {
      console.error('Error loading trips:', error);
      toast.error('Error al cargar los viajes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTripUpdates = async (tripId: string) => {
    try {
      const { data, error } = await supabase
        .from('trip_updates')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTripUpdates(prev => ({
        ...prev,
        [tripId]: data || []
      }));
    } catch (error) {
      console.error('Error loading updates:', error);
    }
  };

  const handleUpdateCreated = (newUpdate: TripUpdate) => {
    setTripUpdates(prev => ({
      ...prev,
      [newUpdate.trip_id]: [newUpdate, ...(prev[newUpdate.trip_id] || [])]
    }));
  };

  const toggleExpanded = (tripId: string) => {
    const newExpanded = new Set(expandedTrips);
    if (newExpanded.has(tripId)) {
      newExpanded.delete(tripId);
    } else {
      newExpanded.add(tripId);
    }
    setExpandedTrips(newExpanded);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTrips(new Set(filteredTrips.map(trip => trip.id)));
    } else {
      setSelectedTrips(new Set());
    }
  };

  const handleSelectTrip = (tripId: string, checked: boolean, index: number, event?: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedIndex !== null) {
      const newSelected = new Set(selectedTrips);
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      sortedTrips.slice(start, end + 1).forEach(trip => {
        if (checked) {
          newSelected.add(trip.id);
        } else {
          newSelected.delete(trip.id);
        }
      });
      
      setSelectedTrips(newSelected);
    } else {
      const newSelected = new Set(selectedTrips);
      if (checked) {
        newSelected.add(tripId);
      } else {
        newSelected.delete(tripId);
      }
      setSelectedTrips(newSelected);
      setLastSelectedIndex(index);
    }
  };

  const handleDelete = async () => {
    try {
      const tripsToDelete = selectedTrips.size > 0 
        ? Array.from(selectedTrips)
        : [selectedTrip?.id].filter(Boolean);

      const { error } = await supabase
        .from('trips')
        .delete()
        .in('id', tripsToDelete);

      if (error) throw error;

      setTrips(trips.filter(trip => !tripsToDelete.includes(trip.id)));
      setSelectedTrips(new Set());
      setSelectedTrip(null);
      setShowDeleteModal(false);

      toast.success(
        tripsToDelete.length === 1
          ? 'Viaje eliminado correctamente'
          : `${tripsToDelete.length} viajes eliminados correctamente`
      );
    } catch (error) {
      console.error('Error deleting trips:', error);
      toast.error('Error al eliminar los viajes');
    }
  };

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = 
      trip.system_trip_id.toLowerCase().includes(search.toLowerCase()) ||
      (trip.external_trip_id?.toLowerCase() || '').includes(search.toLowerCase()) ||
      trip.driver_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tripUpdates[trip.id]?.[0]?.category === statusFilter;
    const matchesProject = projectFilter === 'all' || trip.project === projectFilter;

    return matchesSearch && matchesProject && matchesStatus;
  });

  const sortedTrips = sortTrips(filteredTrips, sortConfig, tripUpdates);

  if (isLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Loading message="Verificando autenticación..." />;
  }

  if (trips.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay viajes disponibles</p>
      </div>
    );
  }

  const uniqueProjects = [...new Set(trips.map(trip => trip.project))].sort();

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar viajes..."
          />
        </div>
        {selectedTrips.size > 0 && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar ({selectedTrips.size})
          </button>
        )}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <select
            className="pl-10 pr-4 py-2 border rounded-lg appearance-none bg-white min-w-[200px]"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">Todos los Proyectos</option>
            {uniqueProjects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto relative max-h-[calc(100vh-220px)]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-800">
            <tr>
              <th className="sticky top-0 bg-gray-800 z-10 w-8 px-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedTrips.size === sortedTrips.length && sortedTrips.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 w-8 px-2"></th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <SortableHeader
                  label="ID Viaje"
                  field="trip_id"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <SortableHeader
                  label="Fecha"
                  field="delivery_date"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <SortableHeader
                  label="Placa"
                  field="plate_number"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <SortableHeader
                  label="Conductor"
                  field="driver_name"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Origen
                </span>
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Destino
                </span>
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <SortableHeader
                  label="Proyecto"
                  field="project"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left">
                <SortableHeader
                  label="Estado"
                  field="status_category"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
              <th className="sticky top-0 bg-gray-800 z-10 px-6 py-3 text-left min-w-[140px]">
                <SortableHeader
                  label="Tiempo"
                  field="last_update"
                  currentField={sortConfig.field}
                  direction={sortConfig.direction}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTrips.map((trip, index) => (
              <ExpandableRow
                key={trip.id}
                index={index}
                trip={trip}
                isExpanded={expandedTrips.has(trip.id)}
                isSelected={selectedTrips.has(trip.id)}
                onToggleExpand={() => toggleExpanded(trip.id)}
                onToggleSelect={(checked, event) => handleSelectTrip(trip.id, checked, index, event)}
                onTripSelect={setSelectedTrip}
                updates={tripUpdates[trip.id] || []}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        itemCount={selectedTrips.size || (selectedTrip ? 1 : 0)}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
      
      {selectedTrip && (
        <TripUpdatePanel 
          trip={selectedTrips.size > 0 
            ? trips.filter(t => selectedTrips.has(t.id))
            : selectedTrip
          } 
          onClose={() => setSelectedTrip(null)}
          onUpdateCreated={handleUpdateCreated}
        />
      )}
    </div>
  );
}
import React from 'react';
import { TripUploader } from '../components/TripUploader';

export function UploadPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Cargar Viajes
          </h2>
          <TripUploader />
        </section>
      </div>
    </main>
  );
}
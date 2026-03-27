import { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { AppData, Entity } from '../types';
import { createEntity, addEntity, switchEntity, deleteEntity } from '../utils/storage';

interface EntityManagerProps {
  appData: AppData;
  onAppDataChange: (data: AppData) => void;
}

export const EntityManager = ({ appData, onAppDataChange }: EntityManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const currentEntity = appData.entities.find((e) => e.id === appData.currentEntityId);

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;

    const entity = createEntity(newEntityName);
    const updated = addEntity(appData, entity);
    onAppDataChange(updated);
    setNewEntityName('');
    setShowForm(false);
    setIsOpen(false);
  };

  const handleSwitchEntity = (entityId: string) => {
    const updated = switchEntity(appData, entityId);
    onAppDataChange(updated);
    setIsOpen(false);
  };

  const handleDeleteEntity = (entityId: string) => {
    if (confirm('Delete this entity and all its transactions?')) {
      const updated = deleteEntity(appData, entityId);
      onAppDataChange(updated);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <p className="text-xs text-gray-500">Active Entity</p>
          <p className="font-semibold text-gray-800">{currentEntity?.name || 'Select Entity'}</p>
        </div>
        <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="max-h-64 overflow-y-auto">
            {appData.entities.map((entity) => (
              <div
                key={entity.id}
                className={`flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer ${
                  entity.id === appData.currentEntityId ? 'bg-blue-50' : ''
                }`}
              >
                <button
                  onClick={() => handleSwitchEntity(entity.id)}
                  className="flex-1 text-left"
                >
                  <p
                    className={`font-medium ${
                      entity.id === appData.currentEntityId
                        ? 'text-blue-600'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    {entity.name}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteEntity(entity.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-3">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                New Entity
              </button>
            ) : (
              <form onSubmit={handleCreateEntity} className="space-y-2">
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="Entity name"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

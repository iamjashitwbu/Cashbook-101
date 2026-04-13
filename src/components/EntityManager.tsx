import { useState } from 'react';
import { Plus, Trash2, ChevronDown, Pencil } from 'lucide-react';
import { AppData, Entity } from '../types';
import { createEntity, addEntity, switchEntity, deleteEntity, updateEntity } from '../utils/storage';

interface EntityManagerProps {
  appData: AppData;
  onAppDataChange: (data: AppData) => void;
}

export const EntityManager = ({ appData, onAppDataChange }: EntityManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityGstin, setNewEntityGstin] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editingEntityName, setEditingEntityName] = useState('');
  const [editingEntityGstin, setEditingEntityGstin] = useState('');

  const currentEntity = appData.entities.find((e) => e.id === appData.currentEntityId);

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;

    const entity = createEntity(newEntityName.trim(), newEntityGstin.trim());
    const updated = addEntity(appData, entity);
    onAppDataChange(updated);
    setNewEntityName('');
    setNewEntityGstin('');
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

  const handleStartEdit = (entity: Entity) => {
    setEditingEntityId(entity.id);
    setEditingEntityName(entity.name);
    setEditingEntityGstin(entity.gstin);
    setShowForm(false);
  };

  const handleUpdateEntity = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingEntityId || !editingEntityName.trim()) {
      return;
    }

    const updated = updateEntity(appData, editingEntityId, {
      name: editingEntityName.trim(),
      gstin: editingEntityGstin.trim()
    });
    onAppDataChange(updated);
    setEditingEntityId(null);
    setEditingEntityName('');
    setEditingEntityGstin('');
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingEntityId(null);
    setEditingEntityName('');
    setEditingEntityGstin('');
    setNewEntityName('');
    setNewEntityGstin('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-[10px] border border-white/[0.12] bg-[#0f0f14] px-4 py-2 text-white transition-colors hover:bg-white/[0.04]"
      >
        <div className="text-left">
          <p className="text-xs text-[#9ca3af]">Active Entity</p>
          <p className="font-semibold text-white">{currentEntity?.name || 'Select Entity'}</p>
        </div>
        <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a24] shadow-[0_20px_40px_rgba(0,0,0,0.35)] z-50">
          <div className="max-h-64 overflow-y-auto">
            {appData.entities.map((entity) => (
              <div
                key={entity.id}
                className={`flex items-center justify-between p-3 border-b border-white/[0.06] last:border-b-0 cursor-pointer ${entity.id === appData.currentEntityId ? 'bg-white/5' : 'hover:bg-white/5'
                  }`}
              >
                <button
                  onClick={() => handleSwitchEntity(entity.id)}
                  className="flex-1 text-left"
                >
                  <p
                    className={`font-medium ${entity.id === appData.currentEntityId
                        ? 'text-[#7c6ff7]'
                        : 'text-white hover:text-[#a78bfa]'
                      }`}
                  >
                    {entity.name}
                  </p>
                  {entity.gstin && (
                    <p className="mt-0.5 text-xs text-[#9ca3af]">{entity.gstin}</p>
                  )}
                </button>
                <button
                  onClick={() => handleStartEdit(entity)}
                  className="p-1 text-[#9ca3af] hover:text-white"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDeleteEntity(entity.id)}
                  className="p-1 text-[#f87171] hover:text-red-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-white/[0.06] p-3">
            {!showForm ? (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingEntityId(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#7c6ff7] px-3 py-2 text-white transition-colors hover:bg-[#6d5ff0]"
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
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  autoFocus
                />
                <input
                  type="text"
                  value={newEntityGstin}
                  onChange={(e) => setNewEntityGstin(e.target.value)}
                  placeholder="GSTIN"
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-[10px] bg-[#7c6ff7] px-3 py-2 text-sm font-medium text-white hover:bg-[#6d5ff0]"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="flex-1 rounded-[10px] border border-white/[0.12] bg-transparent px-3 py-2 text-sm font-medium text-white hover:bg-white/[0.04]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {editingEntityId && (
              <form onSubmit={handleUpdateEntity} className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                <input
                  type="text"
                  value={editingEntityName}
                  onChange={(e) => setEditingEntityName(e.target.value)}
                  placeholder="Entity name"
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                  autoFocus
                />
                <input
                  type="text"
                  value={editingEntityGstin}
                  onChange={(e) => setEditingEntityGstin(e.target.value)}
                  placeholder="GSTIN"
                  className="w-full rounded-xl border border-white/[0.12] bg-[#0f0f14] px-3 py-2 text-sm text-white outline-none placeholder:text-[#9ca3af] focus:ring-2 focus:ring-[#7c6ff7]/30"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-[10px] bg-[#7c6ff7] px-3 py-2 text-sm font-medium text-white hover:bg-[#6d5ff0]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="flex-1 rounded-[10px] border border-white/[0.12] bg-transparent px-3 py-2 text-sm font-medium text-white hover:bg-white/[0.04]"
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

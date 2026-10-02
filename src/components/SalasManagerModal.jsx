import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useToast } from '../contexts/ToastContext';

const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

export default function SalasManagerModal({
  isOpen,
  onClose,
  salas = [],
  onSaveSalas,
}) {
  const toast = useToast();
  const [list, setList] = useState([]);

  // New room state
  const [newNome, setNewNome] = useState('');
  const [newCor, setNewCor] = useState(DEFAULT_COLORS[0]);

  useEffect(() => {
    if (isOpen) {
      setList(salas ? JSON.parse(JSON.stringify(salas)) : []);
      setNewNome('');
      setNewCor(DEFAULT_COLORS[0]);
    }
  }, [isOpen, salas]);

  if (!isOpen) return null;

  const handleAddRoom = (e) => {
    e.preventDefault();
    if (!newNome.trim()) {
      toast.warning('Informe o nome da sala.');
      return;
    }

    const newRoom = {
      id: `sala_${Date.now()}`,
      nome: newNome.trim(),
      tipo: 'consultorio',
      cor: newCor,
      ativo: true,
      ordem: list.length + 1,
    };

    const updated = [...list, newRoom];
    setList(updated);
    setNewNome('');
    setNewCor(DEFAULT_COLORS[updated.length % DEFAULT_COLORS.length]);
    toast.success('Sala adicionada!');
  };

  const handleMove = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const updated = [...list];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    updated.forEach((s, idx) => {
      s.ordem = idx + 1;
    });
    setList(updated);
  };

  const handleDelete = (id) => {
    if (list.length <= 1) {
      toast.warning('É necessário manter pelo menos uma sala cadastrada.');
      return;
    }
    setList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateRoom = (id, field, value) => {
    setList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSaveAll = () => {
    try {
      if (typeof onSaveSalas === 'function') {
        onSaveSalas(list);
      }
      if (toast?.success) {
        toast.success('Configuração de salas salva com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao salvar salas:', err);
      if (toast?.error) {
        toast.error('Erro ao salvar salas.');
      }
    } finally {
      if (typeof onClose === 'function') {
        onClose();
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Gerenciar Salas da Clínica"
      maxWidth="600px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSaveAll}>
            💾 Salvar Alterações
          </button>
        </div>
      }
    >
      <div className="salas-manager-container">
        <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>
          Personalize as salas da clínica, definindo o nome, a cor de identificação e a ordem de exibição no cronograma.
        </p>

        {/* Existing Rooms List */}
        <div className="salas-list">
          {list.map((sala, idx) => (
            <div key={sala.id} className="sala-item-card">
              <div className="sala-item-drag-handle">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, -1)}
                  title="Mover para cima"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={idx === list.length - 1}
                  onClick={() => handleMove(idx, 1)}
                  title="Mover para baixo"
                >
                  ▼
                </button>
              </div>

              {/* Perfectly round color swatch button */}
              <label
                className="color-swatch-circle"
                style={{ backgroundColor: sala.cor || '#3b82f6' }}
                title="Alterar cor de identificação"
              >
                <input
                  type="color"
                  value={sala.cor || '#3b82f6'}
                  onChange={(e) => handleUpdateRoom(sala.id, 'cor', e.target.value)}
                  className="color-swatch-hidden-input"
                />
              </label>

              <div className="sala-item-details">
                <input
                  type="text"
                  className="input-field sala-input-name"
                  value={sala.nome}
                  onChange={(e) => handleUpdateRoom(sala.id, 'nome', e.target.value)}
                  placeholder="Nome da Sala (ex: Consultório 1, Sala de Ultrassom...)"
                />
              </div>

              <div className="sala-item-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-danger"
                  onClick={() => handleDelete(sala.id)}
                  title="Remover sala"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Room Form */}
        <form onSubmit={handleAddRoom} className="add-sala-box">
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--text-sm)', color: 'var(--accent-primary)' }}>
            + Adicionar Nova Sala
          </h4>
          <div className="add-sala-form-row">
            <input
              type="text"
              className="input-field"
              style={{ flex: 1 }}
              placeholder="Ex: Consultório 3 ou Sala de Ultrassom"
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
            />

            {/* Perfectly round color swatch for new room */}
            <label
              className="color-swatch-circle"
              style={{ backgroundColor: newCor }}
              title="Cor de identificação"
            >
              <input
                type="color"
                value={newCor}
                onChange={(e) => setNewCor(e.target.value)}
                className="color-swatch-hidden-input"
              />
            </label>

            <button type="submit" className="btn btn-secondary btn-sm">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

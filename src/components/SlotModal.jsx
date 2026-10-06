import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { MOTIVOS_TRANCA } from '../utils/helpers';
import { useData } from '../contexts/DataContext';

export default function SlotModal({
  isOpen,
  onClose,
  slot,
  sala,
  day,
  turnoInfo,
  onSave,
  onDelete,
  allSlotsInPeriod = [],
  salas = [],
}) {
  const { activeMedicosOptions = [] } = useData();
  const [isTrancado, setIsTrancado] = useState(false);
  const [motivoTranca, setMotivoTranca] = useState(MOTIVOS_TRANCA[0]);
  const [motivoCustom, setMotivoCustom] = useState('');

  // Primary doctor
  const [medico, setMedico] = useState('');
  const [novoMedico, setNovoMedico] = useState('');
  const [isCustomMedico, setIsCustomMedico] = useState(false);

  // Optional secondary doctor
  const [showSecondDoctor, setShowSecondDoctor] = useState(false);
  const [medico2, setMedico2] = useState('');
  const [novoMedico2, setNovoMedico2] = useState('');
  const [isCustomMedico2, setIsCustomMedico2] = useState(false);

  const activeMedicos = activeMedicosOptions;

  useEffect(() => {
    if (isOpen) {
      if (slot) {
        setIsTrancado(Boolean(slot.trancado));
        const matchedMotivo = MOTIVOS_TRANCA.includes(slot.motivoTranca)
          ? slot.motivoTranca
          : slot.motivoTranca ? 'Outro' : MOTIVOS_TRANCA[0];
        setMotivoTranca(matchedMotivo);
        setMotivoCustom(matchedMotivo === 'Outro' ? slot.motivoTranca || '' : '');

        // Parse doctor(s)
        const currentMedicoStr = (slot.medico || '').trim();
        const parts = currentMedicoStr.split(/\s*\/\s*/).map((p) => p.trim().toUpperCase());
        const m1 = parts[0] || '';
        const m2 = parts[1] || (slot.medico2 || '').trim().toUpperCase();

        if (m1 && !doctors.includes(m1)) {
          setIsCustomMedico(true);
          setNovoMedico(m1);
          setMedico('');
        } else {
          setIsCustomMedico(false);
          setMedico(m1);
          setNovoMedico('');
        }

        if (m2) {
          setShowSecondDoctor(true);
          if (!doctors.includes(m2)) {
            setIsCustomMedico2(true);
            setNovoMedico2(m2);
            setMedico2('');
          } else {
            setIsCustomMedico2(false);
            setMedico2(m2);
            setNovoMedico2('');
          }
        } else {
          setShowSecondDoctor(false);
          setMedico2('');
          setNovoMedico2('');
          setIsCustomMedico2(false);
        }
      } else {
        // New empty slot
        setIsTrancado(false);
        setMotivoTranca(MOTIVOS_TRANCA[0]);
        setMotivoCustom('');
        setIsCustomMedico(false);
        setMedico('');
        setNovoMedico('');
        setShowSecondDoctor(false);
        setMedico2('');
        setNovoMedico2('');
        setIsCustomMedico2(false);
      }
    }
  }, [isOpen, slot, sala, turnoInfo]);

  // Selected doctors effective names
  const effectiveMedico1 = useMemo(() => {
    if (isCustomMedico) return novoMedico.trim().toUpperCase();
    return medico.trim().toUpperCase();
  }, [isCustomMedico, novoMedico, medico]);

  const effectiveMedico2 = useMemo(() => {
    if (!showSecondDoctor) return '';
    if (isCustomMedico2) return novoMedico2.trim().toUpperCase();
    return medico2.trim().toUpperCase();
  }, [showSecondDoctor, isCustomMedico2, novoMedico2, medico2]);

  const fullMedicoString = useMemo(() => {
    if (effectiveMedico1 && effectiveMedico2) {
      return `${effectiveMedico1} / ${effectiveMedico2}`;
    }
    return effectiveMedico1 || effectiveMedico2 || '';
  }, [effectiveMedico1, effectiveMedico2]);

  // Check double-booking conflict
  const conflict = useMemo(() => {
    if (isTrancado || !fullMedicoString || !day?.date || !turnoInfo?.id) return null;

    const currentDocList = [effectiveMedico1, effectiveMedico2].filter(Boolean);

    for (const docName of currentDocList) {
      const conflictSlot = allSlotsInPeriod.find((s) => {
        if (s.id && slot && s.id === slot.id) return false;
        if (s.data === day.date && s.turno === turnoInfo.id && !s.trancado) {
          if (s.salaId !== sala?.id && s.medico) {
            const slotDocs = s.medico.split(/\s*(?:\/|,)\s*/).map((d) => d.trim().toUpperCase());
            return slotDocs.includes(docName);
          }
        }
        return false;
      });

      if (conflictSlot) {
        const conflictRoom = salas.find((r) => r.id === conflictSlot.salaId);
        return {
          medico: docName,
          roomName: conflictRoom?.nome || 'Outra Sala',
        };
      }
    }

    return null;
  }, [isTrancado, fullMedicoString, effectiveMedico1, effectiveMedico2, day?.date, turnoInfo?.id, allSlotsInPeriod, slot, sala?.id, salas]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    let finalMotivo = '';
    if (isTrancado) {
      finalMotivo = motivoTranca === 'Outro' ? motivoCustom.trim() || 'Trancado' : motivoTranca;
    }

    const payload = {
      ...(slot || {}),
      id: slot?.id || crypto.randomUUID(),
      data: day.date,
      salaId: sala.id,
      turno: turnoInfo.id,
      trancado: isTrancado,
      motivoTranca: isTrancado ? finalMotivo : '',
      medico: isTrancado ? '' : fullMedicoString,
      medico1: isTrancado ? '' : effectiveMedico1,
      medico2: isTrancado ? '' : effectiveMedico2,
      updatedAt: new Date().toISOString(),
    };

    onSave(payload);
    onClose();
  };

  const handleDelete = () => {
    if (slot?.id) {
      onDelete(slot.id);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${sala?.nome || 'Sala'} — ${day?.label || day?.dayName || ''}`}
      maxWidth="520px"
    >
      <form onSubmit={handleSubmit} className="slot-modal-form">
        {/* Slot context badge header */}
        <div className="slot-modal-header-strip">
          <div className="slot-info-pill">
            <span
              className="slot-color-dot"
              style={{ backgroundColor: sala?.cor || 'var(--accent-primary)' }}
            />
            <span className="slot-sala-title">{sala?.nome}</span>
          </div>
          <div className="slot-turno-pill">
            <span>{turnoInfo?.icon}</span>
            <span>{turnoInfo?.label}</span>
          </div>
        </div>

        {/* Toggle Mode: Ativo / Alocar vs Trancar Turno */}
        <div className="slot-mode-selector">
          <button
            type="button"
            className={`btn-slot-mode${!isTrancado ? ' active' : ''}`}
            onClick={() => setIsTrancado(false)}
          >
            <span>👨‍⚕️</span>
            <span>Alocar Médico / Ativo</span>
          </button>
          <button
            type="button"
            className={`btn-slot-mode btn-mode-lock${isTrancado ? ' active' : ''}`}
            onClick={() => setIsTrancado(true)}
          >
            <span>🔒</span>
            <span>Trancar este Turno</span>
          </button>
        </div>

        {/* LOCKED MODE */}
        {isTrancado ? (
          <div className="slot-lock-box">
            <div className="slot-lock-alert">
              <span className="lock-icon-lg">🔒</span>
              <div>
                <strong>Turno Trancado</strong>
                <p className="text-muted text-xs">
                  A sala ficará indisponível para atendimentos neste turno.
                </p>
              </div>
            </div>

            <div className="input-group full-width">
              <label className="input-label" htmlFor="select-motivo-tranca">
                Motivo da Tranca / Bloqueio:
              </label>
              <select
                id="select-motivo-tranca"
                className="input-field"
                value={motivoTranca}
                onChange={(e) => setMotivoTranca(e.target.value)}
              >
                {MOTIVOS_TRANCA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {motivoTranca === 'Outro' && (
              <div className="input-group full-width">
                <label className="input-label" htmlFor="input-motivo-custom">
                  Descreva o motivo:
                </label>
                <input
                  id="input-motivo-custom"
                  type="text"
                  className="input-field"
                  placeholder="Ex: Reforma elétrica, Pintura, etc."
                  value={motivoCustom}
                  onChange={(e) => setMotivoCustom(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE / DOCTOR ASSIGNMENT MODE */
          <div className="slot-active-box">
            {/* Conflict warning banner */}
            {conflict && (
              <div className="slot-conflict-alert">
                <span className="conflict-icon">⚠️</span>
                <div>
                  <strong>Atenção: Conflito de Escala</strong>
                  <p>
                    <strong>{conflict.medico}</strong> já está escalado(a) na sala{' '}
                    <strong>{conflict.roomName}</strong> neste mesmo turno ({turnoInfo?.label}).
                  </p>
                </div>
              </div>
            )}

            {/* Doctor 1 Selection */}
            <div className="input-group full-width">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <label className="input-label" htmlFor="select-medico" style={{ margin: 0 }}>
                  Médico Responsável:
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setIsCustomMedico(!isCustomMedico);
                    if (!isCustomMedico) {
                      setNovoMedico(medico);
                    }
                  }}
                  style={{ textDecoration: 'underline', color: 'var(--accent-primary)' }}
                >
                  {isCustomMedico ? '← Selecionar da lista' : '+ Outro médico'}
                </button>
              </div>

              {!isCustomMedico ? (
                <select
                  id="select-medico"
                  className="input-field"
                  value={medico}
                  onChange={(e) => setMedico(e.target.value)}
                  autoFocus
                >
                  <option value="">-- Selecione o Médico --</option>
                  {activeMedicos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nome do Médico (ex: DR. JOÃO SILVA)"
                  value={novoMedico}
                  onChange={(e) => setNovoMedico(e.target.value.toUpperCase())}
                  autoFocus
                />
              )}
            </div>

            {/* Optional Doctor 2 Selection */}
            {!showSecondDoctor ? (
              <div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowSecondDoctor(true)}
                  style={{
                    color: 'var(--accent-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>+</span> Adicionar 2º médico neste turno
                </button>
              </div>
            ) : (
              <div
                className="input-group full-width"
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-medium)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <label className="input-label" htmlFor="select-medico-2" style={{ margin: 0 }}>
                    2º Médico:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        setIsCustomMedico2(!isCustomMedico2);
                        if (!isCustomMedico2) {
                          setNovoMedico2(medico2);
                        }
                      }}
                      style={{ textDecoration: 'underline', color: 'var(--accent-primary)' }}
                    >
                      {isCustomMedico2 ? '← Selecionar da lista' : '+ Outro médico'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-danger"
                      onClick={() => {
                        setShowSecondDoctor(false);
                        setMedico2('');
                        setNovoMedico2('');
                      }}
                      title="Remover 2º médico"
                    >
                      ✕ Remover
                    </button>
                  </div>
                </div>

                {!isCustomMedico2 ? (
                  <select
                    id="select-medico-2"
                    className="input-field"
                    value={medico2}
                    onChange={(e) => setMedico2(e.target.value)}
                  >
                    <option value="">-- Selecione o 2º Médico --</option>
                    {activeMedicos.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Nome do 2º Médico"
                    value={novoMedico2}
                    onChange={(e) => setNovoMedico2(e.target.value.toUpperCase())}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div
          className="modal-footer"
          style={{
            padding: '1rem 0 0 0',
            marginTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {slot?.id && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              style={{ marginRight: 'auto' }}
              title="Limpar e liberar turno"
            >
              🗑️ Liberar / Excluir
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {isTrancado ? '🔒 Salvar Tranca' : '💾 Salvar Escala'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

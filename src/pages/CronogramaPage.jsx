import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import {
  DIAS_SEMANA,
  normalizeDiaId,
  TURNOS,
} from '../utils/helpers';
import SlotModal from '../components/SlotModal';
import SalasManagerModal from '../components/SalasManagerModal';
import { useToast } from '../contexts/ToastContext';

export default function CronogramaPage() {
  const toast = useToast();
  const {
    salasConfig: salas = [],
    cronogramaSalas: allSlots = [],
    saveSalasConfig,
    saveCronogramaSlot,
    deleteCronogramaSlot,
  } = useData();

  // Modals state
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [activeSlotTarget, setActiveSlotTarget] = useState(null); // { slot, sala, day, turnoInfo }
  const [salasModalOpen, setSalasModalOpen] = useState(false);

  const refresh = () => {};

  // Visible active rooms sorted by ordem
  const visibleSalas = useMemo(() => {
    return salas
      .filter((s) => s.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }, [salas]);

  // Fast map for slot retrieval: key = `${diaId}_${salaId}_${turno}`
  const slotMap = useMemo(() => {
    const map = new Map();
    allSlots.forEach((s) => {
      const diaId = normalizeDiaId(s.dia || s.data);
      if (diaId) {
        const key = `${diaId}_${s.salaId}_${s.turno}`;
        map.set(key, s);
      }
    });
    return map;
  }, [allSlots]);

  // Detect scheduling conflicts (same doctor in 2 rooms at the same day & shift)
  const conflicts = useMemo(() => {
    const list = [];
    const occurrences = new Map(); // key = `${diaId}_${turno}_${medico}` -> [slot]

    allSlots.forEach((s) => {
      if (s.trancado || !s.medico || !s.medico.trim()) return;
      const diaId = normalizeDiaId(s.dia || s.data);
      if (!diaId) return;

      const docs = s.medico.split(/\s*(?:\/|,)\s*/).filter(Boolean);
      docs.forEach((docName) => {
        const key = `${diaId}_${s.turno}_${docName.trim().toUpperCase()}`;
        if (!occurrences.has(key)) {
          occurrences.set(key, []);
        }
        occurrences.get(key).push(s);
      });
    });

    occurrences.forEach((slotsGroup, key) => {
      if (slotsGroup.length > 1) {
        const first = slotsGroup[0];
        const diaId = normalizeDiaId(first.dia || first.data);
        const dayObj = DIAS_SEMANA.find((d) => d.id === diaId);
        const turnoObj = TURNOS.find((t) => t.id === first.turno);
        const roomNames = Array.from(
          new Set(
            slotsGroup.map((sg) => {
              const r = salas.find((room) => room.id === sg.salaId);
              return r?.nome || 'Sala';
            })
          )
        );

        if (roomNames.length > 1) {
          const doctorName = key.split('_').slice(2).join('_');
          list.push({
            medico: doctorName,
            diaId,
            dayName: dayObj?.label || diaId,
            turno: turnoObj?.label || first.turno,
            rooms: roomNames,
          });
        }
      }
    });

    return list;
  }, [allSlots, salas]);

  // Slot modal handlers
  const handleOpenSlot = (sala, day, turnoInfo) => {
    const key = `${day.id}_${sala.id}_${turnoInfo.id}`;
    const existingSlot = slotMap.get(key) || null;
    setActiveSlotTarget({
      slot: existingSlot,
      sala,
      day: { ...day, date: day.id, dayName: day.label },
      turnoInfo,
    });
    setSlotModalOpen(true);
  };

  const handleSaveSlot = (slotData) => {
    const diaId = normalizeDiaId(slotData.dia || slotData.data);
    const normalizedData = {
      ...slotData,
      data: diaId,
      dia: diaId,
    };
    saveCronogramaSlot(normalizedData);
    refresh();
    if (toast?.show) {
      toast.show(slotData.trancado ? 'Turno trancado!' : 'Escala salva com sucesso!', 'success');
    }
  };

  const handleDeleteSlot = (id) => {
    deleteCronogramaSlot(id);
    refresh();
    if (toast?.show) {
      toast.show('Turno liberado!', 'info');
    }
  };

  // 1-Click quick lock toggle
  const handleQuickToggleLock = (e, sala, day, turnoInfo) => {
    e.stopPropagation();
    const key = `${day.id}_${sala.id}_${turnoInfo.id}`;
    const existing = slotMap.get(key);

    if (existing?.trancado) {
      // Unlock
      deleteCronogramaSlot(existing.id);
      refresh();
      if (toast?.show) {
        toast.show(`Turno destrancado (${sala.nome})`, 'success');
      }
    } else {
      // Lock
      const newSlot = {
        ...(existing || {}),
        id: existing?.id || crypto.randomUUID(),
        data: day.id,
        dia: day.id,
        salaId: sala.id,
        turno: turnoInfo.id,
        trancado: true,
        motivoTranca: 'Sem Expediente',
        medico: '',
        procedimento: '',
        status: 'trancado',
        updatedAt: new Date().toISOString(),
      };
      saveCronogramaSlot(newSlot);
      refresh();
      if (toast?.show) {
        toast.show(`Turno trancado (${sala.nome})`, 'info');
      }
    }
  };

  // Save rooms config
  const handleSaveSalas = (newSalas) => {
    saveSalasConfig(newSalas);
  };

  return (
    <>
      {/* Page Header: Title + Gerenciar Salas Button Only */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cronograma de Salas & Escala</h1>
          <p className="page-subtitle">
            Escala semanal de médicos por sala (Segunda a Sábado)
          </p>
        </div>

        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setSalasModalOpen(true)}
            title="Gerenciar salas da clínica"
          >
            <span>⚙️</span> Gerenciar Salas
          </button>
        </div>
      </div>

      <div className="page-container cronograma-page-container">
        {/* Conflicts Alert Banner if any */}
        {conflicts.length > 0 && (
          <div className="cronograma-conflict-banner">
            <div className="conflict-banner-icon">⚠️</div>
            <div className="conflict-banner-content">
              <strong>
                {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''} de agenda detectado
                {conflicts.length > 1 ? 's' : ''}:
              </strong>
              <ul className="conflict-banner-list">
                {conflicts.map((c, idx) => (
                  <li key={idx}>
                    <strong>{c.medico}</strong> está escalado(a) simultaneamente em{' '}
                    <strong>{c.rooms.join(' e ')}</strong> na{' '}
                    <strong>
                      {c.dayName} ({c.turno})
                    </strong>
                    .
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* GRADE SEMANAL DE MÉDICOS (MATRIZ SALAS x SEGUNDA A SÁBADO) */}
        <div className="cronograma-grid-wrapper">
          <div className="cronograma-matrix">
            {/* Header Row: Segunda a Sábado */}
            <div className="matrix-header-row">
              <div className="matrix-header-cell matrix-corner-cell">
                <span>Sala / Turno</span>
              </div>
              {DIAS_SEMANA.map((day) => (
                <div key={day.id} className="matrix-header-cell matrix-day-cell">
                  <span className="matrix-day-name">{day.short}</span>
                </div>
              ))}
            </div>

            {/* Rooms Rows */}
            {visibleSalas.map((sala) => {
              return (
                <div key={sala.id} className="matrix-room-group">
                  {/* Room Header Banner: colored bar + room name only */}
                  <div className="matrix-room-banner">
                    <span
                      className="matrix-room-color-bar"
                      style={{ backgroundColor: sala.cor || 'var(--accent-primary)' }}
                    />
                    <strong className="matrix-room-name">{sala.nome}</strong>
                  </div>

                  {/* Shifts Rows */}
                  {TURNOS.map((turno) => (
                    <div key={turno.id} className="matrix-shift-row">
                      {/* Column 1: Shift Info (Icon + Name Only, no hours) */}
                      <div className="matrix-shift-label-cell">
                        <span className="shift-icon">{turno.icon}</span>
                        <div className="shift-names">
                          <strong>{turno.label}</strong>
                        </div>
                      </div>

                      {/* Columns 2 to 7: Monday to Saturday */}
                      {DIAS_SEMANA.map((day) => {
                        const key = `${day.id}_${sala.id}_${turno.id}`;
                        const slot = slotMap.get(key);
                        const isLocked = slot?.trancado;
                        const hasDoctor = slot && !slot.trancado && slot.medico;

                        const hasConflict =
                          hasDoctor &&
                          conflicts.some((c) => {
                            if (c.diaId !== day.id || c.turno !== turno.label) return false;
                            const docNames = slot.medico
                              .split(/\s*(?:\/|,)\s*/)
                              .map((d) => d.trim().toUpperCase());
                            return docNames.includes(c.medico);
                          });

                        return (
                          <div
                            key={day.id}
                            className={`matrix-slot-cell${
                              isLocked
                                ? ' slot-locked'
                                : hasDoctor
                                ? ' slot-occupied'
                                : ' slot-empty'
                            }${hasConflict ? ' slot-has-conflict' : ''}`}
                            onClick={() => handleOpenSlot(sala, day, turno)}
                          >
                            {/* LOCKED SHIFT */}
                            {isLocked ? (
                              <div className="slot-locked-content">
                                <div className="slot-lock-top">
                                  <span className="lock-icon">🔒</span>
                                  <span className="lock-badge">TRANCADO</span>
                                  <button
                                    type="button"
                                    className="btn-quick-unlock"
                                    onClick={(e) => handleQuickToggleLock(e, sala, day, turno)}
                                    title="Destrancar turno"
                                  >
                                    🔓
                                  </button>
                                </div>
                                <span className="slot-lock-reason" title={slot.motivoTranca}>
                                  {slot.motivoTranca || 'Sem expediente'}
                                </span>
                              </div>
                            ) : hasDoctor ? (
                              /* SCHEDULED DOCTOR */
                              <div className="slot-occupied-content">
                                <div className="slot-occ-header">
                                  <span className="slot-status-dot" title="Médico escalado" />
                                  <span className="slot-doctor-name" title={slot.medico}>
                                    {slot.medico}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-quick-lock-toggle"
                                    onClick={(e) => handleQuickToggleLock(e, sala, day, turno)}
                                    title="Trancar este turno"
                                  >
                                    🔒
                                  </button>
                                </div>

                                {hasConflict && (
                                  <div className="slot-occ-footer">
                                    <span
                                      className="slot-conflict-tag"
                                      title="Médico escalado em 2 salas!"
                                    >
                                      ⚠️ Conflito
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* FREE / EMPTY SLOT */
                              <div className="slot-empty-content">
                                <span className="slot-empty-plus">+</span>
                                <span className="slot-empty-label">Livre</span>
                                <button
                                  type="button"
                                  className="btn-quick-lock-ghost"
                                  onClick={(e) => handleQuickToggleLock(e, sala, day, turno)}
                                  title="Trancar turno"
                                >
                                  🔒
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL: Slot Edit / Lock */}
      {slotModalOpen && activeSlotTarget && (
        <SlotModal
          isOpen={slotModalOpen}
          onClose={() => {
            setSlotModalOpen(false);
            setActiveSlotTarget(null);
          }}
          slot={activeSlotTarget.slot}
          sala={activeSlotTarget.sala}
          day={activeSlotTarget.day}
          turnoInfo={activeSlotTarget.turnoInfo}
          onSave={handleSaveSlot}
          onDelete={handleDeleteSlot}
          allSlotsInPeriod={allSlots}
          salas={salas}
        />
      )}

      {/* MODAL: Salas Manager */}
      {salasModalOpen && (
        <SalasManagerModal
          isOpen={salasModalOpen}
          onClose={() => setSalasModalOpen(false)}
          salas={salas}
          onSaveSalas={handleSaveSalas}
        />
      )}
    </>
  );
}

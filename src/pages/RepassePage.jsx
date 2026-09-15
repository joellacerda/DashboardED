import { useState, useMemo } from 'react';
import { getData, addItem, updateItem, deleteItem, setData } from '../utils/storage';
import {
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioMedicoInPeriod,
  exportCSV,
  exportPDF,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';

export default function RepassePage() {
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [medicosList, setMedicosList] = useState(() => getData('medicos'));
  const [ajustesList, setAjustesList] = useState(() => getData('repassesAjustes'));
  const [detalhesExames, setDetalhesExames] = useState(() => getData('detalhesExames'));
  const [fluxoCaixa, setFluxoCaixa] = useState(() => getData('fluxoCaixa'));

  const [editAjusteModal, setEditAjusteModal] = useState(false);
  const [selectedMedico, setSelectedMedico] = useState(null);
  const [ajusteForm, setAjusteForm] = useState({ creditos: '', debitos: '', bnb: '', obs: '', isSocio: true });

  const [manageMedicosModal, setManageMedicosModal] = useState(false);
  const [newMedicoNome, setNewMedicoNome] = useState('');
  const [newMedicoSocio, setNewMedicoSocio] = useState(true);
  const [deleteMedicoId, setDeleteMedicoId] = useState(null);

  const refreshAll = () => {
    setMedicosList(getData('medicos'));
    setAjustesList(getData('repassesAjustes'));
    setDetalhesExames(getData('detalhesExames'));
    setFluxoCaixa(getData('fluxoCaixa'));
  };

  // --- Calculate Clinic Deficit for current period ---
  const periodFluxo = useMemo(
    () => fluxoCaixa.filter((f) => isDateInPeriod(f.data, period)),
    [fluxoCaixa, period]
  );

  const totalEntradasFluxo = useMemo(
    () => periodFluxo.filter((f) => f.tipo === 'entrada').reduce((s, f) => s + Number(f.valor || 0), 0),
    [periodFluxo]
  );

  const totalSaidasFluxo = useMemo(
    () => periodFluxo.filter((f) => f.tipo === 'saida').reduce((s, f) => s + Number(f.valor || 0), 0),
    [periodFluxo]
  );

  const deficitClinica = Math.max(0, totalSaidasFluxo - totalEntradasFluxo);

  // --- Merge registered doctors with doctors found in exam records ---
  const allDoctors = useMemo(() => {
    const list = medicosList.map((m) => ({
      ...m,
      nome: m.nome.trim().toUpperCase(),
      ativo: m.ativo !== false,
    }));
    const registeredNames = new Set(list.map((m) => m.nome.trim().toUpperCase()));

    // Collect from exam records
    detalhesExames.forEach((e) => {
      if (e.medico && !registeredNames.has(e.medico.trim().toUpperCase())) {
        registeredNames.add(e.medico.trim().toUpperCase());
        list.push({ id: `auto_${e.medico.trim().toUpperCase()}`, nome: e.medico.trim().toUpperCase(), socio: true, auto: true, ativo: true });
      }
      if (e.medico2 && !registeredNames.has(e.medico2.trim().toUpperCase())) {
        registeredNames.add(e.medico2.trim().toUpperCase());
        list.push({ id: `auto_${e.medico2.trim().toUpperCase()}`, nome: e.medico2.trim().toUpperCase(), socio: true, auto: true, ativo: true });
      }
    });

    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [medicosList, detalhesExames]);

  // Count active partner doctors (sócios)
  const countSocios = useMemo(
    () => allDoctors.filter((m) => m.socio !== false && m.ativo !== false).length,
    [allDoctors]
  );

  const cotaPorSocio = countSocios > 0 && deficitClinica > 0 ? deficitClinica / countSocios : 0;

  // --- Build Repasse Table Row Items ---
  const repasseRows = useMemo(() => {
    return allDoctors
      .map((medico) => {
        const isSocio = medico.socio !== false;
        const isActive = medico.ativo !== false;

        // 1. Honorários
        const honorarios = detalhesExames.reduce((sum, exam) => {
          return sum + getHonorarioMedicoInPeriod(exam, medico.nome, period);
        }, 0);

        // 2. Ajustes (Créditos, Débitos, BNB, OBS)
        const key = `${medico.nome.trim().toLowerCase()}_${period.start}`;
        const ajuste = ajustesList.find((a) => a.key === key) || {};

        const creditos = Number(ajuste.creditos) || 0;
        const debitos = Number(ajuste.debitos) || 0;
        const bnb = Number(ajuste.bnb) || 0;
        const obs = ajuste.obs || '';

        // 3. Cota clínica (apenas para sócios ativos)
        const cotaClinica = isSocio && isActive ? cotaPorSocio : 0;

        // 4. Total calculation
        // Total = Honorários + Créditos - Débitos - BNB - Cota clínica
        const total = honorarios + creditos - debitos - bnb - cotaClinica;

        return {
          medico,
          nome: medico.nome,
          isSocio,
          isActive,
          honorarios,
          creditos,
          debitos,
          bnb,
          cotaClinica,
          total,
          obs,
          ajusteId: ajuste.id,
          key,
        };
      })
      .filter((row) => (row.isSocio && row.isActive) || row.honorarios > 0 || row.creditos > 0 || row.debitos > 0 || row.bnb > 0 || row.obs);
  }, [allDoctors, detalhesExames, period, ajustesList, cotaPorSocio]);

  // Summary Totals
  const totalHonorariosRepassados = repasseRows.reduce((s, r) => s + r.honorarios, 0);
  const totalCreditos = repasseRows.reduce((s, r) => s + r.creditos, 0);
  const totalDebitos = repasseRows.reduce((s, r) => s + r.debitos, 0);
  const totalBNB = repasseRows.reduce((s, r) => s + r.bnb, 0);
  const totalCotaClinica = repasseRows.reduce((s, r) => s + r.cotaClinica, 0);
  const totalLiquidoGeral = repasseRows.reduce((s, r) => s + r.total, 0);

  // --- Handlers for Editing Doctor Adjustments ---
  const openEditAjuste = (row) => {
    setSelectedMedico(row.medico);
    setAjusteForm({
      creditos: row.creditos || '',
      debitos: row.debitos || '',
      bnb: row.bnb || '',
      obs: row.obs || '',
      isSocio: row.isSocio,
    });
    setEditAjusteModal(true);
  };

  const handleSaveAjuste = (e) => {
    e.preventDefault();
    if (!selectedMedico) return;

    // Update socio status in medicosList if modified
    const currentMedicos = getData('medicos');
    const existingIndex = currentMedicos.findIndex(
      (m) => m.nome.trim().toLowerCase() === selectedMedico.nome.trim().toLowerCase()
    );

    if (existingIndex !== -1) {
      currentMedicos[existingIndex].socio = ajusteForm.isSocio;
      setData('medicos', currentMedicos);
    } else {
      currentMedicos.push({
        id: crypto.randomUUID(),
        nome: selectedMedico.nome,
        socio: ajusteForm.isSocio,
      });
      setData('medicos', currentMedicos);
    }

    // Save adjustment record
    const key = `${selectedMedico.nome.trim().toLowerCase()}_${period.start}`;
    const currentAjustes = getData('repassesAjustes');
    const ajusteIndex = currentAjustes.findIndex((a) => a.key === key);

    const ajusteData = {
      key,
      medicoNome: selectedMedico.nome,
      periodStart: period.start,
      periodEnd: period.end,
      creditos: ajusteForm.creditos,
      debitos: ajusteForm.debitos,
      bnb: ajusteForm.bnb,
      obs: ajusteForm.obs,
    };

    if (ajusteIndex !== -1) {
      currentAjustes[ajusteIndex] = { ...currentAjustes[ajusteIndex], ...ajusteData };
    } else {
      currentAjustes.push({ id: crypto.randomUUID(), ...ajusteData });
    }

    setData('repassesAjustes', currentAjustes);
    refreshAll();
    setEditAjusteModal(false);
  };

  // --- Handlers for Managing Doctors ---
  const handleAddMedico = (e) => {
    e.preventDefault();
    if (!newMedicoNome.trim()) return;

    const currentMedicos = getData('medicos') || [];
    const nomeUpper = newMedicoNome.trim().toUpperCase();
    const existing = currentMedicos.find((m) => m.nome.trim().toUpperCase() === nomeUpper);
    if (existing) {
      if (existing.ativo === false) {
        updateItem('medicos', existing.id, { ativo: true, socio: newMedicoSocio });
        setNewMedicoNome('');
        refreshAll();
        return;
      }
      alert('Médico já cadastrado!');
      return;
    }

    addItem('medicos', { nome: nomeUpper, socio: newMedicoSocio, ativo: true });
    setNewMedicoNome('');
    refreshAll();
  };

  const handleDeleteMedico = () => {
    if (deleteMedicoId) {
      deleteItem('medicos', deleteMedicoId);
      refreshAll();
    }
  };

  const toggleMedicoSocio = (medico) => {
    const currentMedicos = getData('medicos') || [];
    const index = currentMedicos.findIndex(
      (m) => (medico.id && m.id === medico.id) || m.nome.trim().toUpperCase() === medico.nome.trim().toUpperCase()
    );
    if (index !== -1) {
      updateItem('medicos', currentMedicos[index].id, { socio: !currentMedicos[index].socio });
    } else {
      addItem('medicos', {
        nome: medico.nome.trim().toUpperCase(),
        socio: !medico.socio,
        ativo: medico.ativo !== false,
      });
    }
    refreshAll();
  };

  const toggleMedicoAtivo = (medico) => {
    const currentMedicos = getData('medicos') || [];
    const index = currentMedicos.findIndex(
      (m) => (medico.id && m.id === medico.id) || m.nome.trim().toUpperCase() === medico.nome.trim().toUpperCase()
    );
    const isCurrentlyActive = medico.ativo !== false;
    if (index !== -1) {
      updateItem('medicos', currentMedicos[index].id, { ativo: !isCurrentlyActive });
    } else {
      addItem('medicos', {
        nome: medico.nome.trim().toUpperCase(),
        socio: medico.socio !== false,
        ativo: !isCurrentlyActive,
      });
    }
    refreshAll();
  };

  // --- Export Columns ---
  const exportColumns = [
    { key: 'nome', label: 'Médico', accessor: (r) => `${r.nome}${r.isSocio ? ' (Sócio)' : ''}` },
    { key: 'honorarios', label: 'Honorários', accessor: (r) => formatCurrency(r.honorarios) },
    { key: 'creditos', label: 'Créditos', accessor: (r) => formatCurrency(r.creditos) },
    { key: 'debitos', label: 'Débitos', accessor: (r) => (r.debitos > 0 ? `-${formatCurrency(r.debitos)}` : 'R$ 0,00') },
    { key: 'bnb', label: 'BNB', accessor: (r) => (r.bnb > 0 ? `-${formatCurrency(r.bnb)}` : 'R$ 0,00') },
    { key: 'cotaClinica', label: 'Cota Clínica', accessor: (r) => (r.cotaClinica > 0 ? `-${formatCurrency(r.cotaClinica)}` : 'R$ 0,00') },
    { key: 'total', label: 'Total Repasse', accessor: (r) => (r.total >= 0 ? formatCurrency(r.total) : `-${formatCurrency(Math.abs(r.total))}`) },
    { key: 'obs', label: 'OBS' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Repasses Médicos</h1>
        <div className="header-actions">
          <div className="period-selector">
            <button
              className="period-btn"
              onClick={() => setPeriod(navigateAcquisitionPeriod(period, -1))}
              title="Período anterior"
            >
              ◀
            </button>
            <span className="period-label">{period.label}</span>
            <button
              className="period-btn"
              onClick={() => setPeriod(navigateAcquisitionPeriod(period, 1))}
              title="Próximo período"
            >
              ▶
            </button>
          </div>
          <button className="btn btn-secondary" onClick={() => setManageMedicosModal(true)}>
            ⚙️ Gerenciar Médicos & Sócios
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* KPI Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Honorários</span>
              <div className="summary-card-icon">👨‍⚕️</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalHonorariosRepassados)}</div>
            <div className="summary-card-footer">Nos exames do período aquisitivo</div>
          </div>

          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Déficit da Clínica</span>
              <div className="summary-card-icon amber">📉</div>
            </div>
            <div className={`summary-card-value ${deficitClinica > 0 ? 'value-negative' : 'value-positive'}`}>
              {deficitClinica > 0 ? formatCurrency(deficitClinica) : 'R$ 0,00'}
            </div>
            <div className="summary-card-footer">
              {deficitClinica > 0
                ? `Cota por sócio (${countSocios}): -${formatCurrency(cotaPorSocio)}`
                : 'Clínica sem déficit no período'}
            </div>
          </div>

          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Repasses Líquidos</span>
              <div className="summary-card-icon blue">💰</div>
            </div>
            <div className={`summary-card-value ${totalLiquidoGeral >= 0 ? 'value-positive' : 'value-negative'}`}>
              {totalLiquidoGeral >= 0 ? formatCurrency(totalLiquidoGeral) : `-${formatCurrency(Math.abs(totalLiquidoGeral))}`}
            </div>
            <div className="summary-card-footer">Total final dos repasses médicos</div>
          </div>

          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Médicos Ativos</span>
              <div className="summary-card-icon purple">👥</div>
            </div>
            <div className="summary-card-value">{repasseRows.length}</div>
            <div className="summary-card-footer">{countSocios} médico(s) sócio(s)</div>
          </div>
        </div>

        {/* Repasses Data Table (Matching the User's Screenshot Layout) */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Demostrativo de Repasse por Médico</h3>
            <div className="table-actions">
              <ExportMenu
                onExportCSV={() => exportCSV(repasseRows, exportColumns, `repasses_medicos_${period.start}`)}
                onExportPDF={() => exportPDF(repasseRows, exportColumns, `Repasses Médicos — ${period.label}`)}
              />
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'oklch(22% 0.04 160)' }}>
                  <th style={{ color: 'white', fontWeight: 600 }}>Médico</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>Honorários</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>Créditos</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>Débitos</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>BNB</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>Cota clínica</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>Total</th>
                  <th style={{ color: 'white', fontWeight: 600 }}>OBS</th>
                  <th style={{ color: 'white', fontWeight: 600, width: '70px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {repasseRows.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="table-empty">
                        <div className="table-empty-icon">👨‍⚕️</div>
                        <p>Nenhum médico ou repasse registrado para este período.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {repasseRows.map((row) => (
                      <tr key={row.nome}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                            <span>{row.nome}</span>
                            {row.isSocio ? (
                              <span className="badge badge-success" title="Médico Sócio da Clínica">
                                Sócio
                              </span>
                            ) : (
                              <span className="badge badge-info" style={{ opacity: 0.7 }} title="Médico Não-Sócio">
                                Não-sócio
                              </span>
                            )}
                            {!row.isActive && (
                              <span className="badge badge-danger" style={{ opacity: 0.8 }} title="Médico Desativado (histórico preservado)">
                                Inativo
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="value-currency">
                          {formatCurrency(row.honorarios)}
                        </td>

                        <td className={row.creditos > 0 ? 'value-positive' : ''}>
                          {formatCurrency(row.creditos)}
                        </td>

                        <td className={row.debitos > 0 ? 'value-negative' : ''}>
                          {row.debitos > 0 ? `-${formatCurrency(row.debitos)}` : 'R$ 0,00'}
                        </td>

                        <td className={row.bnb > 0 ? 'value-negative' : ''}>
                          {row.bnb > 0 ? `-${formatCurrency(row.bnb)}` : 'R$ 0,00'}
                        </td>

                        <td className={row.cotaClinica > 0 ? 'value-negative' : ''}>
                          {row.cotaClinica > 0 ? `-${formatCurrency(row.cotaClinica)}` : 'R$ 0,00'}
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={row.total >= 0 ? 'value-positive' : 'value-negative'} style={{ fontWeight: 700 }}>
                              {row.total >= 0 ? formatCurrency(row.total) : `-${formatCurrency(Math.abs(row.total))}`}
                            </span>
                            <span style={{ fontSize: '10px', color: row.total >= 0 ? 'var(--color-emerald)' : 'var(--color-red)' }}>
                              {row.total >= 0 ? '▲ A receber da clínica' : '▼ A pagar à clínica'}
                            </span>
                          </div>
                        </td>

                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.obs || '—'}
                        </td>

                        <td>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => openEditAjuste(row)}
                            title="Editar débitos, créditos, BNB e sócio"
                          >
                            ✏️
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Totals Row */}
                    <tr className="totals-row">
                      <td style={{ fontWeight: 700 }}>Totais no período:</td>
                      <td className="value-currency">{formatCurrency(totalHonorariosRepassados)}</td>
                      <td className="value-positive">{formatCurrency(totalCreditos)}</td>
                      <td className="value-negative">{totalDebitos > 0 ? `-${formatCurrency(totalDebitos)}` : 'R$ 0,00'}</td>
                      <td className="value-negative">{totalBNB > 0 ? `-${formatCurrency(totalBNB)}` : 'R$ 0,00'}</td>
                      <td className="value-negative">{totalCotaClinica > 0 ? `-${formatCurrency(totalCotaClinica)}` : 'R$ 0,00'}</td>
                      <td className={totalLiquidoGeral >= 0 ? 'value-positive' : 'value-negative'} style={{ fontWeight: 700 }}>
                        {totalLiquidoGeral >= 0 ? formatCurrency(totalLiquidoGeral) : `-${formatCurrency(Math.abs(totalLiquidoGeral))}`}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {repasseRows.length > 0 && (
            <div className="table-footer">
              <span>{repasseRows.length} médico(s) no demonstrativo</span>
              <span>
                Cota Clínica Rateada por Sócio: {formatCurrency(cotaPorSocio)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Editar Ajustes do Repasse (Créditos, Débitos, BNB, Sócio, OBS) */}
      <Modal
        isOpen={editAjusteModal}
        onClose={() => setEditAjusteModal(false)}
        title={`Ajustes de Repasse — ${selectedMedico?.nome || ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditAjusteModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveAjuste}>
              Salvar Ajustes
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveAjuste} autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group full-width">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                <input
                  type="checkbox"
                  checked={ajusteForm.isSocio}
                  onChange={(e) => setAjusteForm({ ...ajusteForm, isSocio: e.target.checked })}
                />
                <span>👑 <strong>Médico Sócio da Clínica</strong> (Participa do rateio da cota clínica em caso de déficit)</span>
              </label>
            </div>

            <div className="input-group">
              <label className="input-label">Créditos Adicionais (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={ajusteForm.creditos}
                onChange={(e) => setAjusteForm({ ...ajusteForm, creditos: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Débitos / Descontos (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={ajusteForm.debitos}
                onChange={(e) => setAjusteForm({ ...ajusteForm, debitos: e.target.value })}
              />
            </div>

            <div className="input-group full-width">
              <label className="input-label">Financiamento / BNB (R$)</label>
              <input
                type="number"
                className="input-field"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={ajusteForm.bnb}
                onChange={(e) => setAjusteForm({ ...ajusteForm, bnb: e.target.value })}
              />
            </div>

            <div className="input-group full-width">
              <label className="input-label">Observações (OBS)</label>
              <textarea
                className="input-field"
                rows="3"
                placeholder="Anotações ou observações para o repasse deste médico"
                value={ajusteForm.obs}
                onChange={(e) => setAjusteForm({ ...ajusteForm, obs: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Gerenciar Médicos e Sócios */}
      <Modal
        isOpen={manageMedicosModal}
        onClose={() => setManageMedicosModal(false)}
        title="Gerenciar Médicos da Clínica"
        footer={
          <button className="btn btn-secondary" onClick={() => setManageMedicosModal(false)}>
            Fechar
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form onSubmit={handleAddMedico} autoComplete="off" style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: 'var(--text-sm)' }}>+ Cadastrar Novo Médico</h4>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-field"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome do médico (ex: DR. OLIVEIRA)"
                style={{ flex: 1, minWidth: '200px' }}
                value={newMedicoNome}
                onChange={(e) => setNewMedicoNome(e.target.value.toUpperCase())}
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newMedicoSocio}
                  onChange={(e) => setNewMedicoSocio(e.target.checked)}
                />
                É Sócio?
              </label>
              <button type="submit" className="btn btn-primary btn-sm">
                Adicionar
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>Médicos Cadastrados:</h4>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {allDoctors.filter((m) => m.ativo !== false).length} ativo(s) • {allDoctors.filter((m) => m.ativo === false).length} desativado(s)
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 0.35rem 0' }}>
              Médicos desativados não aparecem nos seletores ao cadastrar novos exames, mas todo seu histórico permanece preservado.
            </p>
            {allDoctors.length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Nenhum médico cadastrado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
                {allDoctors.map((m) => (
                  <div
                    key={m.id || m.nome}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.85rem',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-sm)',
                      opacity: m.ativo === false ? 0.75 : 1,
                      borderLeft: m.ativo === false ? '3px solid var(--color-red)' : '3px solid var(--color-emerald)',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: '200px' }}>
                      <strong style={{ color: m.ativo === false ? 'var(--text-muted)' : 'inherit', textDecoration: m.ativo === false ? 'line-through' : 'none' }}>
                        {m.nome}
                      </strong>
                      <button
                        type="button"
                        className={`badge ${m.socio !== false ? 'badge-success' : 'badge-info'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => toggleMedicoSocio(m)}
                        title="Clique para alterar status de sócio"
                      >
                        {m.socio !== false ? '👑 Sócio' : '👤 Não-sócio'}
                      </button>
                      <button
                        type="button"
                        className={`badge ${m.ativo !== false ? 'badge-success' : 'badge-danger'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => toggleMedicoAtivo(m)}
                        title={m.ativo !== false ? 'Clique para desativar médico' : 'Clique para reativar médico'}
                      >
                        {m.ativo !== false ? '🟢 Ativo' : '🔴 Desativado'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${m.ativo !== false ? 'btn-ghost' : 'btn-secondary'}`}
                        style={{
                          fontSize: 'var(--text-xs)',
                          padding: '0.25rem 0.65rem',
                          color: m.ativo !== false ? 'var(--color-red)' : 'var(--color-emerald)',
                          borderColor: m.ativo !== false ? 'var(--border-medium)' : 'var(--color-emerald)',
                        }}
                        onClick={() => toggleMedicoAtivo(m)}
                        title={
                          m.ativo !== false
                            ? 'Desativar médico: não aparecerá mais nos seletores ao adicionar novos exames, mantendo todo o histórico'
                            : 'Reativar médico: voltará a aparecer nos seletores de exames'
                        }
                      >
                        {m.ativo !== false ? '⏸️ Desativar' : '▶️ Reativar'}
                      </button>

                      {!m.auto && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setDeleteMedicoId(m.id)}
                          title="Remover médico do cadastro"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteMedicoId}
        onClose={() => setDeleteMedicoId(null)}
        onConfirm={handleDeleteMedico}
        message="Tem certeza que deseja remover este médico do cadastro? Se deseja apenas ocultá-lo dos novos exames mantendo todo o histórico, utilize a opção 'Desativar'."
      />
    </>
  );
}

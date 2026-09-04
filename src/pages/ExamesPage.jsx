import { useState, useMemo } from 'react';
import { getData, addItem, updateItem, deleteItem, getItem } from '../utils/storage';
import {
  formatDate,
  getTodayISO,
  exportCSV,
  exportPDF,
  DEFAULT_EXAMES,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  examePermiteComplementar,
  PROCEDIMENTOS_COMPLEMENTARES,
  normalizeProcedimentosComplementares,
  formatProcedimentosComplementares,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import AutoCompleteInput from '../components/AutoCompleteInput';

const emptyForm = { data: '', paciente: '', exame: '', medico: '', procedimentoComplementar: '' };

const columns = [
  { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
  { key: 'paciente', label: 'Paciente' },
  {
    key: 'exame', label: 'Exame', accessor: (item) => {
      const base = item.exame ? item.exame.toUpperCase() : '';
      const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
      return compl ? `${base} + ${compl}` : base;
    }
  },
  { key: 'medico', label: 'Médico' },
];

export default function ExamesPage({ onNavigateToDetalhes }) {
  const [data, setData] = useState(() => getData('exames'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());

  const refresh = () => setData(getData('exames'));

  // Combine exames particulares with standalone details so every particular exam is visible
  const allParticulares = useMemo(() => {
    const examesList = data || [];
    const detalhesList = getData('detalhesExames') || [];

    const getMatchedDetalhe = (e) =>
      detalhesList.find(
        (d) =>
          d.id === e.id ||
          (d.data === e.data &&
            d.paciente &&
            e.paciente &&
            d.paciente.trim().toLowerCase() === e.paciente.trim().toLowerCase())
      );

    const mergedExames = examesList.map((e) => {
      const match = getMatchedDetalhe(e);
      return {
        ...e,
        exame: e.exame || match?.tipoExame || '',
        procedimentoComplementar: e.procedimentoComplementar || match?.procedimentoComplementar || '',
      };
    });

    const isMatched = (d) =>
      examesList.some(
        (e) =>
          e.id === d.id ||
          (e.data === d.data &&
            e.paciente &&
            d.paciente &&
            e.paciente.trim().toLowerCase() === d.paciente.trim().toLowerCase())
      );

    const standalone = detalhesList
      .filter((d) => !isMatched(d))
      .map((d) => ({
        id: d.id,
        data: d.data,
        paciente: d.paciente || '',
        exame: d.tipoExame || '',
        procedimentoComplementar: d.procedimentoComplementar || '',
        medico: d.medico || '',
        isDetailOnly: true,
      }));

    return [...mergedExames, ...standalone];
  }, [data, modalOpen]);

  const filtered = useMemo(() => {
    let items = allParticulares.filter((e) => e && e.data && isDateInPeriod(e.data, period));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.paciente || '').toLowerCase().includes(q) ||
          (e.exame || '').toLowerCase().includes(q) ||
          (e.procedimentoComplementar || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [allParticulares, search, period]);

  const medicosOptions = useMemo(() => {
    const list = getData('medicos') || [];
    const set = new Set(list.map((m) => m.nome.trim().toUpperCase()));

    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];

    exames.forEach((e) => {
      if (e.medico && e.medico.trim()) set.add(e.medico.trim().toUpperCase());
    });
    detalhes.forEach((d) => {
      if (d.medico && d.medico.trim()) set.add(d.medico.trim().toUpperCase());
      if (d.medico2 && d.medico2.trim()) set.add(d.medico2.trim().toUpperCase());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modalOpen]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    data.forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO() });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      data: item.data,
      paciente: item.paciente,
      exame: item.exame,
      medico: item.medico,
      procedimentoComplementar: item.procedimentoComplementar || '',
    });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.data || !form.paciente || !form.exame || !form.medico) return;
    const isNew = !editId;
    const exameUpper = form.exame.trim().toUpperCase();
    const complUpper = examePermiteComplementar(exameUpper)
      ? formatProcedimentosComplementares(form.procedimentoComplementar)
      : '';
    const sanitizedForm = {
      ...form,
      paciente: form.paciente.trim().toUpperCase(),
      medico: form.medico.trim().toUpperCase(),
      exame: exameUpper,
      procedimentoComplementar: complUpper,
    };

    let savedItem = null;
    if (editId) {
      const existingInExames = getItem('exames', editId);
      if (existingInExames) {
        savedItem = updateItem('exames', editId, sanitizedForm);
      } else {
        const existingInDetalhes = getItem('detalhesExames', editId);
        if (existingInDetalhes) {
          updateItem('detalhesExames', editId, {
            data: sanitizedForm.data,
            paciente: sanitizedForm.paciente,
            medico: sanitizedForm.medico,
            tipoExame: sanitizedForm.exame,
            procedimentoComplementar: sanitizedForm.procedimentoComplementar,
          });
        }
        savedItem = addItem('exames', { ...sanitizedForm, id: editId });
      }

      // Also sync matching record in detalhesExames by ID or (data + paciente)
      const detalhesList = getData('detalhesExames') || [];
      const matchingDetalhes = detalhesList.filter(
        (d) =>
          d.id === editId ||
          (d.data === sanitizedForm.data &&
            d.paciente &&
            d.paciente.trim().toUpperCase() === sanitizedForm.paciente)
      );
      matchingDetalhes.forEach((det) => {
        updateItem('detalhesExames', det.id, {
          data: sanitizedForm.data,
          paciente: sanitizedForm.paciente,
          medico: sanitizedForm.medico,
          tipoExame: sanitizedForm.exame,
          procedimentoComplementar: sanitizedForm.procedimentoComplementar,
        });
      });
    } else {
      savedItem = addItem('exames', sanitizedForm);
    }

    refresh();
    setModalOpen(false);

    if (isNew && onNavigateToDetalhes) {
      onNavigateToDetalhes({
        id: savedItem?.id,
        data: sanitizedForm.data,
        paciente: sanitizedForm.paciente,
        tipoExame: sanitizedForm.exame,
        medico: sanitizedForm.medico,
        procedimentoComplementar: sanitizedForm.procedimentoComplementar,
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      const existingInExames = getItem('exames', deleteId);
      if (existingInExames) {
        deleteItem('exames', deleteId);
      }
      const existingInDetalhes = getItem('detalhesExames', deleteId);
      if (existingInDetalhes) {
        deleteItem('detalhesExames', deleteId);
      }
      refresh();
    }
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Exames Realizados</h1>
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
          <button className="btn btn-primary" onClick={openNew}>
            + Novo Exame
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards summary-cards-single">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Exames no Período</span>
              <div className="summary-card-icon">🏥</div>
            </div>
            <div className="summary-card-value">{filtered.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Registros</h3>
            <div className="table-actions">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar paciente, exame..."
                  value={search}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                onExportCSV={() => exportCSV(filtered, columns, 'exames_realizados')}
                onExportPDF={() => exportPDF(filtered, columns, 'Exames Realizados')}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Exame</th>
                  <th>Médico</th>
                  <th style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="table-empty">
                        <div className="table-empty-icon">🏥</div>
                        <p>Nenhum exame registrado{search ? ' para esta busca' : ' neste período'}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.data)}</td>
                      <td style={{ fontWeight: 600 }}>{item.paciente ? item.paciente.toUpperCase() : ''}</td>
                      <td>
                        {item.exame ? item.exame.toUpperCase() : ''}
                        {normalizeProcedimentosComplementares(item.procedimentoComplementar).map((proc) => {
                          const tagLabel = proc === 'POLIPECTOMIA' ? 'P' : proc === 'MUCOSECTOMIA' ? 'M' : proc;
                          return (
                            <span
                              key={proc}
                              className="badge badge-info"
                              style={{ marginLeft: '0.4rem', fontSize: 'var(--text-xs)' }}
                              title={proc}
                            >
                              {tagLabel}
                            </span>
                          );
                        })}
                      </td>
                      <td>{item.medico ? item.medico.toUpperCase() : ''}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => {
                              if (onNavigateToDetalhes) {
                                onNavigateToDetalhes({
                                  data: item.data,
                                  paciente: item.paciente,
                                  tipoExame: item.exame,
                                  medico: item.medico,
                                  procedimentoComplementar: item.procedimentoComplementar || '',
                                });
                              }
                            }}
                            title="Preencher / Ver Dados Financeiros"
                          >
                            💳
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => openEdit(item)}
                            title="Editar Exame"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setDeleteId(item.id)}
                            title="Excluir Exame"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="table-footer">
              <span>{filtered.length} registro(s)</span>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Exame' : 'Novo Exame'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {editId ? 'Salvar' : 'Cadastrar'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">
                Data <span className="required">*</span>
              </label>
              <input
                type="date"
                className="input-field"
                required
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label className="input-label">
                Médico <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={medicosOptions}
                required
                placeholder="Selecione ou digite o médico"
                value={form.medico}
                onChange={(val) => setForm({ ...form, medico: val.toUpperCase() })}
              />
            </div>
            <div className="input-group full-width">
              <label className="input-label">
                Nome do Paciente <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome completo do paciente"
                value={form.paciente}
                onChange={(e) => setForm({ ...form, paciente: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="input-group full-width">
              <label className="input-label">
                Exame <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={examesOptions}
                required
                placeholder="Selecione ou digite o exame"
                value={form.exame}
                onChange={(val) => setForm({ ...form, exame: val.toUpperCase(), procedimentoComplementar: examePermiteComplementar(val) ? form.procedimentoComplementar : '' })}
              />
            </div>

            {examePermiteComplementar(form.exame) && (
              <div className="input-group full-width" style={{ marginTop: '-0.25rem' }}>
                <label className="input-label">Procedimentos Complementares</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {PROCEDIMENTOS_COMPLEMENTARES.map((proc) => {
                    const currentList = normalizeProcedimentosComplementares(form.procedimentoComplementar);
                    const isChecked = currentList.includes(proc);
                    return (
                      <label
                        key={proc}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let updatedList;
                            if (e.target.checked) {
                              updatedList = [...currentList, proc];
                            } else {
                              updatedList = currentList.filter((p) => p !== proc);
                            }
                            setForm({
                              ...form,
                              procedimentoComplementar: formatProcedimentosComplementares(updatedList),
                            });
                          }}
                        />
                        <span>{proc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este exame?"
      />
    </>
  );
}

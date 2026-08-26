import { useState, useMemo } from 'react';
import { getData, addItem, updateItem, deleteItem } from '../utils/storage';
import {
  formatDate,
  getTodayISO,
  exportCSV,
  exportPDF,
  DEFAULT_EXAMES,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import AutoCompleteInput from '../components/AutoCompleteInput';

const emptyForm = { data: '', paciente: '', exame: '', medico: '' };

const columns = [
  { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
  { key: 'paciente', label: 'Paciente' },
  { key: 'exame', label: 'Exame' },
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
        medico: d.medico || '',
        isDetailOnly: true,
      }));

    return [...examesList, ...standalone];
  }, [data, modalOpen]);

  const filtered = useMemo(() => {
    let items = allParticulares.filter((e) => e && e.data && isDateInPeriod(e.data, period));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.paciente || '').toLowerCase().includes(q) ||
          (e.exame || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [allParticulares, search, period]);

  const medicosOptions = useMemo(() => {
    const list = getData('medicos') || [];
    const set = new Set(list.map((m) => m.nome.trim()));

    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];

    exames.forEach((e) => {
      if (e.medico && e.medico.trim()) set.add(e.medico.trim());
    });
    detalhes.forEach((d) => {
      if (d.medico && d.medico.trim()) set.add(d.medico.trim());
      if (d.medico2 && d.medico2.trim()) set.add(d.medico2.trim());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modalOpen]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    data.forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim());
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
    setForm({ data: item.data, paciente: item.paciente, exame: item.exame, medico: item.medico });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.data || !form.paciente || !form.exame || !form.medico) return;
    const isNew = !editId;
    const savedItem = editId
      ? updateItem('exames', editId, form)
      : addItem('exames', form);

    refresh();
    setModalOpen(false);

    if (isNew && onNavigateToDetalhes) {
      onNavigateToDetalhes({
        id: savedItem?.id,
        data: form.data,
        paciente: form.paciente,
        tipoExame: form.exame,
        medico: form.medico,
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem('exames', deleteId);
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
                      <td>{item.paciente}</td>
                      <td>{item.exame}</td>
                      <td>{item.medico}</td>
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
        <form onSubmit={handleSave}>
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
                onChange={(val) => setForm({ ...form, medico: val })}
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
                placeholder="Nome completo do paciente"
                value={form.paciente}
                onChange={(e) => setForm({ ...form, paciente: e.target.value })}
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
                onChange={(val) => setForm({ ...form, exame: val })}
              />
            </div>
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

import { useState, useMemo } from 'react';
import { getData, addItem, updateItem, deleteItem } from '../utils/storage';
import {
  formatDate,
  getTodayISO,
  formatCurrency,
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

const DEFAULT_CONVENIOS = [
  'ABERTTA SAUDE',
  'AERONAUTICA - FUNSA',
  'AMIL',
  'ASSEFAZ',
  'BANCO CENTRAL',
  'BRADESCO',
  'CAFAZ',
  'CAMED',
  'CAPESAUDE',
  'CASSI',
  'CONAB',
  'FACHESF',
  'FAMED',
  'FUSEX',
  'FUSMA',
  'GEAP',
  'IPM',
  'ISSEC',
  'LIV SAUDE',
  'MEDISERVICE',
  'PLAN-ASSISTE',
  'SAO CAMILO',
  'SAUDE CAIXA',
  'SAUDE PETROBRAS',
  'SULAMERICA',
  'UNIMED',
];

const emptyForm = {
  data: '',
  paciente: '',
  medico: '',
  convenio: '',
  exame: '',
  procedimentoComplementar: '',
};

const columns = [
  { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
  { key: 'paciente', label: 'Paciente' },
  { key: 'medico', label: 'Médico Realizante' },
  { key: 'convenio', label: 'Convênio' },
  {
    key: 'exame', label: 'Exame', accessor: (item) => {
      const base = item.exame ? item.exame.toUpperCase() : '';
      const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
      return compl ? `${base} + ${compl}` : base;
    }
  },
];

export default function ConveniosPage({ onNavigateToFluxo }) {
  const [data, setData] = useState(() => getData('examesConvenio'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [convenioFilter, setConvenioFilter] = useState('');

  // Fluxo de Caixa Quick Modal
  const [fluxoModalOpen, setFluxoModalOpen] = useState(false);
  const [fluxoForm, setFluxoForm] = useState({
    data: getTodayISO(),
    nome: '',
    categoria: 'Convênios / Repasses',
    tipo: 'entrada',
    valor: '',
  });

  const refresh = () => setData(getData('examesConvenio'));

  const medicosOptions = useMemo(() => {
    const list = getData('medicos') || [];
    const set = new Set(list.map((m) => m.nome.trim().toUpperCase()));

    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];
    const convs = getData('examesConvenio') || [];

    exames.forEach((e) => {
      if (e.medico && e.medico.trim()) set.add(e.medico.trim().toUpperCase());
    });
    detalhes.forEach((d) => {
      if (d.medico && d.medico.trim()) set.add(d.medico.trim().toUpperCase());
      if (d.medico2 && d.medico2.trim()) set.add(d.medico2.trim().toUpperCase());
    });
    convs.forEach((c) => {
      if (c.medico && c.medico.trim()) set.add(c.medico.trim().toUpperCase());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modalOpen]);

  const conveniosOptions = useMemo(() => {
    const set = new Set(DEFAULT_CONVENIOS);
    data.forEach((item) => {
      if (item.convenio && item.convenio.trim()) set.add(item.convenio.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    data.forEach((item) => {
      if (item.exame && item.exame.trim()) set.add(item.exame.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    let items = data.filter((e) => isDateInPeriod(e.data, period));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.paciente || '').toLowerCase().includes(q) ||
          (e.exame || '').toLowerCase().includes(q) ||
          (e.procedimentoComplementar || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q) ||
          (e.convenio || '').toLowerCase().includes(q)
      );
    }
    if (convenioFilter) {
      items = items.filter((e) => e.convenio === convenioFilter);
    }
    return items.sort((a, b) => {
      if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
      return (b.data || '').localeCompare(a.data || '');
    });
  }, [data, search, period, convenioFilter]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO() });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      data: item.data || '',
      paciente: item.paciente || '',
      medico: item.medico || '',
      convenio: item.convenio || '',
      exame: item.exame || '',
      procedimentoComplementar: item.procedimentoComplementar || '',
    });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.data || !form.paciente || !form.medico || !form.convenio || !form.exame) return;
    const allowsCompl = examePermiteComplementar(form.exame);
    const sanitizedForm = {
      ...form,
      medico: form.medico.trim().toUpperCase(),
      paciente: form.paciente.trim().toUpperCase(),
      convenio: form.convenio.trim().toUpperCase(),
      exame: form.exame.trim().toUpperCase(),
      procedimentoComplementar: allowsCompl ? formatProcedimentosComplementares(form.procedimentoComplementar) : '',
    };
    if (editId) {
      updateItem('examesConvenio', editId, sanitizedForm);
    } else {
      addItem('examesConvenio', sanitizedForm);
    }
    refresh();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem('examesConvenio', deleteId);
      refresh();
    }
  };

  const openFluxoModal = (item) => {
    const pNome = item.paciente ? item.paciente.trim().toUpperCase() : '';
    const cNome = item.convenio ? item.convenio.trim().toUpperCase() : '';
    const eNome = item.exame ? item.exame.trim().toUpperCase() : '';
    const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
    const complStr = compl ? ` + ${compl}` : '';
    setFluxoForm({
      data: getTodayISO(),
      nome: `REPASSE CONVÊNIO ${cNome} — ${pNome} (${eNome}${complStr})`,
      categoria: 'Convênios / Repasses',
      tipo: 'entrada',
      valor: '',
    });
    setFluxoModalOpen(true);
  };

  const handleSaveFluxo = (e) => {
    e.preventDefault();
    if (!fluxoForm.data || !fluxoForm.nome || !fluxoForm.valor) return;
    addItem('fluxoCaixa', {
      ...fluxoForm,
      nome: fluxoForm.nome.trim().toUpperCase(),
    });
    setFluxoModalOpen(false);
    if (onNavigateToFluxo) onNavigateToFluxo();
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Exames de Convênio</h1>
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
            + Novo Exame de Convênio
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards summary-cards-single">
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Exames no Período</span>
              <div className="summary-card-icon blue">🏢</div>
            </div>
            <div className="summary-card-value">{filtered.length}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Registros de Convênio</h3>
            <div className="table-actions">
              <select
                className="input-field"
                value={convenioFilter}
                onChange={(e) => setConvenioFilter(e.target.value)}
                style={{ width: '160px', fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
              >
                <option value="">Todos Convênios</option>
                {conveniosOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar paciente, médico, convênio..."
                  value={search}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ExportMenu
                onExportCSV={() => exportCSV(filtered, columns, 'exames_convenio')}
                onExportPDF={() => exportPDF(filtered, columns, 'Exames de Convênio')}
              />
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Médico Realizante</th>
                  <th>Convênio</th>
                  <th>Exame</th>
                  <th style={{ width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="table-empty">
                        <div className="table-empty-icon">🏢</div>
                        <p>Nenhum exame de convênio registrado{search || convenioFilter ? ' para este filtro' : ' neste período'}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.data)}</td>
                      <td style={{ fontWeight: 600 }}>{item.paciente ? item.paciente.toUpperCase() : ''}</td>
                      <td>{item.medico ? item.medico.toUpperCase() : ''}</td>
                      <td>
                        <span className="badge badge-info">{item.convenio ? item.convenio.toUpperCase() : ''}</span>
                      </td>
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
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => openFluxoModal(item)}
                            title="Lançar Entrada Manual no Fluxo de Caixa ao receber do convênio"
                          >
                            💵
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
              <span>{filtered.length} registro(s) de convênio</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Cadastro/Edição de Exame de Convênio */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Exame de Convênio' : 'Novo Exame de Convênio'}
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
                Médico Realizante <span className="required">*</span>
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

            <div className="input-group">
              <label className="input-label">
                Convênio <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={conveniosOptions}
                required
                placeholder="Nome do convênio (ex: Unimed)"
                value={form.convenio}
                onChange={(val) => setForm({ ...form, convenio: val.toUpperCase() })}
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                Exame Realizado <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={examesOptions}
                required
                placeholder="Selecione ou digite o procedimento"
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

      {/* Modal de Lançamento no Fluxo de Caixa */}
      <Modal
        isOpen={fluxoModalOpen}
        onClose={() => setFluxoModalOpen(false)}
        title="Lançar Entrada no Fluxo de Caixa"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setFluxoModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveFluxo}>
              Confirmar Entrada
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveFluxo} autoComplete="off">
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            💡 Utilize este atalho para registrar o valor líquido recebido do convênio no Fluxo de Caixa da clínica.
          </div>
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">
                Data do Recebimento <span className="required">*</span>
              </label>
              <input
                type="date"
                className="input-field"
                required
                value={fluxoForm.data}
                onChange={(e) => setFluxoForm({ ...fluxoForm, data: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label className="input-label">
                Valor Recebido (R$) <span className="required">*</span>
              </label>
              <input
                type="number"
                className="input-field"
                required
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={fluxoForm.valor}
                onChange={(e) => setFluxoForm({ ...fluxoForm, valor: e.target.value })}
              />
            </div>
            <div className="input-group full-width">
              <label className="input-label">
                Descrição no Fluxo de Caixa <span className="required">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={fluxoForm.nome}
                onChange={(e) => setFluxoForm({ ...fluxoForm, nome: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Categoria</label>
              <input
                type="text"
                className="input-field"
                readOnly
                value={fluxoForm.categoria}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Tipo</label>
              <input
                type="text"
                className="input-field"
                readOnly
                value="Entrada"
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este registro de exame de convênio?"
      />
    </>
  );
}

import { useState, useMemo, useEffect } from 'react';
import {
  getData,
  addItem,
  updateItem,
  deleteItem,
  getActiveMedicosOptions,
  syncConvenioToDetalhes,
  syncAllConveniosToDetalhes,
  removeConvenioFromDetalhes,
} from '../utils/storage';
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
import Pagination from '../components/Pagination';
import ConvenioFluxoModal from '../components/ConvenioFluxoModal';
import { useToast } from '../contexts/ToastContext';
import { validateDate, validateRequired } from '../utils/validation';

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
  const toast = useToast();
  const [data, setData] = useState(() => getData('examesConvenio'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [convenioFilter, setConvenioFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const dateErr = validateDate(form.data, 'Data');
    if (dateErr) errs.data = dateErr;

    const medErr = validateRequired(form.medico, 'Médico realizante');
    if (medErr) errs.medico = medErr;

    const pacErr = validateRequired(form.paciente, 'Nome do paciente');
    if (pacErr) errs.paciente = pacErr;

    const convErr = validateRequired(form.convenio, 'Convênio');
    if (convErr) errs.convenio = convErr;

    const exameErr = validateRequired(form.exame, 'Exame');
    if (exameErr) errs.exame = exameErr;

    return errs;
  }, [form]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  useEffect(() => {
    setCurrentPage(1);
  }, [period, search, convenioFilter]);

  // Fluxo de Caixa Modal de Partilha
  const [fluxoModalItem, setFluxoModalItem] = useState(null);

  const refresh = () => setData(getData('examesConvenio'));

  useEffect(() => {
    syncAllConveniosToDetalhes();
  }, []);

  const medicosOptions = useMemo(() => getActiveMedicosOptions(), [modalOpen]);

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
      const dateCompare = (b.data || '').localeCompare(a.data || '');
      if (dateCompare !== 0) return dateCompare;
      if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
      return (a.paciente || '').localeCompare(b.paciente || '');
    });
  }, [data, search, period, convenioFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO() });
    setTouched({});
    setSubmitted(false);
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
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, preencha os campos destacados em vermelho.');
      return;
    }
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
      const updated = updateItem('examesConvenio', editId, sanitizedForm);
      if (updated) syncConvenioToDetalhes(updated);
    } else {
      addItem('examesConvenio', sanitizedForm);
    }
    refresh();
    setModalOpen(false);
    toast.success(editId ? 'Exame de convênio atualizado com sucesso!' : 'Exame de convênio cadastrado com sucesso!');
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem('examesConvenio', deleteId);
      removeConvenioFromDetalhes(deleteId);
      refresh();
      toast.success('Exame de convênio excluído.');
    }
  };

  const openFluxoModal = (item) => {
    setFluxoModalItem(item);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Exames de Convênio</h1>
        <div className="header-actions">
          <div className="period-selector-wrapper">
            <div className="period-selector">
              <button
                type="button"
                className="period-btn"
                onClick={() => setPeriod(navigateAcquisitionPeriod(period, -1))}
                title="Período anterior"
              >
                ◀
              </button>
              <span className="period-label">{period.label}</span>
              <button
                type="button"
                className="period-btn"
                onClick={() => setPeriod(navigateAcquisitionPeriod(period, 1))}
                title="Próximo período"
              >
                ▶
              </button>
            </div>
            {!isCurrentPeriod && (
              <button
                type="button"
                className="btn btn-secondary btn-sm period-today-btn"
                onClick={() => setPeriod(getAcquisitionPeriod())}
                title="Ir para o período atual"
              >
                Hoje
              </button>
            )}
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
                  paginatedItems.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.data)}</td>
                      <td style={{ fontWeight: 600 }}>{item.paciente ? item.paciente.toUpperCase() : ''}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.medico ? item.medico.toUpperCase() : ''}</div>
                        {item.temDivisaoMedico2 && item.medico2 && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            👥 c/ {item.medico2.toUpperCase()} ({item.porcentagemMedico1 ?? 87.5}% / {item.porcentagemMedico2 ?? 12.5}%)
                          </div>
                        )}
                      </td>
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
                        {item.fluxoLancado && (
                          <span
                            className="badge-fluxo-done"
                            style={{ marginLeft: '0.5rem' }}
                            title={`Lançado no Fluxo de Caixa: ${formatCurrency(item.fluxoValorLancado || 0)}`}
                          >
                            ✓ Caixa {formatCurrency(item.fluxoValorLancado || 0)}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className={`btn btn-ghost btn-icon btn-sm ${item.fluxoLancado ? 'btn-active-success' : ''}`}
                            onClick={() => openFluxoModal(item)}
                            title={item.fluxoLancado ? "Ver / Ajustar Partilha e Lançamento no Fluxo de Caixa (Já Lançado)" : "Calcular Partilha e Lançar Entrada no Fluxo de Caixa"}
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
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            label="exame(s) de convênio"
          />
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
        <form onSubmit={handleSave} noValidate autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">
                Data <span className="required">*</span>
              </label>
              <input
                type="date"
                className={`input-field ${hasError('data') ? 'is-invalid' : ''}`}
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                onBlur={() => markTouched('data')}
              />
              {hasError('data') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.data}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">
                Médico Realizante <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={medicosOptions}
                className={`input-field ${hasError('medico') ? 'is-invalid' : ''}`}
                placeholder="Selecione ou digite o médico"
                value={form.medico}
                onChange={(val) => setForm({ ...form, medico: val.toUpperCase() })}
                onBlur={() => markTouched('medico')}
              />
              {hasError('medico') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.medico}
                </div>
              )}
            </div>

            <div className="input-group full-width">
              <label className="input-label">
                Nome do Paciente <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`input-field ${hasError('paciente') ? 'is-invalid' : ''}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome completo do paciente"
                value={form.paciente}
                onChange={(e) => setForm({ ...form, paciente: e.target.value.toUpperCase() })}
                onBlur={() => markTouched('paciente')}
              />
              {hasError('paciente') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.paciente}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">
                Convênio <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={conveniosOptions}
                className={`input-field ${hasError('convenio') ? 'is-invalid' : ''}`}
                placeholder="Nome do convênio (ex: Unimed)"
                value={form.convenio}
                onChange={(val) => setForm({ ...form, convenio: val.toUpperCase() })}
                onBlur={() => markTouched('convenio')}
              />
              {hasError('convenio') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.convenio}
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">
                Exame Realizado <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={examesOptions}
                className={`input-field ${hasError('exame') ? 'is-invalid' : ''}`}
                placeholder="Selecione ou digite o procedimento"
                value={form.exame}
                onChange={(val) => setForm({ ...form, exame: val.toUpperCase(), procedimentoComplementar: examePermiteComplementar(val) ? form.procedimentoComplementar : '' })}
                onBlur={() => markTouched('exame')}
              />
              {hasError('exame') && (
                <div className="input-feedback-error">
                  <span>⚠</span> {validationErrors.exame}
                </div>
              )}
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

      <ConvenioFluxoModal
        isOpen={Boolean(fluxoModalItem)}
        item={fluxoModalItem}
        onClose={() => setFluxoModalItem(null)}
        onSuccess={refresh}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este registro de exame de convênio?"
      />
    </>
  );
}

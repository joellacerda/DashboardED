import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { getItem, MODULES, getConvenioFluxoDestino } from '../utils/storage';
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
  'UNIMED',
  'COOPEND',
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
];

const emptyForm = {
  modalidade: 'PARTICULAR', // 'PARTICULAR' | 'CONVENIO'
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
  {
    key: 'convenio',
    label: 'Tipo / Convênio',
    accessor: (item) => (item.isConvenio ? item.convenio || 'CONVÊNIO' : 'PARTICULAR'),
  },
  {
    key: 'exame',
    label: 'Exame',
    accessor: (item) => {
      const base = item.exame ? item.exame.toUpperCase() : '';
      const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
      return compl ? `${base} + ${compl}` : base;
    },
  },
  {
    key: 'valor',
    label: 'Valor Caixa',
    accessor: (item) =>
      item.caixaLancado && Number(item.valorCaixa) > 0
        ? formatCurrency(Number(item.valorCaixa))
        : 'Pendente',
  },
];

export default function ExamesPage({ onNavigateToDetalhes }) {
  const toast = useToast();
  const {
    exames: particularesData = [],
    examesConvenio: conveniosData = [],
    detalhesExames = [],
    addItem,
    updateItem,
    deleteItem,
    syncConvenioToDetalhes,
    syncAllConveniosToDetalhes,
    removeConvenioFromDetalhes,
    syncConveniosFluxoConsolidado,
    activeMedicosOptions,
  } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null); // holds full unified item when editing
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState(''); // '' = Todos, '__PARTICULAR__', '__CONVENIOS__', or specific convenio name
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [fluxoModalItem, setFluxoModalItem] = useState(null);

  useEffect(() => {
    syncAllConveniosToDetalhes();
  }, [syncAllConveniosToDetalhes]);

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

    if (form.modalidade === 'CONVENIO') {
      const convErr = validateRequired(form.convenio, 'Convênio');
      if (convErr) errs.convenio = convErr;
    }

    const exameErr = validateRequired(form.exame, 'Exame');
    if (exameErr) errs.exame = exameErr;

    return errs;
  }, [form]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  useEffect(() => {
    setCurrentPage(1);
  }, [period, search, tipoFilter]);

  const medicosOptions = activeMedicosOptions;

  const conveniosOptions = useMemo(() => {
    const set = new Set(DEFAULT_CONVENIOS);
    (conveniosData || []).forEach((item) => {
      if (item.convenio && item.convenio.trim()) set.add(item.convenio.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conveniosData]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    (particularesData || []).forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim().toUpperCase());
    });
    (conveniosData || []).forEach((item) => {
      if (item.exame && item.exame.trim()) set.add(item.exame.trim().toUpperCase());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [particularesData, conveniosData]);

  // Combine exames particulares + standalone details + exames de convênio into a single unified list
  const allUnifiedExams = useMemo(() => {
    const examesList = particularesData || [];
    const detalhesList = detalhesExames || [];
    const convList = conveniosData || [];

    const getMatchedDetalhe = (e) =>
      detalhesList.find(
        (d) =>
          !d.isConvenio &&
          !d.origemConvenioId &&
          (d.id === e.id ||
            (d.data === e.data &&
              d.paciente &&
              e.paciente &&
              d.paciente.trim().toLowerCase() === e.paciente.trim().toLowerCase()))
      );

    const computeParticularValor = (det) => {
      if (!det) return 0;
      const explicitVal = Number(det.valorPagamento ?? det.valorTotal);
      if (explicitVal > 0) return explicitVal;
      if (Array.isArray(det.pagamentos)) {
        return det.pagamentos.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);
      }
      return 0;
    };

    const mergedExames = examesList.map((e) => {
      const match = getMatchedDetalhe(e);
      const valPag = computeParticularValor(match);
      return {
        ...e,
        _origin: 'PARTICULAR',
        _rowKey: `part_${e.id}`,
        isConvenio: false,
        convenio: 'PARTICULAR',
        exame: e.exame || match?.tipoExame || '',
        procedimentoComplementar:
          e.procedimentoComplementar || match?.procedimentoComplementar || '',
        medico2: e.medico2 || match?.medico2 || '',
        temDivisaoMedico2: Boolean(
          e.temDivisao || match?.temDivisao || e.medico2 || match?.medico2
        ),
        porcentagemMedico1: e.porcentagemMedico1 ?? match?.porcentagemMedico1,
        porcentagemMedico2: e.porcentagemMedico2 ?? match?.porcentagemMedico2,
        valorCaixa: valPag,
        caixaLancado: valPag > 0,
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
      .filter((d) => !d.isConvenio && !d.origemConvenioId && !isMatched(d))
      .map((d) => {
        const valPag = computeParticularValor(d);
        return {
          id: d.id,
          _origin: 'PARTICULAR',
          _rowKey: `part_${d.id}`,
          isConvenio: false,
          convenio: 'PARTICULAR',
          data: d.data,
          paciente: d.paciente || '',
          exame: d.tipoExame || '',
          procedimentoComplementar: d.procedimentoComplementar || '',
          medico: d.medico || '',
          medico2: d.medico2 || '',
          temDivisaoMedico2: Boolean(d.temDivisao || d.medico2),
          porcentagemMedico1: d.porcentagemMedico1,
          porcentagemMedico2: d.porcentagemMedico2,
          isDetailOnly: true,
          valorCaixa: valPag,
          caixaLancado: valPag > 0,
        };
      });

    const seenPart = new Set();
    const uniqueParticulares = [];
    for (const item of [...mergedExames, ...standalone]) {
      if (item && item.id) {
        if (seenPart.has(String(item.id))) continue;
        seenPart.add(String(item.id));
      }
      uniqueParticulares.push(item);
    }

    const seenConv = new Set();
    const uniqueConvenios = [];
    for (const item of convList) {
      if (!item) continue;
      if (item.id) {
        if (seenConv.has(String(item.id))) continue;
        seenConv.add(String(item.id));
      }
      const isLancado = Boolean(
        item.fluxoLancado ||
          (item.fluxoValorLancado !== undefined && Number(item.fluxoValorLancado) > 0) ||
          (item.valorClinica !== undefined &&
            item.valorClinica !== '' &&
            Number(item.valorClinica) > 0)
      );
      const val =
        Number(item.fluxoValorLancado) > 0
          ? Number(item.fluxoValorLancado)
          : Number(item.valorClinica) || 0;

      uniqueConvenios.push({
        ...item,
        _origin: 'CONVENIO',
        _rowKey: `conv_${item.id}`,
        isConvenio: true,
        convenio: (item.convenio || '').trim().toUpperCase() || 'CONVÊNIO',
        valorCaixa: isLancado && val > 0 ? val : 0,
        caixaLancado: isLancado && val > 0,
      });
    }

    return [...uniqueParticulares, ...uniqueConvenios];
  }, [particularesData, detalhesExames, conveniosData]);

  const filtered = useMemo(() => {
    let items = allUnifiedExams.filter((e) => e && e.data && isDateInPeriod(e.data, period));

    if (tipoFilter === '__PARTICULAR__') {
      items = items.filter((e) => !e.isConvenio);
    } else if (tipoFilter === '__CONVENIOS__') {
      items = items.filter((e) => e.isConvenio);
    } else if (tipoFilter) {
      items = items.filter((e) => e.isConvenio && e.convenio === tipoFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.paciente || '').toLowerCase().includes(q) ||
          (e.exame || '').toLowerCase().includes(q) ||
          (e.procedimentoComplementar || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q) ||
          (e.medico2 || '').toLowerCase().includes(q) ||
          (e.convenio || '').toLowerCase().includes(q)
      );
    }

    return items.sort((a, b) => {
      const dateCompare = (b.data || '').localeCompare(a.data || '');
      if (dateCompare !== 0) return dateCompare;
      if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
      return (a.paciente || '').localeCompare(b.paciente || '');
    });
  }, [allUnifiedExams, search, period, tipoFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

  const stats = useMemo(() => {
    let particularesCount = 0;
    let particularesTotal = 0;
    let conveniosCount = 0;
    let unimedTotal = 0;
    let unimedCount = 0;
    let coopendTotal = 0;
    let coopendCount = 0;
    let geralConveniosTotal = 0;
    let totalConveniosLancados = 0;

    filtered.forEach((item) => {
      if (!item.isConvenio) {
        particularesCount++;
        if (item.caixaLancado && item.valorCaixa > 0) {
          particularesTotal += item.valorCaixa;
        }
        return;
      }

      conveniosCount++;
      const destino = getConvenioFluxoDestino(item.convenio);
      if (item.caixaLancado && item.valorCaixa > 0) {
        totalConveniosLancados++;
        geralConveniosTotal += item.valorCaixa;
        if (destino.isUnimed) {
          unimedTotal += item.valorCaixa;
          unimedCount++;
        } else {
          coopendTotal += item.valorCaixa;
          coopendCount++;
        }
      }
    });

    return {
      totalExames: filtered.length,
      particularesCount,
      particularesTotal,
      conveniosCount,
      totalConveniosLancados,
      unimedTotal,
      unimedCount,
      coopendTotal,
      coopendCount,
      geralConveniosTotal,
    };
  }, [filtered]);

  const openNew = () => {
    setEditItem(null);
    const defaultModalidade =
      tipoFilter === '__CONVENIOS__' || (tipoFilter && tipoFilter !== '__PARTICULAR__')
        ? 'CONVENIO'
        : 'PARTICULAR';
    const defaultConvenio =
      tipoFilter && tipoFilter !== '__PARTICULAR__' && tipoFilter !== '__CONVENIOS__'
        ? tipoFilter
        : '';

    setForm({
      ...emptyForm,
      modalidade: defaultModalidade,
      convenio: defaultConvenio,
      data: getTodayISO(),
    });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      modalidade: item.isConvenio ? 'CONVENIO' : 'PARTICULAR',
      data: item.data || '',
      paciente: item.paciente || '',
      medico: item.medico || '',
      convenio: item.isConvenio ? item.convenio || '' : '',
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

    const isNew = !editItem;
    const isTargetConvenio = form.modalidade === 'CONVENIO';
    const exameUpper = form.exame.trim().toUpperCase();
    const complUpper = examePermiteComplementar(exameUpper)
      ? formatProcedimentosComplementares(form.procedimentoComplementar)
      : '';
    const pacienteUpper = form.paciente.trim().toUpperCase();
    const medicoUpper = form.medico.trim().toUpperCase();
    const convenioUpper = isTargetConvenio ? form.convenio.trim().toUpperCase() : '';

    // Case 1: Saving as CONVÊNIO
    if (isTargetConvenio) {
      if (editItem && editItem.isConvenio) {
        // Update existing convênio
        const existing = (conveniosData || []).find((d) => d.id === editItem.id) || {};
        const sanitizedForm = {
          ...existing,
          data: form.data,
          medico: medicoUpper,
          paciente: pacienteUpper,
          convenio: convenioUpper,
          exame: exameUpper,
          procedimentoComplementar: complUpper,
        };
        const updated = updateItem(MODULES.examesConvenio, editItem.id, sanitizedForm);
        if (updated) syncConvenioToDetalhes(updated);
      } else {
        // Creating new convênio (or converting from Particular to Convênio)
        if (editItem && !editItem.isConvenio) {
          const existingInExames = getItem(MODULES.exames, editItem.id);
          if (existingInExames) deleteItem(MODULES.exames, editItem.id);
          const existingInDetalhes = getItem(MODULES.detalhesExames, editItem.id);
          if (existingInDetalhes) deleteItem(MODULES.detalhesExames, editItem.id);
        }
        const sanitizedForm = {
          data: form.data,
          medico: medicoUpper,
          paciente: pacienteUpper,
          convenio: convenioUpper,
          exame: exameUpper,
          procedimentoComplementar: complUpper,
          valorClinica: '',
          valorMedico: '',
          percentualMedico: 60,
          fluxoLancado: false,
        };
        const created = addItem(MODULES.examesConvenio, sanitizedForm);
        if (created) syncConvenioToDetalhes(created);
      }

      syncConveniosFluxoConsolidado();
      setModalOpen(false);
      toast.success(
        editItem
          ? 'Exame de convênio atualizado com sucesso!'
          : 'Exame de convênio cadastrado com sucesso!'
      );
      return;
    }

    // Case 2: Saving as PARTICULAR
    const sanitizedParticular = {
      data: form.data,
      paciente: pacienteUpper,
      medico: medicoUpper,
      exame: exameUpper,
      procedimentoComplementar: complUpper,
    };

    let savedItem = null;
    if (editItem && !editItem.isConvenio) {
      const editId = editItem.id;
      const existingInExames = getItem(MODULES.exames, editId);
      if (existingInExames) {
        savedItem = updateItem(MODULES.exames, editId, sanitizedParticular);
      } else {
        const existingInDetalhes = getItem(MODULES.detalhesExames, editId);
        if (existingInDetalhes) {
          updateItem(MODULES.detalhesExames, editId, {
            data: sanitizedParticular.data,
            paciente: sanitizedParticular.paciente,
            medico: sanitizedParticular.medico,
            tipoExame: sanitizedParticular.exame,
            procedimentoComplementar: sanitizedParticular.procedimentoComplementar,
          });
        }
        savedItem = addItem(MODULES.exames, { ...sanitizedParticular, id: editId });
      }

      const detalhesList = detalhesExames || [];
      const matchingDetalhes = detalhesList.filter(
        (d) =>
          !d.isConvenio &&
          (d.id === editId ||
            (d.data === sanitizedParticular.data &&
              d.paciente &&
              d.paciente.trim().toUpperCase() === sanitizedParticular.paciente))
      );
      matchingDetalhes.forEach((det) => {
        updateItem(MODULES.detalhesExames, det.id, {
          data: sanitizedParticular.data,
          paciente: sanitizedParticular.paciente,
          medico: sanitizedParticular.medico,
          tipoExame: sanitizedParticular.exame,
          procedimentoComplementar: sanitizedParticular.procedimentoComplementar,
        });
      });
    } else {
      // Creating new Particular (or converting from Convênio to Particular)
      if (editItem && editItem.isConvenio) {
        deleteItem(MODULES.examesConvenio, editItem.id);
        removeConvenioFromDetalhes(editItem.id);
        syncConveniosFluxoConsolidado();
      }
      savedItem = addItem(MODULES.exames, sanitizedParticular);
    }

    setModalOpen(false);
    toast.success(
      editItem
        ? 'Exame particular atualizado com sucesso!'
        : 'Exame particular cadastrado com sucesso!'
    );

    if (isNew && onNavigateToDetalhes) {
      onNavigateToDetalhes({
        id: savedItem?.id,
        data: sanitizedParticular.data,
        paciente: sanitizedParticular.paciente,
        tipoExame: sanitizedParticular.exame,
        medico: sanitizedParticular.medico,
        procedimentoComplementar: sanitizedParticular.procedimentoComplementar,
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.isConvenio) {
      deleteItem(MODULES.examesConvenio, deleteTarget.id);
      removeConvenioFromDetalhes(deleteTarget.id);
      syncConveniosFluxoConsolidado();
      toast.success('Exame de convênio excluído.');
    } else {
      const existingInExames = getItem(MODULES.exames, deleteTarget.id);
      if (existingInExames) {
        deleteItem(MODULES.exames, deleteTarget.id);
      }
      const existingInDetalhes = getItem(MODULES.detalhesExames, deleteTarget.id);
      if (existingInDetalhes) {
        deleteItem(MODULES.detalhesExames, deleteTarget.id);
      }
      toast.success('Exame particular excluído.');
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Exames Realizados</h1>
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
            + Novo Exame
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards">
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Exames no Período</span>
              <div className="summary-card-icon blue">🏥</div>
            </div>
            <div className="summary-card-value">{stats.totalExames}</div>
            <div
              className="summary-card-subtitle"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              {stats.particularesCount} particular{stats.particularesCount !== 1 ? 'es' : ''} ·{' '}
              {stats.conveniosCount} convênio{stats.conveniosCount !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Unimed no Caixa</span>
              <div className="summary-card-icon emerald">🏢</div>
            </div>
            <div className="summary-card-value">{formatCurrency(stats.unimedTotal)}</div>
            <div
              className="summary-card-subtitle"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              Consolidado ({stats.unimedCount} exame{stats.unimedCount !== 1 ? 's' : ''})
            </div>
          </div>

          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Coopend no Caixa</span>
              <div className="summary-card-icon purple">🤝</div>
            </div>
            <div className="summary-card-value">{formatCurrency(stats.coopendTotal)}</div>
            <div
              className="summary-card-subtitle"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
              title="Consolidação no Caixa de todos os convênios que repassam via Coopend (IPM, Bradesco, Cassi, etc.)"
            >
              Todos não-Unimed ({stats.coopendCount} exame{stats.coopendCount !== 1 ? 's' : ''})
            </div>
          </div>

          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Convênios</span>
              <div className="summary-card-icon amber">💰</div>
            </div>
            <div className="summary-card-value">{formatCurrency(stats.geralConveniosTotal)}</div>
            <div
              className="summary-card-subtitle"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
            >
              {stats.totalConveniosLancados} convênio
              {stats.totalConveniosLancados !== 1 ? 's' : ''} c/ valor recebido
            </div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 id="exames-table-title" className="table-title">
              Registros de Exames
            </h3>
            <div className="table-actions">
              <select
                className="input-field"
                aria-label="Filtrar por modalidade ou convênio"
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '185px', fontSize: 'var(--text-sm)', padding: '0.4rem 0.6rem' }}
              >
                <option value="">Todos os Exames</option>
                <option value="__PARTICULAR__">Apenas Particulares</option>
                <option value="__CONVENIOS__">Todos os Convênios</option>
                <optgroup label="Convênio Específico">
                  {conveniosOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar paciente, médico, exame..."
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

          <div
            className="table-scroll"
            style={{ overflowX: 'hidden' }}
            tabIndex={0}
            role="region"
            aria-labelledby="exames-table-title"
          >
            <table className="data-table exames-compact-table">
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Data</th>
                  <th style={{ width: '26%' }}>Paciente</th>
                  <th style={{ width: '15%' }}>Médico Realizante</th>
                  <th style={{ width: '13%' }}>Tipo / Convênio</th>
                  <th style={{ width: '16%' }}>Exame</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Valor Caixa</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="table-empty">
                        <div className="table-empty-icon">🏥</div>
                        <p>
                          Nenhum exame registrado
                          {search || tipoFilter ? ' para este filtro' : ' neste período'}.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const pacienteUpper = item.paciente ? item.paciente.toUpperCase() : '';
                    const medicoUpper = item.medico ? item.medico.toUpperCase() : '';
                    const exameUpper = item.exame ? item.exame.toUpperCase() : '';
                    const convenioUpper = item.convenio ? item.convenio.toUpperCase() : 'CONVÊNIO';
                    return (
                      <tr key={item._rowKey}>
                        <td>{formatDate(item.data)}</td>
                        <td title={pacienteUpper}>
                          <span className="table-cell-truncate table-patient-name">
                            {pacienteUpper}
                          </span>
                        </td>
                        <td
                          title={
                            item.temDivisaoMedico2 && item.medico2
                              ? `${medicoUpper} c/ ${item.medico2.toUpperCase()}`
                              : medicoUpper
                          }
                        >
                          <div className="table-cell-truncate" style={{ fontWeight: 500 }}>
                            {medicoUpper}
                          </div>
                          {item.temDivisaoMedico2 && item.medico2 && (
                            <div
                              className="table-cell-truncate"
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-secondary)',
                                marginTop: '0.15rem',
                              }}
                            >
                              👥 c/ {item.medico2.toUpperCase()} ({item.porcentagemMedico1 ?? 87.5}%
                              {' / '}
                              {item.porcentagemMedico2 ?? 12.5}%)
                            </div>
                          )}
                        </td>
                        <td title={item.isConvenio ? convenioUpper : 'PARTICULAR'}>
                          {item.isConvenio ? (
                            <span
                              className="badge badge-info"
                              style={{
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'inline-block',
                                verticalAlign: 'middle',
                              }}
                            >
                              {convenioUpper}
                            </span>
                          ) : (
                            <span className="badge badge-success">PARTICULAR</span>
                          )}
                        </td>
                        <td title={exameUpper}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                            <span className="table-cell-truncate">{exameUpper}</span>
                            {normalizeProcedimentosComplementares(
                              item.procedimentoComplementar
                            ).map((proc) => {
                              const tagLabel =
                                proc === 'POLIPECTOMIA'
                                  ? 'P'
                                  : proc === 'MUCOSECTOMIA'
                                    ? 'M'
                                    : proc;
                              return (
                                <span
                                  key={proc}
                                  className="badge badge-info"
                                  style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}
                                  title={proc}
                                >
                                  {tagLabel}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {item.caixaLancado && Number(item.valorCaixa) > 0 ? (
                            <span
                              className="badge-fluxo-done"
                              title={
                                item.isConvenio
                                  ? `Consolidado em "${getConvenioFluxoDestino(item.convenio).display}" no Fluxo de Caixa`
                                  : 'Valor preenchido em Detalhes de Exames'
                              }
                            >
                              {formatCurrency(Number(item.valorCaixa))}
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              Pendente
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-buttons" style={{ justifyContent: 'center' }}>
                            {item.isConvenio ? (
                              <button
                                className={`btn btn-ghost btn-icon btn-sm ${item.caixaLancado ? 'btn-active-success' : ''}`}
                                onClick={() => setFluxoModalItem(item)}
                                title={
                                  item.caixaLancado
                                    ? 'Ver / Ajustar Partilha e Lançamento Consolidado no Caixa'
                                    : 'Calcular Partilha e Lançar Entrada Consolidada no Caixa'
                                }
                              >
                                💵
                              </button>
                            ) : (
                              <button
                                className={`btn btn-ghost btn-icon btn-sm ${item.caixaLancado ? 'btn-active-success' : ''}`}
                                onClick={() => {
                                  if (onNavigateToDetalhes) {
                                    onNavigateToDetalhes({
                                      id: item.id,
                                      data: item.data,
                                      paciente: item.paciente,
                                      tipoExame: item.exame,
                                      medico: item.medico,
                                      procedimentoComplementar: item.procedimentoComplementar || '',
                                    });
                                  }
                                }}
                                title="Preencher / Ver Dados Financeiros em Detalhes"
                              >
                                💳
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => openEdit(item)}
                              title="Editar Exame"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => setDeleteTarget(item)}
                              title="Excluir Exame"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
            label="exame(s)"
          />
        </div>
      </div>

      {/* Modal Único de Cadastro / Edição de Exame (Particular ou Convênio) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Exame' : 'Novo Exame'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {editItem ? 'Salvar' : 'Cadastrar'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} noValidate autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group full-width">
              <label className="input-label">Modalidade do Atendimento</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${form.modalidade === 'PARTICULAR' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setForm({ ...form, modalidade: 'PARTICULAR' })}
                >
                  🏥 Particular
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${form.modalidade === 'CONVENIO' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setForm({ ...form, modalidade: 'CONVENIO' })}
                >
                  🏢 Convênio
                </button>
              </div>
            </div>

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

            {form.modalidade === 'CONVENIO' && (
              <div className="input-group full-width">
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
            )}

            <div className="input-group full-width">
              <label className="input-label">
                Exame Realizado <span className="required">*</span>
              </label>
              <AutoCompleteInput
                options={examesOptions}
                className={`input-field ${hasError('exame') ? 'is-invalid' : ''}`}
                placeholder="Selecione ou digite o exame"
                value={form.exame}
                onChange={(val) =>
                  setForm({
                    ...form,
                    exame: val.toUpperCase(),
                    procedimentoComplementar: examePermiteComplementar(val)
                      ? form.procedimentoComplementar
                      : '',
                  })
                }
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
                <div
                  style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}
                >
                  {PROCEDIMENTOS_COMPLEMENTARES.map((proc) => {
                    const currentList = normalizeProcedimentosComplementares(
                      form.procedimentoComplementar
                    );
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
                              procedimentoComplementar:
                                formatProcedimentosComplementares(updatedList),
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
        onSuccess={() => {}}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message={
          deleteTarget?.isConvenio
            ? 'Tem certeza que deseja excluir este registro de exame de convênio?'
            : 'Tem certeza que deseja excluir este exame particular?'
        }
      />
    </>
  );
}

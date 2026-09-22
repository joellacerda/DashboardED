import React, { useState, useMemo, useEffect } from 'react';
import {
  getData,
  addItem,
  updateItem,
  deleteItem,
  getActiveMedicosOptions,
  syncAllConveniosToDetalhes,
} from '../utils/storage';
import {
  formatCurrency,
  roundCurrency,
  formatDate,
  getTodayISO,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioInPeriod,
  getHonorarioMedicoInPeriod,
  examHasInstallmentInPeriod,
  getInstallmentLabel,
  getInstallmentLabels,
  migrateLegacyPayment,
  isCreditCardPayment,
  exportCSV,
  exportPDF,
  DEFAULT_EXAMES,
  examePermiteComplementar,
  PROCEDIMENTOS_COMPLEMENTARES,
  normalizeProcedimentosComplementares,
  formatProcedimentosComplementares,
} from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu from '../components/ExportMenu';
import AutoCompleteInput from '../components/AutoCompleteInput';

const emptyPagamento = { forma: 'Cartão de Crédito', valor: '', parcelas: '1' };

const emptyForm = {
  data: '',
  paciente: '',
  tipoExame: '',
  procedimentoComplementar: '',
  medico: '',
  pagamentos: [{ ...emptyPagamento }],
  temDivisao: false,
  medico2: '',
  divisaoTipo: 'porcentagem',
  porcentagemMedico1: 50,
  porcentagemMedico2: 50,
  valorMedico1: '',
  valorMedico2: '',
  valorRetidoTaxas: '',
  notaFiscalPercentual: 15,
  valorNotaFiscal: '',
  valorAnestesista: '',
  taxaClinica: '',
  valorAcessorios: '',
  acessorioParaMedico: false,
  valorBiopsia: '',
  honorariosMedicos: '',
};

function calcNotaFiscalFromPercent(pagamentos, percentual) {
  const totalPag = (pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const pct = Number(percentual);
  if (isNaN(pct) || pct <= 0 || totalPag <= 0) return 0;
  return roundCurrency((totalPag * pct) / 100);
}

function calcAutoHonorarios(f) {
  const pagamentos = f.pagamentos || [];
  const totalPag = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const taxas = Number(f.valorRetidoTaxas || 0);
  const nf = Number(f.valorNotaFiscal || 0);
  const anest = Number(f.valorAnestesista || 0);
  const clinica = Number(f.taxaClinica || 0);
  const acess = Number(f.valorAcessorios || 0);
  const biop = Number(f.valorBiopsia || 0);

  // When acessorioParaMedico is checked, the accessory value is NOT deducted
  // from the total — it stays as part of the doctor's honorários
  const deductAcess = f.acessorioParaMedico ? 0 : acess;
  const sobra = totalPag - (taxas + nf + anest + clinica + deductAcess + biop);
  return Math.max(0, roundCurrency(sobra));
}

export default function DetalhesPage({ prefillData, onClearPrefill }) {
  const [data, setData] = useState(() => getData('detalhesExames'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  useEffect(() => {
    if (!openActionMenuId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.row-action-menu')) {
        setOpenActionMenuId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenActionMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openActionMenuId]);

  const toggleRowExpand = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (prefillData) {
      setEditId(null);
      const examDate = prefillData.data || getTodayISO();
      setForm({
        ...emptyForm,
        data: examDate,
        paciente: prefillData.paciente || '',
        tipoExame: prefillData.tipoExame || prefillData.exame || '',
        procedimentoComplementar: prefillData.procedimentoComplementar || '',
        medico: prefillData.medico || '',
      });
      if (prefillData.data) {
        const dateObj = new Date(prefillData.data + 'T00:00:00');
        setPeriod(getAcquisitionPeriod(dateObj));
      }
      setModalOpen(true);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillData, onClearPrefill]);

  useEffect(() => {
    syncAllConveniosToDetalhes();
    setData(getData('detalhesExames'));
  }, []);

  const refresh = () => setData(getData('detalhesExames'));

  const medicosOptions = useMemo(() => getActiveMedicosOptions(), [modalOpen]);

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    const exames = getData('exames') || [];
    const detalhes = getData('detalhesExames') || [];

    exames.forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim().toUpperCase());
    });
    detalhes.forEach((d) => {
      if (d.tipoExame && d.tipoExame.trim()) set.add(d.tipoExame.trim().toUpperCase());
      if (d.exame && d.exame.trim()) set.add(d.exame.trim().toUpperCase());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [modalOpen]);

  // --- Filtered items: exams that either were performed in this period
  //     OR have installments falling in this period ---
  const filtered = useMemo(() => {
    let items = data.filter(
      (e) => isDateInPeriod(e.data, period) || examHasInstallmentInPeriod(e, period)
    );
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.paciente || '').toLowerCase().includes(q) ||
          (e.tipoExame || e.exame || '').toLowerCase().includes(q) ||
          (e.procedimentoComplementar || '').toLowerCase().includes(q) ||
          (e.medico || '').toLowerCase().includes(q) ||
          (e.formaPagamento || '').toLowerCase().includes(q) ||
          (e.pagamentos || []).some((p) => (p.forma || '').toLowerCase().includes(q))
      );
    }
    return items.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [data, search, period]);

  // --- Period-aware calculations ---
  // Payments, Fees & Taxes: ONLY for exams performed IN THIS PERIOD
  const examsInPeriod = useMemo(
    () => filtered.filter((d) => isDateInPeriod(d.data, period)),
    [filtered, period]
  );

  const totalClinicaPeriodo = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.taxaClinica || 0), 0),
    [examsInPeriod]
  );

  const totalAcessoriosPeriodo = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorAcessorios || 0), 0),
    [examsInPeriod]
  );

  const totalBiopsiaPeriodo = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorBiopsia || 0), 0),
    [examsInPeriod]
  );

  const totalPagamento = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorPagamento || 0), 0),
    [examsInPeriod]
  );

  const totalTaxas = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorRetidoTaxas || 0), 0),
    [examsInPeriod]
  );

  const totalNotaFiscal = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorNotaFiscal || 0), 0),
    [examsInPeriod]
  );

  const totalAnestesista = useMemo(
    () => examsInPeriod.reduce((s, d) => s + Number(d.valorAnestesista || 0), 0),
    [examsInPeriod]
  );

  // Honorários: distributed monthly amounts that fall in this period
  const totalHonorariosPeriodo = useMemo(
    () => filtered.reduce((s, d) => s + getHonorarioInPeriod(d, period), 0),
    [filtered, period]
  );

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data: getTodayISO(), pagamentos: [{ ...emptyPagamento }] });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    const pagamentos = migrateLegacyPayment(item).map((p) => ({
      forma: p.forma || 'Cartão de Crédito',
      valor: p.valor || '',
      parcelas: String(p.parcelas || 1),
    }));
    setForm({
      data: item.data || '',
      paciente: item.paciente || '',
      tipoExame: item.tipoExame || item.exame || '',
      procedimentoComplementar: item.procedimentoComplementar || '',
      medico: item.medico || '',
      pagamentos,
      temDivisao: !!(item.temDivisao || item.medico2),
      medico2: item.medico2 || '',
      divisaoTipo: item.divisaoTipo || 'porcentagem',
      porcentagemMedico1: item.porcentagemMedico1 ?? 50,
      porcentagemMedico2: item.porcentagemMedico2 ?? 50,
      valorMedico1: item.valorMedico1 || '',
      valorMedico2: item.valorMedico2 || '',
      valorRetidoTaxas: item.valorRetidoTaxas || '',
      notaFiscalPercentual: item.notaFiscalPercentual ?? 15,
      valorNotaFiscal: item.valorNotaFiscal || '',
      valorAnestesista: item.valorAnestesista || '',
      taxaClinica: item.taxaClinica || '',
      valorAcessorios: item.valorAcessorios || '',
      acessorioParaMedico: !!item.acessorioParaMedico,
      valorBiopsia: item.valorBiopsia || '',
      honorariosMedicos: item.honorariosMedicos || '',
    });
    setModalOpen(true);
  };

  const syncFluxoCaixaEntries = (detalheItem) => {
    if (!detalheItem || !detalheItem.id) return;
    const fluxoList = getData('fluxoCaixa') || [];

    // 1. Sync Taxa Clínica
    const valorTaxa = Number(detalheItem.taxaClinica || 0);
    const keyTaxa = `${detalheItem.id}_taxa`;
    const existingTaxa = fluxoList.find((f) => f.detalheId === keyTaxa || f.detalheId === detalheItem.id);
    const pacienteNome = detalheItem.paciente ? detalheItem.paciente.trim().toUpperCase() : '';

    const entryTaxa = {
      data: detalheItem.data,
      nome: `TAXA DE CLÍNICA — ${pacienteNome}`,
      tipo: 'entrada',
      categoria: 'Exames / Procedimentos',
      valor: valorTaxa,
      detalheId: keyTaxa,
    };

    if (valorTaxa > 0) {
      if (existingTaxa) {
        updateItem('fluxoCaixa', existingTaxa.id, entryTaxa);
      } else {
        addItem('fluxoCaixa', entryTaxa);
      }
    } else if (existingTaxa) {
      deleteItem('fluxoCaixa', existingTaxa.id);
    }

    // 2. Sync Valor de Acessórios
    // When acessorioParaMedico is true, the value goes to the doctor's fee
    // instead of the clinic's cash register, so we remove/skip the fluxo entry
    const valorAcess = Number(detalheItem.valorAcessorios || 0);
    const keyAcess = `${detalheItem.id}_acessorios`;
    const existingAcess = fluxoList.find((f) => f.detalheId === keyAcess);
    const acessGoesToClinic = !detalheItem.acessorioParaMedico;

    const entryAcess = {
      data: detalheItem.data,
      nome: `VALOR DE ACESSÓRIOS — ${pacienteNome}`,
      tipo: 'entrada',
      categoria: 'Venda de Materiais',
      valor: valorAcess,
      detalheId: keyAcess,
    };

    if (acessGoesToClinic && valorAcess > 0) {
      if (existingAcess) {
        updateItem('fluxoCaixa', existingAcess.id, entryAcess);
      } else {
        addItem('fluxoCaixa', entryAcess);
      }
    } else if (existingAcess) {
      deleteItem('fluxoCaixa', existingAcess.id);
    }

    // 3. Sync Valor de Biópsia
    const valorBiop = Number(detalheItem.valorBiopsia || 0);
    const keyBiop = `${detalheItem.id}_biopsia`;
    const existingBiop = fluxoList.find((f) => f.detalheId === keyBiop);

    const entryBiop = {
      data: detalheItem.data,
      nome: `BIÓPSIA — ${pacienteNome}`,
      tipo: 'entrada',
      categoria: 'Exames / Procedimentos',
      valor: valorBiop,
      detalheId: keyBiop,
    };

    if (valorBiop > 0) {
      if (existingBiop) {
        updateItem('fluxoCaixa', existingBiop.id, entryBiop);
      } else {
        addItem('fluxoCaixa', entryBiop);
      }
    } else if (existingBiop) {
      deleteItem('fluxoCaixa', existingBiop.id);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const pagamentos = (form.pagamentos || []).filter((p) => Number(p.valor) > 0);
    if (!form.data || !form.paciente || !form.tipoExame || !form.medico || pagamentos.length === 0) return;

    const sanitizedPagamentos = pagamentos.map((p) => ({
      forma: p.forma || 'Cartão de Crédito',
      valor: roundCurrency(p.valor),
      parcelas: Math.max(1, Number(p.parcelas) || 1),
    }));

    const totalPag = sanitizedPagamentos.reduce((s, p) => s + p.valor, 0);
    const totalParcelas = sanitizedPagamentos.reduce((s, p) => s + p.parcelas, 0);
    const formaLabel = sanitizedPagamentos.length === 1
      ? sanitizedPagamentos[0].forma
      : 'Misto';

    const allowsCompl = examePermiteComplementar(form.tipoExame);
    const sanitizedForm = {
      ...form,
      paciente: form.paciente.trim().toUpperCase(),
      tipoExame: form.tipoExame.trim().toUpperCase(),
      procedimentoComplementar: allowsCompl ? formatProcedimentosComplementares(form.procedimentoComplementar) : '',
      medico: form.medico.trim().toUpperCase(),
      medico2: form.medico2 ? form.medico2.trim().toUpperCase() : '',
      pagamentos: sanitizedPagamentos,
      // Derived fields for backward compatibility and quick display
      valorPagamento: roundCurrency(totalPag),
      numParcelas: String(totalParcelas),
      formaPagamento: formaLabel,
      valorRetidoTaxas: roundCurrency(form.valorRetidoTaxas),
      notaFiscalPercentual: form.notaFiscalPercentual !== '' ? Math.round(Number(form.notaFiscalPercentual) * 10) / 10 : 15,
      valorNotaFiscal: roundCurrency(form.valorNotaFiscal),
      valorAnestesista: roundCurrency(form.valorAnestesista),
      taxaClinica: roundCurrency(form.taxaClinica),
      valorAcessorios: roundCurrency(form.valorAcessorios),
      acessorioParaMedico: !!form.acessorioParaMedico,
      valorBiopsia: roundCurrency(form.valorBiopsia),
      honorariosMedicos: roundCurrency(form.honorariosMedicos),
      valorMedico1: form.valorMedico1 ? roundCurrency(form.valorMedico1) : '',
      valorMedico2: form.valorMedico2 ? roundCurrency(form.valorMedico2) : '',
      porcentagemMedico1: form.porcentagemMedico1 !== '' ? Math.round(Number(form.porcentagemMedico1) * 10) / 10 : 50,
      porcentagemMedico2: form.porcentagemMedico2 !== '' ? Math.round(Number(form.porcentagemMedico2) * 10) / 10 : 50,
    };
    let savedItem;
    if (editId) {
      savedItem = updateItem('detalhesExames', editId, sanitizedForm);
    } else {
      savedItem = addItem('detalhesExames', sanitizedForm);
    }
    if (savedItem) {
      syncFluxoCaixaEntries(savedItem);

      // Two-way sync: Also update corresponding exam in exames
      const examesList = getData('exames') || [];
      const matchingExames = examesList.filter(
        (e) =>
          e.id === savedItem.id ||
          (e.data === savedItem.data &&
            e.paciente &&
            e.paciente.trim().toUpperCase() === savedItem.paciente.trim().toUpperCase())
      );
      if (matchingExames.length > 0) {
        matchingExames.forEach((ex) => {
          updateItem('exames', ex.id, {
            data: savedItem.data,
            paciente: savedItem.paciente,
            medico: savedItem.medico,
            exame: savedItem.tipoExame,
            procedimentoComplementar: savedItem.procedimentoComplementar || '',
          });
        });
      }
    }
    refresh();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      const fluxoList = getData('fluxoCaixa') || [];
      const linked = fluxoList.filter(
        (f) =>
          f.detalheId === deleteId ||
          f.detalheId === `${deleteId}_taxa` ||
          f.detalheId === `${deleteId}_acessorios` ||
          f.detalheId === `${deleteId}_biopsia`
      );
      linked.forEach((entry) => deleteItem('fluxoCaixa', entry.id));
      deleteItem('detalhesExames', deleteId);
      refresh();
    }
  };

  const updateField = (field, value) => {
    setForm((f) => {
      const updated = { ...f, [field]: value };

      // When the NF percentage changes, auto-calculate the NF value
      if (field === 'notaFiscalPercentual') {
        const nfVal = calcNotaFiscalFromPercent(updated.pagamentos, value);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }

      // When NF value is manually changed, reverse-calculate the percentage
      if (field === 'valorNotaFiscal') {
        const totalPag = (updated.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
        if (totalPag > 0) {
          const pct = Math.round(((Number(value) || 0) / totalPag) * 1000) / 10;
          updated.notaFiscalPercentual = pct;
        }
      }

      // When pagamentos change, recalculate NF value from current percentage
      if (field === 'pagamentos') {
        const nfVal = calcNotaFiscalFromPercent(value, updated.notaFiscalPercentual);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }

      if (
        [
          'valorRetidoTaxas',
          'valorNotaFiscal',
          'notaFiscalPercentual',
          'valorAnestesista',
          'taxaClinica',
          'valorAcessorios',
          'acessorioParaMedico',
          'valorBiopsia',
          'pagamentos',
        ].includes(field)
      ) {
        const autoHon = calcAutoHonorarios(updated);
        updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      }
      return updated;
    });
  };

  // Helpers for pagamentos manipulation
  const updatePagamento = (index, field, value) => {
    setForm((f) => {
      const pagamentos = [...(f.pagamentos || [])];
      pagamentos[index] = { ...pagamentos[index], [field]: value };
      // Auto-set parcelas=1 for non-credit-card
      if (field === 'forma' && !isCreditCardPayment(value, 1)) {
        pagamentos[index].parcelas = '1';
      }
      const updated = { ...f, pagamentos };
      // Recalculate NF value when payment amounts change
      if (field === 'valor') {
        const nfVal = calcNotaFiscalFromPercent(pagamentos, updated.notaFiscalPercentual);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }
      const autoHon = calcAutoHonorarios(updated);
      updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      return updated;
    });
  };

  const addPagamento = () => {
    setForm((f) => ({
      ...f,
      pagamentos: [...(f.pagamentos || []), { ...emptyPagamento }],
    }));
  };

  const removePagamento = (index) => {
    setForm((f) => {
      const pagamentos = (f.pagamentos || []).filter((_, i) => i !== index);
      if (pagamentos.length === 0) pagamentos.push({ ...emptyPagamento });
      const updated = { ...f, pagamentos };
      // Recalculate NF value after removing a payment
      const nfVal = calcNotaFiscalFromPercent(pagamentos, updated.notaFiscalPercentual);
      updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      const autoHon = calcAutoHonorarios(updated);
      updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      return updated;
    });
  };

  // Computed totals from pagamentos
  const totalPagamentos = (form.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalParcelasForm = (form.pagamentos || []).reduce((s, p) => s + Math.max(1, Number(p.parcelas) || 1), 0);

  // Compute honorário mensal for the form preview
  const formHonorarioMensal = roundCurrency(
    Number(form.honorariosMedicos || 0) / Math.max(1, totalParcelasForm)
  );

  // Compute doctor split honorários for the form preview
  const totalHonForm = Number(form.honorariosMedicos || 0);
  let honDoc1Total = 0;
  let honDoc2Total = 0;
  let honDoc1Mensal = 0;
  let honDoc2Mensal = 0;

  if (form.temDivisao && form.medico2) {
    if (form.divisaoTipo === 'valor') {
      const val1 = Number(form.valorMedico1) || 0;
      const val2 = Number(form.valorMedico2) || 0;
      honDoc1Total = roundCurrency(val1);
      honDoc2Total = roundCurrency(val2);
      honDoc1Mensal = roundCurrency(val1 / Math.max(1, totalParcelasForm));
      honDoc2Mensal = roundCurrency(val2 / Math.max(1, totalParcelasForm));
    } else {
      const pct1 = Number(form.porcentagemMedico1) ?? 50;
      const pct2 = Number(form.porcentagemMedico2) ?? 50;
      honDoc1Total = roundCurrency((totalHonForm * pct1) / 100);
      honDoc2Total = roundCurrency((totalHonForm * pct2) / 100);
      honDoc1Mensal = roundCurrency((formHonorarioMensal * pct1) / 100);
      honDoc2Mensal = roundCurrency((formHonorarioMensal * pct2) / 100);
    }
  }

  // Export columns (period-aware)
  const exportColumns = [
    { key: 'data', label: 'Data', accessor: (item) => formatDate(item.data) },
    { key: 'paciente', label: 'Paciente' },
    {
      key: 'tipoExame', label: 'Tipo de Exame', accessor: (item) => {
        const base = (item.tipoExame || item.exame || '').toUpperCase();
        const compl = formatProcedimentosComplementares(item.procedimentoComplementar);
        return compl ? `${base} + ${compl}` : base;
      }
    },
    { key: 'medico', label: 'Médico' },
    {
      key: 'formaPagamento', label: 'Forma Pagamento', accessor: (item) => {
        const pags = migrateLegacyPayment(item);
        if (pags.length === 1) return `${pags[0].forma} ${pags[0].parcelas}x`;
        return pags.map((p) => `${p.forma} ${p.parcelas}x`).join(' + ');
      }
    },
    {
      key: 'valorPagamento', label: 'Pagamento', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorPagamento) : '—'
    },
    {
      key: 'valorRetidoTaxas', label: 'Taxas Retidas', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorRetidoTaxas) : '—'
    },
    {
      key: 'valorNotaFiscal', label: 'Nota Fiscal', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorNotaFiscal) : '—'
    },
    {
      key: 'valorAnestesista', label: 'Anestesista', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorAnestesista) : '—'
    },
    {
      key: 'taxaClinica', label: 'Taxa Clínica', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.taxaClinica) : '—'
    },
    {
      key: 'valorAcessorios', label: 'Acessórios', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorAcessorios) : '—'
    },
    {
      key: 'valorBiopsia', label: 'Biópsia', accessor: (item) =>
        isDateInPeriod(item.data, period) ? formatCurrency(item.valorBiopsia) : '—'
    },
    {
      key: 'numParcelas', label: 'Parcelas', accessor: (item) => {
        const pags = migrateLegacyPayment(item);
        return pags.reduce((s, p) => s + Math.max(1, Number(p.parcelas) || 1), 0);
      }
    },
    { key: 'honorariosMedicos', label: 'Hon. Total', accessor: (item) => formatCurrency(item.honorariosMedicos) },
    {
      key: 'honorarioMensal', label: 'Hon. no Período', accessor: (item) =>
        formatCurrency(getHonorarioInPeriod(item, period))
    },
    {
      key: 'parcPeriodo', label: 'Período Parcelas', accessor: (item) =>
        getInstallmentLabel(item.data, migrateLegacyPayment(item), item.formaPagamento)
    },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Detalhes de Exames</h1>
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
            + Novo Detalhe
          </button>
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Taxa Clínica no Período</span>
              <div className="summary-card-icon">🏥</div>
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(totalClinicaPeriodo)}</div>
          </div>
          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Honorários no Período</span>
              <div className="summary-card-icon purple">👨‍⚕️</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalHonorariosPeriodo)}</div>
          </div>
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Pagamentos (Exames)</span>
              <div className="summary-card-icon blue">💳</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalPagamento)}</div>
          </div>
          <div className="summary-card card-accent-red">
            <div className="summary-card-header">
              <span className="summary-card-label">Total Taxas Retidas</span>
              <div className="summary-card-icon red">📊</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalTaxas)}</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="table-title">Detalhamento Financeiro</h3>
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
                onExportCSV={() => exportCSV(filtered, exportColumns, 'detalhes_exames')}
                onExportPDF={() => exportPDF(filtered, exportColumns, `Detalhes de Exames — ${period.label}`)}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table detalhes-compact-table">
              <thead>
                <tr>
                  <th style={{ width: '28px' }} />
                  <th style={{ width: '80px' }}>Data</th>
                  <th>Paciente</th>
                  <th style={{ width: '200px' }}>Exame</th>
                  <th style={{ width: '115px' }}>Médico</th>
                  <th style={{ width: '100px' }}>Pagamento</th>
                  <th style={{ width: '110px' }}>Hon. Período</th>
                  <th style={{ width: '44px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="table-empty">
                        <div className="table-empty-icon">📋</div>
                        <p>Nenhum detalhe registrado para este período{search ? ' e busca' : ''}.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filtered.map((item, index) => {
                      const pags = migrateLegacyPayment(item);
                      const honNoPeriodo = getHonorarioInPeriod(item, period);
                      const isExamInThisPeriod = isDateInPeriod(item.data, period);
                      const isExpanded = expandedRows.has(item.id);
                      const isNearBottom = filtered.length > 2 && index >= filtered.length - 2;

                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            className={`expandable-row${isExpanded ? ' expanded' : ''}`}
                            style={!isExamInThisPeriod ? { opacity: 0.8, fontStyle: 'italic' } : undefined}
                            title={!isExamInThisPeriod ? 'Exame de outro período — parcela de honorários cai neste período' : undefined}
                          >
                            <td>
                              <button
                                type="button"
                                className={`btn-expand-row${isExpanded ? ' expanded' : ''}`}
                                onClick={() => toggleRowExpand(item.id)}
                                title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes financeiros'}
                                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                              >
                                ▶
                              </button>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.data)}</td>
                            <td>
                              <div
                                className="table-cell-truncate table-patient-name"
                                title={item.paciente ? item.paciente.toUpperCase() : ''}
                              >
                                {item.paciente ? item.paciente.toUpperCase() : ''}
                              </div>
                              {item.isConvenio && (
                                <div style={{ marginTop: '0.15rem' }}>
                                  <span
                                    className="badge badge-info table-cell-truncate"
                                    style={{ fontSize: '10px', padding: '0.05rem 0.35rem', maxWidth: '100%', display: 'inline-block' }}
                                    title={`Convênio: ${item.convenio || 'CONVÊNIO'}`}
                                  >
                                    🏢 {item.convenio || 'CONVÊNIO'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                                <span
                                  className="table-cell-truncate"
                                  title={(item.tipoExame || item.exame || '').toUpperCase()}
                                >
                                  {(item.tipoExame || item.exame || '').toUpperCase()}
                                </span>
                                {normalizeProcedimentosComplementares(item.procedimentoComplementar).map((proc) => {
                                  const tagLabel = proc === 'POLIPECTOMIA' ? 'P' : 'M';
                                  return (
                                    <span
                                      key={proc}
                                      className="badge badge-info"
                                      style={{ fontSize: '10px', padding: '0.05rem 0.3rem', flexShrink: 0, fontWeight: 700 }}
                                      title={proc}
                                    >
                                      {tagLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td>
                              <div
                                className="table-cell-truncate"
                                style={{ fontWeight: 500 }}
                                title={item.medico ? item.medico.toUpperCase() : ''}
                              >
                                {item.medico ? item.medico.toUpperCase() : ''}
                              </div>
                              {item.medico2 && (
                                <div
                                  className="table-cell-truncate"
                                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-accent)', marginTop: '0.1rem' }}
                                  title={`c/ ${item.medico2.toUpperCase()}`}
                                >
                                  👥 c/ {item.medico2.toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className="value-currency" style={{ fontWeight: 600 }}>
                                {isExamInThisPeriod ? formatCurrency(item.valorPagamento) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </div>
                              {isExamInThisPeriod && pags.length === 1 && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  {pags[0].forma}{pags[0].parcelas > 1 ? ` ${pags[0].parcelas}x` : ''}
                                </div>
                              )}
                              {isExamInThisPeriod && pags.length > 1 && (
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                  Misto ({pags.length}x)
                                </div>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className={honNoPeriodo > 0 ? 'value-positive' : 'value-currency'} style={{ fontWeight: 600 }}>
                                {formatCurrency(honNoPeriodo)}
                                {honNoPeriodo > 0 && (
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-emerald)', marginInlineStart: '0.25rem' }}>✓</span>
                                )}
                              </div>
                              {honNoPeriodo > 0 && (item.temDivisao || item.medico2) && (
                                <div style={{ fontSize: '11px', color: 'var(--text-accent)', marginTop: '0.15rem', lineHeight: 1.25 }}>
                                  <div className="table-cell-truncate" title={`${item.medico}: ${formatCurrency(getHonorarioMedicoInPeriod(item, item.medico, period))}`}>
                                    {item.medico ? item.medico.toUpperCase() : ''}: {formatCurrency(getHonorarioMedicoInPeriod(item, item.medico, period))}
                                  </div>
                                  <div className="table-cell-truncate" title={`${item.medico2}: ${formatCurrency(getHonorarioMedicoInPeriod(item, item.medico2, period))}`}>
                                    {item.medico2 ? item.medico2.toUpperCase() : ''}: {formatCurrency(getHonorarioMedicoInPeriod(item, item.medico2, period))}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="row-action-menu">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon btn-sm action-menu-trigger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenActionMenuId(openActionMenuId === item.id ? null : item.id);
                                  }}
                                  title="Opções"
                                  aria-label="Opções"
                                >
                                  <span className="action-menu-dots">•••</span>
                                </button>
                                {openActionMenuId === item.id && (
                                  <div
                                    className={`action-menu-popover${isNearBottom ? ' open-up' : ''}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="action-menu-item"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        openEdit(item);
                                      }}
                                    >
                                      <span className="action-menu-icon">✏️</span>
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="action-menu-item action-menu-item-danger"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setDeleteId(item.id);
                                      }}
                                    >
                                      <span className="action-menu-icon">🗑️</span>
                                      <span>Excluir</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail panel */}
                          {isExpanded && (
                            <tr className="expanded-detail-row">
                              <td colSpan="8">
                                <div className="expanded-detail-panel">
                                  <div className="expanded-detail-grid">
                                    {/* Coluna 1: Financeiro Bruto */}
                                    <div className="expanded-detail-section">
                                      <div className="expanded-detail-section-title">💳 Pagamento</div>
                                      <div className="expanded-detail-items">
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Total Pagamento</span>
                                          <span className="expanded-detail-value">{isExamInThisPeriod ? formatCurrency(item.valorPagamento) : '—'}</span>
                                        </div>
                                        {pags.map((p, i) => (
                                          <div className="expanded-detail-item" key={i}>
                                            <span className="expanded-detail-label">{p.forma}</span>
                                            <span className="expanded-detail-value" style={{ fontSize: 'var(--text-xs)' }}>
                                              {formatCurrency(p.valor)}{p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Coluna 2: Deduções */}
                                    <div className="expanded-detail-section">
                                      <div className="expanded-detail-section-title">📊 Deduções</div>
                                      <div className="expanded-detail-items">
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Taxas Retidas</span>
                                          <span className="expanded-detail-value value-negative">{isExamInThisPeriod ? formatCurrency(item.valorRetidoTaxas) : '—'}</span>
                                        </div>
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Nota Fiscal{item.notaFiscalPercentual ? ` (${item.notaFiscalPercentual}%)` : ''}</span>
                                          <span className="expanded-detail-value value-negative">{isExamInThisPeriod ? formatCurrency(item.valorNotaFiscal) : '—'}</span>
                                        </div>
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Anestesista</span>
                                          <span className="expanded-detail-value value-negative">{isExamInThisPeriod ? formatCurrency(item.valorAnestesista) : '—'}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Coluna 3: Receita Clínica */}
                                    <div className="expanded-detail-section">
                                      <div className="expanded-detail-section-title">🏥 Receita Clínica</div>
                                      <div className="expanded-detail-items">
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Taxa Clínica</span>
                                          <span className="expanded-detail-value value-positive">{isExamInThisPeriod ? formatCurrency(item.taxaClinica) : '—'}</span>
                                        </div>
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Acessórios{item.acessorioParaMedico ? ' (→ Médico)' : ''}</span>
                                          <span className="expanded-detail-value value-positive">{isExamInThisPeriod ? formatCurrency(item.valorAcessorios) : '—'}</span>
                                        </div>
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Biópsia</span>
                                          <span className="expanded-detail-value value-positive">{isExamInThisPeriod ? formatCurrency(item.valorBiopsia) : '—'}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Coluna 4: Honorários */}
                                    <div className="expanded-detail-section">
                                      <div className="expanded-detail-section-title">👨‍⚕️ Honorários</div>
                                      <div className="expanded-detail-items">
                                        <div className="expanded-detail-item">
                                          <span className="expanded-detail-label">Total Honorários</span>
                                          <span className="expanded-detail-value" style={{ fontWeight: 700 }}>{formatCurrency(item.honorariosMedicos)}</span>
                                        </div>
                                        {(item.temDivisao || item.medico2) && (
                                          <>
                                            {item.divisaoTipo === 'valor' ? (
                                              <>
                                                <div className="expanded-detail-item">
                                                  <span className="expanded-detail-label">{item.medico || 'Médico 1'}</span>
                                                  <span className="expanded-detail-value">{formatCurrency(item.valorMedico1)}</span>
                                                </div>
                                                <div className="expanded-detail-item">
                                                  <span className="expanded-detail-label">{item.medico2 || 'Médico 2'}</span>
                                                  <span className="expanded-detail-value">{formatCurrency(item.valorMedico2)}</span>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="expanded-detail-item">
                                                  <span className="expanded-detail-label">{item.medico || 'Médico 1'} ({item.porcentagemMedico1 ?? 50}%)</span>
                                                  <span className="expanded-detail-value">{formatCurrency(roundCurrency((Number(item.honorariosMedicos || 0) * (Number(item.porcentagemMedico1) ?? 50)) / 100))}</span>
                                                </div>
                                                <div className="expanded-detail-item">
                                                  <span className="expanded-detail-label">{item.medico2 || 'Médico 2'} ({item.porcentagemMedico2 ?? 50}%)</span>
                                                  <span className="expanded-detail-value">{formatCurrency(roundCurrency((Number(item.honorariosMedicos || 0) * (Number(item.porcentagemMedico2) ?? 50)) / 100))}</span>
                                                </div>
                                              </>
                                            )}
                                          </>
                                        )}
                                        <div className="expanded-detail-item" style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                                          <span className="expanded-detail-label">Período Parcelas</span>
                                          <span className="expanded-detail-value" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            {getInstallmentLabels(item.data, pags, item.formaPagamento).map((label, idx) => (
                                              <div key={idx} style={{ whiteSpace: 'nowrap' }}>{label}</div>
                                            ))}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    <tr className="totals-row">
                      <td />
                      <td colSpan="4" style={{ textAlign: 'end', fontWeight: 700 }}>Totais no período:</td>
                      <td className="value-currency" style={{ fontWeight: 700 }}>{formatCurrency(totalPagamento)}</td>
                      <td className="value-positive" style={{ fontWeight: 700 }}>{formatCurrency(totalHonorariosPeriodo)}</td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="table-footer">
              <span>{filtered.length} registro(s)</span>
              <span>
                Clínica: {formatCurrency(totalClinicaPeriodo)} | Acess.: {formatCurrency(totalAcessoriosPeriodo)} | Biópsia: {formatCurrency(totalBiopsiaPeriodo)} | Honorários: {formatCurrency(totalHonorariosPeriodo)}
              </span>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Detalhe' : 'Novo Detalhe de Exame'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>{editId ? 'Salvar' : 'Cadastrar'}</button>
          </>
        }
      >
        <form onSubmit={handleSave} autoComplete="off">
          <div className="modal-form-grid">
            <div className="input-group">
              <label className="input-label">Data <span className="required">*</span></label>
              <input type="date" className="input-field" required value={form.data} onChange={(e) => updateField('data', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Médico Principal <span className="required">*</span></label>
              <AutoCompleteInput
                options={medicosOptions}
                required
                placeholder="Selecione ou digite o médico"
                value={form.medico}
                onChange={(val) => updateField('medico', val.toUpperCase())}
              />
            </div>

            <div className="input-group full-width" style={{ marginTop: '0.1rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                <input
                  type="checkbox"
                  checked={form.temDivisao}
                  onChange={(e) => updateField('temDivisao', e.target.checked)}
                />
                <span>👥 <strong>Dividir honorários com outro médico</strong></span>
              </label>
            </div>

            {form.temDivisao && (
              <div className="full-width" style={{
                padding: '0.875rem 1rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-medium)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxSizing: 'border-box',
                width: '100%',
              }}>
                <div className="input-group">
                  <label className="input-label">Segundo Médico (Co-médico / Assistente) <span className="required">*</span></label>
                  <AutoCompleteInput
                    options={medicosOptions}
                    required={form.temDivisao}
                    placeholder="Selecione ou digite o 2º médico"
                    value={form.medico2}
                    onChange={(val) => updateField('medico2', val.toUpperCase())}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Tipo de Divisão de Honorários</label>
                  <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="divisaoTipo"
                        value="porcentagem"
                        checked={form.divisaoTipo === 'porcentagem'}
                        onChange={() => updateField('divisaoTipo', 'porcentagem')}
                      />
                      Porcentagem (%)
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="divisaoTipo"
                        value="valor"
                        checked={form.divisaoTipo === 'valor'}
                        onChange={() => updateField('divisaoTipo', 'valor')}
                      />
                      Valor Fixo (R$)
                    </label>
                  </div>
                </div>

                {form.divisaoTipo === 'porcentagem' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label className="input-label">% {form.medico || 'Médico 1'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="50.0"
                        value={form.porcentagemMedico1}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setForm((f) => ({ ...f, porcentagemMedico1: '', porcentagemMedico2: '' }));
                            return;
                          }
                          const val = Number(raw);
                          if (isNaN(val)) return;
                          const clamped = Math.min(100, Math.max(0, val));
                          const other = Math.round((100 - clamped) * 10) / 10;
                          setForm((f) => ({ ...f, porcentagemMedico1: raw, porcentagemMedico2: other }));
                        }}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">% {form.medico2 || 'Médico 2'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="50.0"
                        value={form.porcentagemMedico2}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setForm((f) => ({ ...f, porcentagemMedico2: '', porcentagemMedico1: '' }));
                            return;
                          }
                          const val = Number(raw);
                          if (isNaN(val)) return;
                          const clamped = Math.min(100, Math.max(0, val));
                          const other = Math.round((100 - clamped) * 10) / 10;
                          setForm((f) => ({ ...f, porcentagemMedico2: raw, porcentagemMedico1: other }));
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label className="input-label">R$ {form.medico || 'Médico 1'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={form.valorMedico1}
                        onChange={(e) => updateField('valorMedico1', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">R$ {form.medico2 || 'Médico 2'}</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={form.valorMedico2}
                        onChange={(e) => updateField('valorMedico2', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="input-group full-width">
              <label className="input-label">Paciente <span className="required">*</span></label>
              <input
                type="text"
                className="input-field"
                required
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Nome do paciente"
                value={form.paciente}
                onChange={(e) => updateField('paciente', e.target.value.toUpperCase())}
              />
            </div>
            <div className="input-group full-width">
              <label className="input-label">Tipo de Exame <span className="required">*</span></label>
              <AutoCompleteInput
                options={examesOptions}
                required
                placeholder="Selecione ou digite o tipo de exame"
                value={form.tipoExame}
                onChange={(val) => {
                  const upper = val.toUpperCase();
                  setForm((f) => ({
                    ...f,
                    tipoExame: upper,
                    procedimentoComplementar: examePermiteComplementar(upper) ? f.procedimentoComplementar : '',
                  }));
                }}
              />
            </div>

            {examePermiteComplementar(form.tipoExame) && (
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
                            updateField('procedimentoComplementar', formatProcedimentosComplementares(updatedList));
                          }}
                        />
                        <span>{proc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {/* === SEÇÃO DE PAGAMENTOS DINÂMICA === */}
            <div className="full-width pagamentos-section">
              <div className="pagamentos-header">
                <span className="pagamentos-title">💳 Pagamentos <span className="required">*</span></span>
                <button
                  type="button"
                  className="btn-pagamento-add"
                  onClick={addPagamento}
                >
                  + Adicionar
                </button>
              </div>

              {(form.pagamentos || []).map((pag, idx) => (
                <div key={idx} className="pagamento-row">
                  <div className="pagamento-row-header">
                    <span className="pagamento-row-label">Pagamento {idx + 1}</span>
                    {(form.pagamentos || []).length > 1 && (
                      <button
                        type="button"
                        className="pagamento-row-remove"
                        onClick={() => removePagamento(idx)}
                        title="Remover pagamento"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="pagamento-row-fields">
                    <div className="input-group">
                      <label className="input-label">Forma</label>
                      <select
                        className="input-field"
                        value={pag.forma || 'Cartão de Crédito'}
                        onChange={(e) => updatePagamento(idx, 'forma', e.target.value)}
                      >
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Pix">Pix</option>
                        <option value="Espécie">Espécie</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">Valor (R$)</label>
                      <input
                        type="number"
                        className="input-field"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        required={idx === 0}
                        value={pag.valor}
                        onChange={(e) => updatePagamento(idx, 'valor', e.target.value)}
                      />
                    </div>
                    {isCreditCardPayment(pag.forma, 1) && (
                      <div className="input-group">
                        <label className="input-label">Parcelas</label>
                        <input
                          type="number"
                          className="input-field"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={pag.parcelas}
                          onChange={(e) => updatePagamento(idx, 'parcelas', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {totalPagamentos > 0 && (
                <div className="pagamentos-total">
                  Total Pagamentos: <strong>{formatCurrency(totalPagamentos)}</strong>
                </div>
              )}
            </div>

            {/* === DEDUÇÕES / TAXAS (POR EXAME) === */}
            <div className="input-group">
              <label className="input-label">Valor Retido em Taxas (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorRetidoTaxas} onChange={(e) => updateField('valorRetidoTaxas', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Valor Nota Fiscal (R$)</span>
                {totalPagamentos > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {form.notaFiscalPercentual || 0}% de {formatCurrency(totalPagamentos)}
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: '68px', flexShrink: 0 }}>
                  <input
                    type="number"
                    className="input-field"
                    min="0"
                    max="100"
                    step="0.5"
                    style={{ width: '100%', textAlign: 'center', padding: '0.45rem 0.2rem' }}
                    value={form.notaFiscalPercentual}
                    onChange={(e) => updateField('notaFiscalPercentual', e.target.value)}
                    title="Porcentagem da Nota Fiscal"
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>=</span>
                <input
                  type="number"
                  className="input-field"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  style={{ flex: 1, minWidth: 0 }}
                  value={form.valorNotaFiscal}
                  onChange={(e) => updateField('valorNotaFiscal', e.target.value)}
                />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Valor Anestesista (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorAnestesista} onChange={(e) => updateField('valorAnestesista', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Taxa de Clínica (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.taxaClinica} onChange={(e) => updateField('taxaClinica', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Valor de Acessórios (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorAcessorios} onChange={(e) => updateField('valorAcessorios', e.target.value)} />
              {Number(form.valorAcessorios) > 0 && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: 'var(--text-xs)', marginTop: '0.4rem', color: form.acessorioParaMedico ? 'var(--color-emerald)' : 'var(--text-muted)', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={form.acessorioParaMedico}
                    onChange={(e) => updateField('acessorioParaMedico', e.target.checked)}
                  />
                  <span>👨‍⚕️ Adicionar ao honorário do médico realizante (ao invés do caixa da clínica)</span>
                </label>
              )}
            </div>
            <div className="input-group">
              <label className="input-label">Valor de Biópsia (R$)</label>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.valorBiopsia} onChange={(e) => updateField('valorBiopsia', e.target.value)} />
            </div>
            <div className="input-group full-width">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label">Honorários Médicos — Total (R$)</label>
              </div>
              <input type="number" className="input-field" min="0" step="0.01" placeholder="0,00" value={form.honorariosMedicos} onChange={(e) => updateField('honorariosMedicos', e.target.value)} />
            </div>
          </div>

          {/* Preview de parcelas e honorário mensal */}
          {(totalParcelasForm >= 1 && Number(form.honorariosMedicos) > 0) && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'oklch(70% 0.18 250 / 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid oklch(70% 0.18 250 / 0.15)',
            }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                📅 Distribuição de Honorários
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  Honorário por parcela ({totalParcelasForm}x):
                </span>
                <span style={{ fontWeight: 700, color: 'var(--color-blue)', fontSize: 'var(--text-lg)' }}>
                  {formatCurrency(formHonorarioMensal)}
                </span>
              </div>
              {form.data && (form.pagamentos || []).map((pag, idx) => {
                const n = Math.max(1, Number(pag.parcelas) || 1);
                const label = getInstallmentLabel(form.data, [pag]);
                return (
                  <div key={idx} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {pag.forma}: {n}x — {label}
                  </div>
                );
              })}
              {form.temDivisao && form.medico2 && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'oklch(70% 0.18 250 / 0.12)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid oklch(70% 0.18 250 / 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    👥 Divisão entre Médicos ({totalParcelasForm}x parcelas):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.medico || 'Médico 1'} ({form.divisaoTipo === 'porcentagem' ? `${form.porcentagemMedico1 ?? 50}%` : 'Fixo'}):
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
                        {formatCurrency(honDoc1Total)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--text-muted)' }}>total</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {formatCurrency(honDoc1Mensal)} / parcela
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.medico2 || 'Médico 2'} ({form.divisaoTipo === 'porcentagem' ? `${form.porcentagemMedico2 ?? 50}%` : 'Fixo'}):
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--color-emerald)', fontSize: 'var(--text-sm)', marginTop: '0.15rem' }}>
                        {formatCurrency(honDoc2Total)} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--text-muted)' }}>total</span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {formatCurrency(honDoc2Mensal)} / parcela
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                background: 'oklch(72% 0.19 160 / 0.08)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-emerald)',
              }}>
                💡 A taxa de clínica ({formatCurrency(form.taxaClinica)}) entra integralmente no período em que o exame foi realizado.
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja excluir este registro?"
      />
    </>
  );
}

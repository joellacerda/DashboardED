import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import {
  roundCurrency,
  getTodayISO,
  DEFAULT_EXAMES,
  examePermiteComplementar,
  formatProcedimentosComplementares,
  migrateLegacyPayment,
  isCreditCardPayment,
  getHonorarioSchedule,
  parsePercentOrDefault,
} from '../../utils/helpers';
import {
  validateDate,
  validateRequired,
  validatePercentageSum,
} from '../../utils/validation';
import { MODULES } from '../../utils/storage';

export const emptyPagamento = { forma: 'Cartão de Crédito', valor: '', parcelas: '1' };

export const emptyForm = {
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

export function calcNotaFiscalFromPercent(pagamentos, percentual) {
  const totalPag = (pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const pct = Number(percentual);
  if (isNaN(pct) || pct <= 0 || totalPag <= 0) return 0;
  return roundCurrency((totalPag * pct) / 100);
}

export function calcAutoHonorarios(f) {
  const pagamentos = f.pagamentos || [];
  const totalPag = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const taxas = Number(f.valorRetidoTaxas || 0);
  const nf = Number(f.valorNotaFiscal || 0);
  const anest = Number(f.valorAnestesista || 0);
  const clinica = Number(f.taxaClinica || 0);
  const acess = Number(f.valorAcessorios || 0);
  const biop = Number(f.valorBiopsia || 0);

  const deductAcess = f.acessorioParaMedico ? 0 : acess;
  const sobra = totalPag - (taxas + nf + anest + clinica + deductAcess + biop);
  return Math.max(0, roundCurrency(sobra));
}

export function useDetalhesForm({ isOpen, editItem, prefillData, onClose, onSuccess }) {
  const toast = useToast();
  const {
    fluxoCaixa = [],
    exames = [],
    detalhesExames = [],
    addItem,
    updateItem,
    deleteItem,
    activeMedicosOptions,
    revertConvenioOverride,
  } = useData();

  const [form, setForm] = useState({ ...emptyForm, data: getTodayISO() });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const dateErr = validateDate(form.data, 'Data do exame');
    if (dateErr) errs.data = dateErr;

    const medErr = validateRequired(form.medico, 'Médico principal');
    if (medErr) errs.medico = medErr;

    if (form.temDivisao) {
      const med2Err = validateRequired(form.medico2, 'Segundo médico');
      if (med2Err) {
        errs.medico2 = med2Err;
      } else if (form.medico && form.medico.trim().toUpperCase() === form.medico2.trim().toUpperCase()) {
        errs.medico2 = 'O 2º médico deve ser diferente do médico principal.';
      }

      if (form.divisaoTipo === 'porcentagem') {
        const sumErr = validatePercentageSum(form.porcentagemMedico1, form.porcentagemMedico2);
        if (sumErr) errs.divisao = sumErr;
      }
    }

    const pacErr = validateRequired(form.paciente, 'Nome do paciente');
    if (pacErr) errs.paciente = pacErr;

    const exameErr = validateRequired(form.tipoExame, 'Tipo de exame');
    if (exameErr) errs.tipoExame = exameErr;

    const pagamentos = form.pagamentos || [];
    const validPags = pagamentos.filter((p) => Number(p.valor) > 0);
    if (pagamentos.length === 0 || validPags.length === 0) {
      errs.pagamentos = 'Adicione ao menos uma forma de pagamento com valor maior que R$ 0,00.';
    }

    return errs;
  }, [form]);

  const hasError = (field) => {
    return Boolean((submitted || touched[field]) && validationErrors[field]);
  };

  const medicosOptions = activeMedicosOptions;

  const examesOptions = useMemo(() => {
    const set = new Set(DEFAULT_EXAMES);
    exames.forEach((e) => {
      if (e.exame && e.exame.trim()) set.add(e.exame.trim().toUpperCase());
    });
    detalhesExames.forEach((d) => {
      if (d.tipoExame && d.tipoExame.trim()) set.add(d.tipoExame.trim().toUpperCase());
      if (d.exame && d.exame.trim()) set.add(d.exame.trim().toUpperCase());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [exames, detalhesExames]);

  useEffect(() => {
    if (!isOpen) {
      setTouched({});
      setSubmitted(false);
      return;
    }

    if (editItem) {
      const pagamentos = migrateLegacyPayment(editItem).map((p) => ({
        forma: p.forma || 'Cartão de Crédito',
        valor: p.valor || '',
        parcelas: String(p.parcelas || 1),
      }));
      setForm({
        id: editItem.id,
        origemConvenioId: editItem.origemConvenioId || '',
        isConvenio: Boolean(editItem.isConvenio || editItem.origemConvenioId),
        manualOverride: Boolean(editItem.manualOverride),
        convenio: editItem.convenio || '',
        data: editItem.data || '',
        paciente: editItem.paciente || '',
        tipoExame: editItem.tipoExame || editItem.exame || '',
        procedimentoComplementar: editItem.procedimentoComplementar || '',
        medico: editItem.medico || '',
        pagamentos,
        temDivisao: Boolean(editItem.temDivisao || editItem.medico2),
        medico2: editItem.medico2 || '',
        divisaoTipo: editItem.divisaoTipo || 'porcentagem',
        porcentagemMedico1: editItem.porcentagemMedico1 ?? 50,
        porcentagemMedico2: editItem.porcentagemMedico2 ?? 50,
        valorMedico1: editItem.valorMedico1 || '',
        valorMedico2: editItem.valorMedico2 || '',
        valorRetidoTaxas: editItem.valorRetidoTaxas || '',
        notaFiscalPercentual: editItem.notaFiscalPercentual ?? 15,
        valorNotaFiscal: editItem.valorNotaFiscal || '',
        valorAnestesista: editItem.valorAnestesista || '',
        taxaClinica: editItem.taxaClinica || '',
        valorAcessorios: editItem.valorAcessorios || '',
        acessorioParaMedico: Boolean(editItem.acessorioParaMedico),
        valorBiopsia: editItem.valorBiopsia || '',
        honorariosMedicos: editItem.honorariosMedicos || '',
      });
    } else if (prefillData) {
      const examDate = prefillData.data || getTodayISO();
      setForm({
        ...emptyForm,
        data: examDate,
        paciente: prefillData.paciente || '',
        tipoExame: prefillData.tipoExame || prefillData.exame || '',
        procedimentoComplementar: prefillData.procedimentoComplementar || '',
        medico: prefillData.medico || '',
        origemConvenioId: prefillData.origemConvenioId || '',
        isConvenio: Boolean(prefillData.isConvenio || prefillData.origemConvenioId),
        manualOverride: Boolean(prefillData.manualOverride),
        convenio: prefillData.convenio || '',
        pagamentos: [{ ...emptyPagamento }],
      });
    } else {
      setForm({ ...emptyForm, data: getTodayISO(), pagamentos: [{ ...emptyPagamento }] });
    }
  }, [isOpen, editItem, prefillData]);

  const handleRevertConvenio = () => {
    if (!editItem?.id) return;
    const restored = revertConvenioOverride(editItem.id);
    if (restored) {
      toast.success('Valores padrão do convênio restaurados com sucesso!');
      if (onSuccess) onSuccess(restored);
      onClose();
    } else {
      toast.error('Não foi possível restaurar os dados do convênio.');
    }
  };

  const updateField = (field, value) => {
    setForm((f) => {
      const updated = { ...f, [field]: value };

      if (field === 'notaFiscalPercentual') {
        const nfVal = calcNotaFiscalFromPercent(updated.pagamentos, value);
        updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      }

      if (field === 'valorNotaFiscal') {
        const totalPag = (updated.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
        if (totalPag > 0) {
          const pct = Math.round(((Number(value) || 0) / totalPag) * 1000) / 10;
          updated.notaFiscalPercentual = pct;
        }
      }

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

  const updatePagamento = (index, field, value) => {
    setForm((f) => {
      const pagamentos = [...(f.pagamentos || [])];
      pagamentos[index] = { ...pagamentos[index], [field]: value };
      if (field === 'forma' && !isCreditCardPayment(value, 1)) {
        pagamentos[index].parcelas = '1';
      }
      const updated = { ...f, pagamentos };
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
      const nfVal = calcNotaFiscalFromPercent(pagamentos, updated.notaFiscalPercentual);
      updated.valorNotaFiscal = nfVal > 0 ? String(nfVal) : '0';
      const autoHon = calcAutoHonorarios(updated);
      updated.honorariosMedicos = autoHon > 0 ? String(roundCurrency(autoHon)) : '0';
      return updated;
    });
  };

  const syncFluxoCaixaEntries = (detalheItem) => {
    if (!detalheItem || !detalheItem.id) return;
    const fluxoList = fluxoCaixa || [];

    // 1. Sync Taxa Clínica
    const valorTaxa = Number(detalheItem.taxaClinica || 0);
    const keyTaxa = `${detalheItem.id}_taxa`;
    const existingTaxa = fluxoList.find((f) => f.detalheId === keyTaxa || f.detalheId === detalheItem.id);
    const pacienteNome = detalheItem.paciente ? detalheItem.paciente.trim().toUpperCase() : '';

    const entryTaxa = {
      data: detalheItem.data,
      nome: `TAXA DE CLÍNICA — ${pacienteNome}`,
      tipo: 'entrada',
      categoria: 'Taxa de Clínica',
      valor: valorTaxa,
      detalheId: keyTaxa,
    };

    if (valorTaxa > 0) {
      if (existingTaxa) {
        updateItem(MODULES.fluxoCaixa, existingTaxa.id, entryTaxa);
      } else {
        addItem(MODULES.fluxoCaixa, entryTaxa);
      }
    } else if (existingTaxa) {
      deleteItem(MODULES.fluxoCaixa, existingTaxa.id);
    }

    // 2. Sync Valor de Acessórios
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
        updateItem(MODULES.fluxoCaixa, existingAcess.id, entryAcess);
      } else {
        addItem(MODULES.fluxoCaixa, entryAcess);
      }
    } else if (existingAcess) {
      deleteItem(MODULES.fluxoCaixa, existingAcess.id);
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
        updateItem(MODULES.fluxoCaixa, existingBiop.id, entryBiop);
      } else {
        addItem(MODULES.fluxoCaixa, entryBiop);
      }
    } else if (existingBiop) {
      deleteItem(MODULES.fluxoCaixa, existingBiop.id);
    }
  };

  const handleSave = (e) => {
    if (e) e.preventDefault();
    setSubmitted(true);

    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, verifique os campos obrigatórios destacados em vermelho.');
      return;
    }

    const pagamentos = (form.pagamentos || []).filter((p) => Number(p.valor) > 0);
    if (!form.data || !form.paciente || !form.tipoExame || !form.medico || pagamentos.length === 0) return;

    const sanitizedPagamentos = pagamentos.map((p) => ({
      forma: p.forma || 'Cartão de Crédito',
      valor: roundCurrency(p.valor),
      parcelas: Math.max(1, Number(p.parcelas) || 1),
    }));

    const totalPag = sanitizedPagamentos.reduce((s, p) => s + p.valor, 0);
    const totalParcelas = sanitizedPagamentos.reduce((s, p) => s + p.parcelas, 0);
    const formaLabel = sanitizedPagamentos.length === 1 ? sanitizedPagamentos[0].forma : 'Misto';

    const allowsCompl = examePermiteComplementar(form.tipoExame);
    const isFromConvenio = Boolean(
      editItem?.origemConvenioId ||
      editItem?.isConvenio ||
      form.origemConvenioId ||
      form.isConvenio
    );

    const sanitizedForm = {
      ...form,
      origemConvenioId: editItem?.origemConvenioId || form.origemConvenioId || undefined,
      isConvenio: isFromConvenio,
      manualOverride: isFromConvenio ? true : undefined,
      convenio: editItem?.convenio || form.convenio || undefined,
      paciente: form.paciente.trim().toUpperCase(),
      tipoExame: form.tipoExame.trim().toUpperCase(),
      procedimentoComplementar: allowsCompl ? formatProcedimentosComplementares(form.procedimentoComplementar) : '',
      medico: form.medico.trim().toUpperCase(),
      medico2: form.medico2 ? form.medico2.trim().toUpperCase() : '',
      pagamentos: sanitizedPagamentos,
      valorPagamento: roundCurrency(totalPag),
      numParcelas: String(totalParcelas),
      formaPagamento: formaLabel,
      valorRetidoTaxas: roundCurrency(form.valorRetidoTaxas),
      notaFiscalPercentual: form.notaFiscalPercentual !== '' ? Math.round(Number(form.notaFiscalPercentual) * 10) / 10 : 15,
      valorNotaFiscal: roundCurrency(form.valorNotaFiscal),
      valorAnestesista: roundCurrency(form.valorAnestesista),
      taxaClinica: roundCurrency(form.taxaClinica),
      valorAcessorios: roundCurrency(form.valorAcessorios),
      acessorioParaMedico: Boolean(form.acessorioParaMedico),
      valorBiopsia: roundCurrency(form.valorBiopsia),
      honorariosMedicos: roundCurrency(form.honorariosMedicos),
      valorMedico1: form.valorMedico1 ? roundCurrency(form.valorMedico1) : '',
      valorMedico2: form.valorMedico2 ? roundCurrency(form.valorMedico2) : '',
      porcentagemMedico1: form.porcentagemMedico1 !== '' ? Math.round(Number(form.porcentagemMedico1) * 100) / 100 : 50,
      porcentagemMedico2: form.porcentagemMedico2 !== '' ? Math.round(Number(form.porcentagemMedico2) * 100) / 100 : 50,
    };

    let savedItem;
    if (editItem) {
      savedItem = updateItem(MODULES.detalhesExames, editItem.id, sanitizedForm);
    } else {
      savedItem = addItem(MODULES.detalhesExames, sanitizedForm);
    }

    syncFluxoCaixaEntries(savedItem);

    // Se é um novo detalhe originado de um exame da lista simples
    if (!editItem && prefillData) {
      const matchingExames = exames.filter(
        (e) =>
          e.data === savedItem.data &&
          ((e.exame && e.exame.trim().toUpperCase() === savedItem.tipoExame.trim().toUpperCase()) ||
            (e.paciente && e.paciente.trim().toUpperCase() === savedItem.paciente.trim().toUpperCase()))
      );
      if (matchingExames.length > 0) {
        updateItem(MODULES.exames, matchingExames[0].id, {
          data: savedItem.data,
          paciente: savedItem.paciente,
          medico: savedItem.medico,
          exame: savedItem.tipoExame,
          procedimentoComplementar: savedItem.procedimentoComplementar || '',
        });
      }
    }

    if (editItem) {
      const matchingExames = exames.filter(
        (e) =>
          (e.detalheId && e.detalheId === savedItem.id) ||
          (e.data === editItem.data &&
            e.paciente &&
            e.paciente.trim().toUpperCase() === savedItem.paciente.trim().toUpperCase())
      );
      if (matchingExames.length > 0) {
        matchingExames.forEach((ex) => {
          updateItem(MODULES.exames, ex.id, {
            data: savedItem.data,
            paciente: savedItem.paciente,
            medico: savedItem.medico,
            exame: savedItem.tipoExame,
            procedimentoComplementar: savedItem.procedimentoComplementar || '',
          });
        });
      }
    }

    toast.success(editItem ? 'Detalhes do exame atualizados com sucesso!' : 'Detalhes do exame cadastrados com sucesso!');
    if (onSuccess) onSuccess(savedItem);
    onClose();
  };

  const totalPagamentos = (form.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalParcelasForm = (form.pagamentos || []).reduce(
    (s, p) => s + Math.max(1, Number(p.parcelas) || 1),
    0
  );

  const honorarioSchedule = form.data ? getHonorarioSchedule(form) : [];
  const totalHonForm = Number(form.honorariosMedicos || 0);
  let honDoc1Total = 0;
  let honDoc2Total = 0;

  if (form.temDivisao && form.medico2) {
    if (form.divisaoTipo === 'valor') {
      honDoc1Total = roundCurrency(Number(form.valorMedico1) || 0);
      honDoc2Total = roundCurrency(Number(form.valorMedico2) || 0);
    } else {
      const pct1 = parsePercentOrDefault(form.porcentagemMedico1, 50);
      const pct2 = parsePercentOrDefault(form.porcentagemMedico2, 50);
      honDoc1Total = roundCurrency((totalHonForm * pct1) / 100);
      honDoc2Total = roundCurrency((totalHonForm * pct2) / 100);
    }
  }

  return {
    form,
    setForm,
    updateField,
    updatePagamento,
    addPagamento,
    removePagamento,
    handleSave,
    handleRevertConvenio,
    validationErrors,
    hasError,
    markTouched,
    submitted,
    medicosOptions,
    examesOptions,
    totalPagamentos,
    totalParcelasForm,
    honorarioSchedule,
    honDoc1Total,
    honDoc2Total,
  };
}

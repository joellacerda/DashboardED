import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import {
  getTodayISO,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
} from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';
import { validateDate, validateRequired, validatePositiveNumber } from '../../utils/validation';
import { MODULES, getConvenioFluxoDestino } from '../../utils/storage';

export function useConvenioFluxoForm({ isOpen, item, onClose, onSuccess }) {
  const toast = useToast();
  const {
    fluxoCaixa: fluxoList = [],
    updateItem,
    syncConvenioToDetalhes,
    syncConveniosFluxoConsolidado,
    activeMedicosOptions,
  } = useData();

  const [fluxoPeriod, setFluxoPeriod] = useState(() => getAcquisitionPeriod());
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [fluxoForm, setFluxoForm] = useState({
    data: getTodayISO(),
    nome: '',
    categoria: 'Convênios / Repasses',
    tipo: 'entrada',
    valor: '',
    valorClinica: '',
    valorMedico: '',
    percentualMedico: 60,
    temDivisaoMedico2: false,
    medico2: '',
    porcentagemMedico1: 87.5,
    porcentagemMedico2: 12.5,
    modoPartilha: 'simples',
    valorTaxaSala: '',
    valorHonorariosBase: '',
    valorPolipectomia: '',
    valorAcessorio: '',
    pctPolipectomiaClinica: 50,
  });

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const dateErr = validateDate(fluxoForm.data, 'Data do recebimento');
    if (dateErr) errs.data = dateErr;

    const valorErr = validatePositiveNumber(fluxoForm.valor, 'Valor a lançar', false);
    if (valorErr) errs.valor = valorErr;

    const nomeErr = validateRequired(fluxoForm.nome, 'Descrição do lançamento');
    if (nomeErr) errs.nome = nomeErr;

    if (fluxoForm.temDivisaoMedico2) {
      const med2Err = validateRequired(fluxoForm.medico2, 'Segundo médico');
      if (med2Err) {
        errs.medico2 = med2Err;
      } else if (
        item &&
        item.medico &&
        item.medico.trim().toUpperCase() === (fluxoForm.medico2 || '').trim().toUpperCase()
      ) {
        errs.medico2 = 'O 2º médico deve ser diferente do médico realizante.';
      }
    }

    return errs;
  }, [fluxoForm, item]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const medicosOptions = activeMedicosOptions;
  const destinoFluxo = useMemo(() => getConvenioFluxoDestino(item?.convenio), [item?.convenio]);

  const currentConsolidatedEntry = useMemo(() => {
    if (!destinoFluxo.key || !fluxoPeriod.start) return null;
    return fluxoList.find(
      (f) =>
        (f.isConvenioConsolidado || (f.nome && f.nome.toUpperCase() === destinoFluxo.key)) &&
        (f.periodoStart === fluxoPeriod.start || isDateInPeriod(f.data, fluxoPeriod))
    );
  }, [destinoFluxo.key, fluxoPeriod, fluxoList]);

  const currentConsolidatedValor = currentConsolidatedEntry
    ? Number(currentConsolidatedEntry.valor || 0)
    : 0;

  useEffect(() => {
    if (!isOpen || !item) {
      setTouched({});
      setSubmitted(false);
      return;
    }

    setTouched({});
    setSubmitted(false);

    const initialValorClinica =
      item.valorClinica !== undefined && item.valorClinica !== null ? String(item.valorClinica) : '';
    const initialValorMedico =
      item.valorMedico !== undefined && item.valorMedico !== null ? String(item.valorMedico) : '';
    const initialPct =
      item.percentualMedico !== undefined && item.percentualMedico !== null
        ? Number(item.percentualMedico)
        : 60;

    const initialTemDivisao2 = Boolean(item.temDivisaoMedico2 || item.medico2);
    const initialMedico2 = item.medico2 || '';
    const initialPct1 =
      item.porcentagemMedico1 !== undefined && item.porcentagemMedico1 !== null
        ? Number(item.porcentagemMedico1)
        : 87.5;
    const initialPct2 =
      item.porcentagemMedico2 !== undefined && item.porcentagemMedico2 !== null
        ? Number(item.porcentagemMedico2)
        : 12.5;

    const initialValor =
      item.fluxoValorLancado !== undefined && item.fluxoValorLancado !== null
        ? String(item.fluxoValorLancado)
        : initialValorClinica;
    const initialData = item.fluxoData || getTodayISO();

    let initPeriod = getAcquisitionPeriod();
    if (item.fluxoData) {
      try {
        initPeriod = getAcquisitionPeriod(new Date(item.fluxoData.replace(/-/g, '/')));
      } catch {
        // fallback
      }
    }
    setFluxoPeriod(initPeriod);

    const hasPolipectomiaOrCompl = Boolean(
      item.modoPartilha === 'polipectomia' ||
        item.valorPolipectomia ||
        item.valorAcessorio ||
        item.valorTaxaSala ||
        item.valorHonorariosBase ||
        (item.procedimentoComplementar &&
          /polipectomia|mucosectomia/i.test(item.procedimentoComplementar))
    );

    const initialModo =
      item.modoPartilha || (hasPolipectomiaOrCompl ? 'polipectomia' : 'simples');
    const initialTaxaSala =
      item.valorTaxaSala !== undefined && item.valorTaxaSala !== null
        ? String(item.valorTaxaSala)
        : initialModo === 'polipectomia'
          ? initialValorClinica
          : '';
    const initialHonorariosBase =
      item.valorHonorariosBase !== undefined && item.valorHonorariosBase !== null
        ? String(item.valorHonorariosBase)
        : '';
    const initialValorPolipectomia =
      item.valorPolipectomia !== undefined && item.valorPolipectomia !== null
        ? String(item.valorPolipectomia)
        : '';
    const initialValorAcessorio =
      item.valorAcessorio !== undefined && item.valorAcessorio !== null
        ? String(item.valorAcessorio)
        : '';
    const initialPctPolip =
      item.pctPolipectomiaClinica !== undefined && item.pctPolipectomiaClinica !== null
        ? Number(item.pctPolipectomiaClinica)
        : 50;

    setFluxoForm({
      data: initialData,
      nome: destinoFluxo.display || 'COOPEND',
      categoria: 'Convênios / Repasses',
      tipo: 'entrada',
      valor: initialValor,
      valorClinica: initialValorClinica,
      valorMedico: initialValorMedico,
      percentualMedico: initialPct,
      temDivisaoMedico2: initialTemDivisao2,
      medico2: initialMedico2,
      porcentagemMedico1: initialPct1,
      porcentagemMedico2: initialPct2,
      modoPartilha: initialModo,
      valorTaxaSala: initialTaxaSala,
      valorHonorariosBase: initialHonorariosBase,
      valorPolipectomia: initialValorPolipectomia,
      valorAcessorio: initialValorAcessorio,
      pctPolipectomiaClinica: initialPctPolip,
    });
  }, [isOpen, item, destinoFluxo.display]);

  const handleNavigateFluxoPeriod = (direction) => {
    const nextPeriod = navigateAcquisitionPeriod(fluxoPeriod, direction);
    setFluxoPeriod(nextPeriod);
    const today = getTodayISO();
    if (isDateInPeriod(today, nextPeriod)) {
      setFluxoForm((prev) => ({ ...prev, data: today }));
    } else {
      setFluxoForm((prev) => ({ ...prev, data: nextPeriod.start }));
    }
  };

  const handleFluxoDateChange = (dateVal) => {
    setFluxoForm((prev) => ({ ...prev, data: dateVal }));
    if (dateVal) {
      try {
        const p = getAcquisitionPeriod(new Date(dateVal.replace(/-/g, '/')));
        if (p && p.start && p.end) {
          setFluxoPeriod(p);
        }
      } catch {
        // ignore invalid date parsing
      }
    }
  };

  const splitCalculations = useMemo(() => {
    const isPolipectomiaMode = fluxoForm.modoPartilha === 'polipectomia';

    let valClinicaNum = 0;
    let valMedicoNum = 0;
    let total = 0;
    let direitoClinica = 0;
    let totalHonorariosMedicos = 0;
    let pctMedicoTotal = 0;
    let pctClinica = 0;

    const taxaSalaNum = parseFloat(fluxoForm.valorTaxaSala) || 0;
    const honorariosBaseNum = parseFloat(fluxoForm.valorHonorariosBase) || 0;
    const polipectomiaNum = parseFloat(fluxoForm.valorPolipectomia) || 0;
    const acessorioNum = parseFloat(fluxoForm.valorAcessorio) || 0;
    const pctPolipClinica = Number(fluxoForm.pctPolipectomiaClinica ?? 50);
    const pctPolipMedico = Math.max(0, 100 - pctPolipClinica);

    const partePolipClinica = (polipectomiaNum * pctPolipClinica) / 100;
    const partePolipMedico = (polipectomiaNum * pctPolipMedico) / 100;
    const parteAcessorioClinica = acessorioNum;

    if (isPolipectomiaMode) {
      total = taxaSalaNum + honorariosBaseNum + polipectomiaNum + acessorioNum;
      valClinicaNum = taxaSalaNum;
      valMedicoNum = honorariosBaseNum + polipectomiaNum + acessorioNum;

      direitoClinica = taxaSalaNum + partePolipClinica + parteAcessorioClinica;
      totalHonorariosMedicos = honorariosBaseNum + partePolipMedico;

      pctMedicoTotal = total > 0 ? Math.round((totalHonorariosMedicos / total) * 100) : 0;
      pctClinica = total > 0 ? 100 - pctMedicoTotal : 0;
    } else {
      valClinicaNum = parseFloat(fluxoForm.valorClinica) || 0;
      valMedicoNum = parseFloat(fluxoForm.valorMedico) || 0;
      total = valClinicaNum + valMedicoNum;
      pctMedicoTotal = Number(fluxoForm.percentualMedico) || 0;
      pctClinica = Math.max(0, 100 - pctMedicoTotal);
      totalHonorariosMedicos = (total * pctMedicoTotal) / 100;
      direitoClinica = (total * pctClinica) / 100;
    }

    const temDivisao2 = Boolean(fluxoForm.temDivisaoMedico2);
    const pctMed1 = temDivisao2 ? Number(fluxoForm.porcentagemMedico1) || 0 : 100;
    const pctMed2 = temDivisao2 ? Number(fluxoForm.porcentagemMedico2) || 0 : 0;

    const direitoMedico1 = (totalHonorariosMedicos * pctMed1) / 100;
    const direitoMedico2 = temDivisao2 ? (totalHonorariosMedicos * pctMed2) / 100 : 0;

    const diferencaMedico1 = direitoMedico1 - valMedicoNum;
    const valorDevolverClinica = diferencaMedico1 < 0 ? Math.abs(diferencaMedico1) : 0;
    const repasseTotalMedicos = Math.max(0, diferencaMedico1) + direitoMedico2;

    return {
      isPolipectomiaMode,
      taxaSalaNum,
      honorariosBaseNum,
      polipectomiaNum,
      acessorioNum,
      pctPolipClinica,
      pctPolipMedico,
      partePolipClinica,
      partePolipMedico,
      parteAcessorioClinica,
      valClinicaNum,
      valMedicoNum,
      total,
      pctMedicoTotal,
      pctClinica,
      totalHonorariosMedicos,
      direitoClinica,
      temDivisao2,
      pctMed1,
      pctMed2,
      direitoMedico1,
      direitoMedico2,
      diferencaMedico1,
      valorDevolverClinica,
      repasseTotalMedicos,
    };
  }, [fluxoForm]);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(firstError || 'Por favor, preencha os campos destacados em vermelho.');
      return;
    }
    if (!item) return;
    const valorLancado = Number(fluxoForm.valor);
    const displayNome = destinoFluxo.display || 'COOPEND';

    const updatedItem = {
      ...item,
      valorClinica: splitCalculations.valClinicaNum,
      valorMedico: splitCalculations.valMedicoNum,
      percentualMedico: splitCalculations.pctMedicoTotal,
      modoPartilha: fluxoForm.modoPartilha,
      valorTaxaSala: fluxoForm.valorTaxaSala,
      valorHonorariosBase: fluxoForm.valorHonorariosBase,
      valorPolipectomia: fluxoForm.valorPolipectomia,
      valorAcessorio: fluxoForm.valorAcessorio,
      pctPolipectomiaClinica: fluxoForm.pctPolipectomiaClinica,
      valorCompensacaoClinica: splitCalculations.valorDevolverClinica,
      direitoClinica: splitCalculations.direitoClinica,
      direitoMedico: splitCalculations.totalHonorariosMedicos,
      temDivisaoMedico2: fluxoForm.temDivisaoMedico2,
      medico2: fluxoForm.temDivisaoMedico2 ? (fluxoForm.medico2 || '').trim().toUpperCase() : '',
      porcentagemMedico1: fluxoForm.temDivisaoMedico2 ? fluxoForm.porcentagemMedico1 : 100,
      porcentagemMedico2: fluxoForm.temDivisaoMedico2 ? fluxoForm.porcentagemMedico2 : 0,
      valorRepasseMedico1:
        splitCalculations.diferencaMedico1 > 0 ? splitCalculations.diferencaMedico1 : 0,
      valorRepasseMedico2:
        splitCalculations.direitoMedico2 > 0 ? splitCalculations.direitoMedico2 : 0,
      valorRepasse:
        splitCalculations.repasseTotalMedicos > 0 ? splitCalculations.repasseTotalMedicos : 0,
      fluxoLancado: true,
      fluxoValorLancado: valorLancado,
      fluxoData: fluxoForm.data,
      fluxoPeriodoLabel: fluxoPeriod.label,
      fluxoPeriodoStart: fluxoPeriod.start,
      fluxoPeriodoEnd: fluxoPeriod.end,
      fluxoNome: displayNome,
    };
    updateItem(MODULES.examesConvenio, item.id, updatedItem);
    syncConvenioToDetalhes(updatedItem);
    syncConveniosFluxoConsolidado();

    toast.success(`Partilha salva! Valor consolidado em "${displayNome}" no Fluxo de Caixa.`);
    if (onSuccess) onSuccess();
    onClose();
  };

  const handleDesvincularFluxo = () => {
    const updatedItem = {
      ...item,
      fluxoLancado: false,
      fluxoValorLancado: 0,
    };
    updateItem(MODULES.examesConvenio, item.id, updatedItem);
    syncConvenioToDetalhes(updatedItem);
    syncConveniosFluxoConsolidado();
    toast.success('Lançamento desvinculado do Fluxo de Caixa.');
    if (onSuccess) onSuccess();
    onClose();
  };

  return {
    fluxoPeriod,
    setFluxoPeriod,
    handleNavigateFluxoPeriod,
    handleFluxoDateChange,
    fluxoForm,
    setFluxoForm,
    touched,
    markTouched,
    submitted,
    validationErrors,
    hasError,
    medicosOptions,
    destinoFluxo,
    currentConsolidatedValor,
    splitCalculations,
    handleSave,
    handleDesvincularFluxo,
  };
}

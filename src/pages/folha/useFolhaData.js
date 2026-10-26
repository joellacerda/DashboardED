import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { getItem, MODULES } from '../../utils/storage';
import {
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  getTodayISO,
} from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';
import { validateRequired, validatePositiveNumber } from '../../utils/validation';

export const emptyForm = {
  nome: '',
  cargo: '',
  salarioBase: '',
  valeAlimentacao: '',
  valeTransporte: '',
  extras: '',
  descontos: '',
  produtividade: '',
};

export function calcLiquido(f) {
  return (
    Number(f.salarioBase || 0) +
    Number(f.valeAlimentacao || 0) +
    Number(f.valeTransporte || 0) +
    Number(f.extras || 0) +
    Number(f.produtividade || 0) -
    Number(f.descontos || 0)
  );
}

export function useFolhaData() {
  const toast = useToast();
  const {
    folhaPagamento: data = [],
    fluxoCaixa = [],
    addItem,
    updateItem,
    deleteItem,
    setData: setModuleData,
  } = useData();

  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const markTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validationErrors = useMemo(() => {
    const errs = {};
    const nomeErr = validateRequired(form.nome, 'Nome do colaborador');
    if (nomeErr) errs.nome = nomeErr;

    const salErr = validatePositiveNumber(form.salarioBase, 'Salário Base', true);
    if (salErr) errs.salarioBase = salErr;

    return errs;
  }, [form]);

  const hasError = (field) => Boolean((submitted || touched[field]) && validationErrors[field]);

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  useEffect(() => {
    setCurrentPage(1);
  }, [period, search]);

  // Resolve employees for the current selected acquisition period
  const resolvedEmployees = useMemo(() => {
    return data
      .filter((emp) => {
        if (emp.ativo === false && !emp.periodos?.[period.start]) return false;
        return true;
      })
      .map((emp) => {
        const periodData = emp.periodos?.[period.start];
        const isLegacyCurrent = !emp.periodos && isCurrentPeriod;

        const salarioBase = Number(periodData?.salarioBase ?? emp.salarioBase ?? 0);
        const valeAlimentacao = Number(
          periodData?.valeAlimentacao ?? (isLegacyCurrent ? emp.valeAlimentacao : 0) ?? 0
        );
        const valeTransporte = Number(
          periodData?.valeTransporte ?? (isLegacyCurrent ? emp.valeTransporte : 0) ?? 0
        );
        const extras = Number(
          periodData?.extras ?? (isLegacyCurrent ? emp.extras : 0) ?? 0
        );
        const descontos = Number(
          periodData?.descontos ?? (isLegacyCurrent ? emp.descontos : 0) ?? 0
        );
        const produtividade = Number(
          periodData?.produtividade ?? (isLegacyCurrent ? emp.produtividade : 0) ?? 0
        );

        const liquido = calcLiquido({
          salarioBase,
          valeAlimentacao,
          valeTransporte,
          extras,
          descontos,
          produtividade,
        });

        return {
          ...emp,
          salarioBase,
          valeAlimentacao,
          valeTransporte,
          extras,
          descontos,
          produtividade,
          liquido,
        };
      });
  }, [data, period, isCurrentPeriod]);

  const filtered = useMemo(() => {
    let items = resolvedEmployees;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          (e.nome || '').toLowerCase().includes(q) ||
          (e.cargo || '').toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [resolvedEmployees, search]);

  const totalFolha = filtered.reduce((s, f) => s + f.liquido, 0);
  const totalBase = filtered.reduce((s, f) => s + f.salarioBase, 0);
  const totalBeneficios = filtered.reduce((s, f) => s + f.valeAlimentacao + f.valeTransporte, 0);
  const totalVariaveis = filtered.reduce((s, f) => s + f.extras + f.produtividade, 0);
  const totalDescontos = filtered.reduce((s, f) => s + f.descontos, 0);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filtered.slice(startIndex, startIndex + pageSize),
    [filtered, startIndex, pageSize]
  );

  const folhaLancamentoNoCaixa = useMemo(() => {
    return fluxoCaixa.find(
      (f) =>
        f.folhaPeriodoStart === period.start ||
        (f.categoria === 'Folha de Pagamento / Pessoal' && (f.nome || '').includes(period.label))
    );
  }, [fluxoCaixa, period]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({
      nome: item.nome || '',
      cargo: item.cargo || '',
      salarioBase:
        item.salarioBase !== undefined && item.salarioBase !== null ? item.salarioBase : '',
      valeAlimentacao:
        item.valeAlimentacao !== undefined && item.valeAlimentacao !== null
          ? item.valeAlimentacao
          : '',
      valeTransporte:
        item.valeTransporte !== undefined && item.valeTransporte !== null
          ? item.valeTransporte
          : '',
      extras: item.extras !== undefined && item.extras !== null ? item.extras : '',
      descontos: item.descontos !== undefined && item.descontos !== null ? item.descontos : '',
      produtividade:
        item.produtividade !== undefined && item.produtividade !== null ? item.produtividade : '',
    });
    setTouched({});
    setSubmitted(false);
    setModalOpen(true);
  };

  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitted(true);

    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.warning(
        firstError || 'Por favor, preencha os campos obrigatórios destacados em vermelho.'
      );
      return;
    }

    const nomeTrimmed = (form.nome || '').trim().toUpperCase();
    if (!nomeTrimmed) {
      toast.warning('O nome do colaborador é obrigatório.');
      return;
    }

    if (form.salarioBase === '' || form.salarioBase === null || form.salarioBase === undefined) {
      toast.warning('O Salário Base é obrigatório.');
      return;
    }

    const salarioBaseNum = Number(form.salarioBase);
    if (isNaN(salarioBaseNum) || salarioBaseNum < 0) {
      toast.warning('Informe um salário base válido maior ou igual a zero.');
      return;
    }

    const baseVA = Number(form.valeAlimentacao || 0);
    const baseVT = Number(form.valeTransporte || 0);
    const baseExtras = Number(form.extras || 0);
    const baseDescontos = Number(form.descontos || 0);
    const baseProd = Number(form.produtividade || 0);

    const periodEntry = {
      salarioBase: salarioBaseNum,
      valeAlimentacao: baseVA,
      valeTransporte: baseVT,
      extras: baseExtras,
      descontos: baseDescontos,
      produtividade: baseProd,
      updatedAt: new Date().toISOString(),
    };

    const employeeBase = {
      nome: nomeTrimmed,
      cargo: form.cargo ? form.cargo.trim().toUpperCase() : '',
      salarioBase: salarioBaseNum,
    };

    if (editId) {
      const existing =
        data.find((emp) => String(emp.id) === String(editId)) ||
        getItem(MODULES.folhaPagamento, editId) ||
        {};

      const updatedPeriodos = {
        ...(existing.periodos || {}),
        [period.start]: periodEntry,
      };

      const updatedEmployee = {
        ...existing,
        ...employeeBase,
        periodos: updatedPeriodos,
      };

      updateItem(MODULES.folhaPagamento, editId, updatedEmployee);
      toast.success(`Alterações de ${nomeTrimmed} salvas com sucesso!`);
    } else {
      const newEmployee = {
        ...employeeBase,
        ativo: true,
        periodos: {
          [period.start]: periodEntry,
        },
      };

      addItem(MODULES.folhaPagamento, newEmployee);
      toast.success(`Colaborador ${nomeTrimmed} cadastrado com sucesso!`);
    }

    setModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteItem(MODULES.folhaPagamento, deleteId);
      toast.success('Colaborador removido da folha.');
    }
  };

  const handleCopyFromPrevious = () => {
    const prevPeriod = navigateAcquisitionPeriod(period, -1);
    let copiedCount = 0;

    const updatedData = data.map((emp) => {
      if (emp.ativo === false) return emp;
      const prevEntry = emp.periodos?.[prevPeriod.start];
      if (prevEntry) {
        copiedCount++;
        return {
          ...emp,
          periodos: {
            ...(emp.periodos || {}),
            [period.start]: {
              ...prevEntry,
              copiedFrom: prevPeriod.start,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }
      return emp;
    });

    if (copiedCount === 0) {
      toast.info(
        `Nenhum lançamento personalizado encontrado no período anterior (${prevPeriod.label}).`
      );
      return;
    }

    setModuleData('folhaPagamento', updatedData);
    updatedData.forEach((emp) => updateItem(MODULES.folhaPagamento, emp.id, emp));
    toast.success(`Lançamentos de ${copiedCount} colaborador(es) copiados do período anterior!`);
  };

  const handleLancarFluxo = () => {
    if (totalFolha <= 0) {
      toast.warning('O valor total líquido da folha deve ser maior que zero.');
      return;
    }

    const descricao = `FOLHA DE PAGAMENTO — ${period.label}`;

    if (folhaLancamentoNoCaixa) {
      updateItem(MODULES.fluxoCaixa, folhaLancamentoNoCaixa.id, {
        valor: totalFolha,
        nome: descricao,
        data: folhaLancamentoNoCaixa.data || getTodayISO(),
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Lançamento no Fluxo de Caixa atualizado para ${formatCurrency(totalFolha)}!`);
    } else {
      addItem(MODULES.fluxoCaixa, {
        data: getTodayISO(),
        nome: descricao,
        categoria: 'Folha de Pagamento / Pessoal',
        tipo: 'saida',
        valor: totalFolha,
        folhaPeriodoStart: period.start,
      });
      toast.success(`Folha de ${formatCurrency(totalFolha)} lançada com sucesso no Fluxo de Caixa!`);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return {
    period,
    setPeriod,
    currentPeriod,
    isCurrentPeriod,
    search,
    setSearch,
    filtered,
    paginatedItems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    safeCurrentPage,
    totalFolha,
    totalBase,
    totalBeneficios,
    totalVariaveis,
    totalDescontos,
    folhaLancamentoNoCaixa,
    handleLancarFluxo,
    handleCopyFromPrevious,
    modalOpen,
    setModalOpen,
    editId,
    form,
    updateField,
    touched,
    markTouched,
    submitted,
    validationErrors,
    hasError,
    openNew,
    openEdit,
    handleSave,
    deleteId,
    setDeleteId,
    handleDelete,
  };
}

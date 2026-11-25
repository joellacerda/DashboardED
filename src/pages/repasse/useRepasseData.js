import { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import {
  formatCurrency,
  getAcquisitionPeriod,
} from '../../utils/helpers';
import { calculateAllDoctorsRepasseInPeriod } from '../../utils/repasseCalculation';
import { useToast } from '../../contexts/ToastContext';
import { MODULES } from '../../utils/storage';

export function useRepasseData() {
  const toast = useToast();
  const {
    medicos: medicosList = [],
    repassesAjustes: ajustesList = [],
    detalhesExames = [],
    examesConvenio = [],
    exames = [],
    fluxoCaixa = [],
    addItem,
    updateItem,
    deleteItem,
  } = useData();

  const [period, setPeriod] = useState(() => getAcquisitionPeriod());

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  const [editAjusteModal, setEditAjusteModal] = useState(false);
  const [selectedMedico, setSelectedMedico] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [ajusteForm, setAjusteForm] = useState({ creditos: '', debitos: '', bnb: '', obs: '', isSocio: true });
  const [viewingObs, setViewingObs] = useState(null);
  const [viewingCompensacao, setViewingCompensacao] = useState(null);

  const [manageMedicosModal, setManageMedicosModal] = useState(false);
  const [newMedicoNome, setNewMedicoNome] = useState('');
  const [newMedicoSocio, setNewMedicoSocio] = useState(true);
  const [deleteMedicoId, setDeleteMedicoId] = useState(null);

  const repasseCalc = useMemo(
    () =>
      calculateAllDoctorsRepasseInPeriod(period, {
        medicos: medicosList,
        repassesAjustes: ajustesList,
        detalhesExames,
        examesConvenio,
        exames,
        fluxoCaixa,
      }),
    [period, medicosList, ajustesList, detalhesExames, examesConvenio, exames, fluxoCaixa]
  );

  const { allDoctors, deficitClinica, countSocios, cotaPorSocio, rows } = repasseCalc;

  // Build Repasse Table Row Items
  const repasseRows = useMemo(() => {
    return rows.filter(
      (row) =>
        (row.isSocio && row.isActive) ||
        row.honorarios > 0 ||
        row.creditos > 0 ||
        row.debitos > 0 ||
        row.compensacaoConvenios > 0 ||
        row.bnb > 0 ||
        row.obs
    );
  }, [rows]);

  // Summary Totals (single memoized pass)
  const {
    totalHonorariosRepassados,
    totalCreditos,
    totalDebitos,
    totalCompensacoesGeral,
    totalBNB,
    totalCotaClinica,
    totalLiquidoGeral,
  } = useMemo(() => {
    return repasseRows.reduce(
      (acc, r) => {
        acc.totalHonorariosRepassados += r.honorarios;
        acc.totalCreditos += r.creditos;
        acc.totalDebitos += r.debitos;
        acc.totalCompensacoesGeral += r.compensacaoConvenios;
        acc.totalBNB += r.bnb;
        acc.totalCotaClinica += r.cotaClinica;
        acc.totalLiquidoGeral += r.total;
        return acc;
      },
      {
        totalHonorariosRepassados: 0,
        totalCreditos: 0,
        totalDebitos: 0,
        totalCompensacoesGeral: 0,
        totalBNB: 0,
        totalCotaClinica: 0,
        totalLiquidoGeral: 0,
      }
    );
  }, [repasseRows]);

  const openEditAjuste = (row) => {
    setSelectedMedico(row.medico);
    setSelectedRow(row);
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
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedMedico) return;

    const creditosNum = ajusteForm.creditos === '' ? 0 : Number(ajusteForm.creditos);
    const debitosNum = ajusteForm.debitos === '' ? 0 : Number(ajusteForm.debitos);
    const bnbNum = ajusteForm.bnb === '' ? 0 : Number(ajusteForm.bnb);

    if (
      !Number.isFinite(creditosNum) || creditosNum < 0 ||
      !Number.isFinite(debitosNum) || debitosNum < 0 ||
      !Number.isFinite(bnbNum) || bnbNum < 0
    ) {
      toast.warning('Créditos, Débitos e BNB devem ser valores numéricos maiores ou iguais a zero.');
      return;
    }

    const existingMedico = (medicosList || []).find(
      (m) => m.nome && m.nome.trim().toLowerCase() === selectedMedico.nome.trim().toLowerCase()
    );

    let medicoId = existingMedico?.id || null;
    if (existingMedico) {
      if (Boolean(existingMedico.socio !== false) !== Boolean(ajusteForm.isSocio)) {
        updateItem(MODULES.medicos, existingMedico.id, { socio: ajusteForm.isSocio });
      }
    } else {
      const created = addItem(MODULES.medicos, {
        nome: selectedMedico.nome.trim().toUpperCase(),
        socio: ajusteForm.isSocio,
        ativo: true,
      });
      medicoId = created?.id || null;
    }

    const key = `${selectedMedico.nome.trim().toLowerCase()}_${period.start}`;
    const existingAjuste = (ajustesList || []).find(
      (a) => a.key === key || (medicoId && a.medicoId === medicoId && a.periodStart === period.start)
    );

    const ajusteData = {
      key,
      medicoId,
      medicoNome: selectedMedico.nome.trim().toUpperCase(),
      periodStart: period.start,
      periodEnd: period.end,
      creditos: creditosNum,
      debitos: debitosNum,
      bnb: bnbNum,
      obs: ajusteForm.obs || '',
    };

    if (existingAjuste) {
      updateItem(MODULES.repassesAjustes, existingAjuste.id, ajusteData);
    } else {
      addItem(MODULES.repassesAjustes, ajusteData);
    }

    setEditAjusteModal(false);
    toast.success('Ajustes de repasse salvos com sucesso!');
  };

  const persistDoctorsGroupOrder = (orderedGroup) => {
    if (!Array.isArray(orderedGroup)) return;
    const currentMedicos = medicosList || [];

    orderedGroup.forEach((doc, idx) => {
      const nextOrdem = idx + 1;
      const docNameUpper = (doc.nome || '').trim().toUpperCase();
      const existing = currentMedicos.find(
        (m) =>
          (doc.id && !doc.auto && String(m.id) === String(doc.id)) ||
          (m.nome && m.nome.trim().toUpperCase() === docNameUpper)
      );

      if (existing) {
        if (Number(existing.ordem) !== nextOrdem) {
          updateItem(MODULES.medicos, existing.id, { ordem: nextOrdem });
        }
      } else if (docNameUpper) {
        addItem(MODULES.medicos, {
          nome: docNameUpper,
          socio: doc.socio !== false,
          ativo: doc.ativo !== false,
          ordem: nextOrdem,
        });
      }
    });
  };

  const handleAddMedico = (e) => {
    e.preventDefault();
    if (!newMedicoNome.trim()) return;

    const currentMedicos = medicosList || [];
    const nomeUpper = newMedicoNome.trim().toUpperCase();
    const activeCount = allDoctors.filter((m) => m.ativo !== false).length;
    const existing = currentMedicos.find((m) => m.nome.trim().toUpperCase() === nomeUpper);
    if (existing) {
      if (existing.ativo === false) {
        updateItem(MODULES.medicos, existing.id, {
          ativo: true,
          socio: newMedicoSocio,
          ordem: activeCount + 1,
        });
        setNewMedicoNome('');
        toast.success('Médico reativado com sucesso!');
        return;
      }
      toast.warning('Médico já cadastrado!');
      return;
    }

    addItem(MODULES.medicos, {
      nome: nomeUpper,
      socio: newMedicoSocio,
      ativo: true,
      ordem: activeCount + 1,
    });
    setNewMedicoNome('');
    toast.success('Médico adicionado com sucesso!');
  };

  const handleDeleteMedico = () => {
    if (deleteMedicoId) {
      deleteItem(MODULES.medicos, deleteMedicoId);
      toast.success('Médico removido com sucesso.');
    }
  };

  const toggleMedicoSocio = (medico) => {
    const currentMedicos = medicosList || [];
    const index = currentMedicos.findIndex(
      (m) => (medico.id && m.id === medico.id) || m.nome.trim().toUpperCase() === medico.nome.trim().toUpperCase()
    );
    if (index !== -1) {
      const currentlySocio = currentMedicos[index].socio !== false;
      updateItem(MODULES.medicos, currentMedicos[index].id, { socio: !currentlySocio });
    } else {
      addItem(MODULES.medicos, {
        nome: medico.nome.trim().toUpperCase(),
        socio: !(medico.socio !== false),
        ativo: medico.ativo !== false,
      });
    }
  };

  const toggleMedicoAtivo = (medico) => {
    const currentMedicos = medicosList || [];
    const index = currentMedicos.findIndex(
      (m) => (medico.id && m.id === medico.id) || m.nome.trim().toUpperCase() === medico.nome.trim().toUpperCase()
    );
    const isCurrentlyActive = medico.ativo !== false;
    const nextAtivo = !isCurrentlyActive;
    const targetGroupCount = allDoctors.filter((m) => (m.ativo !== false) === nextAtivo).length;

    if (index !== -1) {
      updateItem(MODULES.medicos, currentMedicos[index].id, {
        ativo: nextAtivo,
        ordem: targetGroupCount + 1,
      });
    } else {
      addItem(MODULES.medicos, {
        nome: medico.nome.trim().toUpperCase(),
        socio: medico.socio !== false,
        ativo: nextAtivo,
        ordem: targetGroupCount + 1,
      });
    }
  };

  const moveMedico = (medico, direction) => {
    if (!medico || !direction) return;
    const isGroupActive = medico.ativo !== false;
    const group = allDoctors.filter((m) => (m.ativo !== false) === isGroupActive);
    const currentIndex = group.findIndex(
      (m) => m.nome.trim().toUpperCase() === medico.nome.trim().toUpperCase()
    );
    const targetIndex = currentIndex + direction;
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= group.length) return;

    const updatedGroup = [...group];
    const [moved] = updatedGroup.splice(currentIndex, 1);
    updatedGroup.splice(targetIndex, 0, moved);
    persistDoctorsGroupOrder(updatedGroup);
  };

  const reorderMedicos = (fromMedico, toMedico) => {
    if (!fromMedico || !toMedico) return;
    const isGroupActive = fromMedico.ativo !== false;
    if ((toMedico.ativo !== false) !== isGroupActive) return;

    const group = allDoctors.filter((m) => (m.ativo !== false) === isGroupActive);
    const fromIndex = group.findIndex(
      (m) => m.nome.trim().toUpperCase() === fromMedico.nome.trim().toUpperCase()
    );
    const toIndex = group.findIndex(
      (m) => m.nome.trim().toUpperCase() === toMedico.nome.trim().toUpperCase()
    );
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const updatedGroup = [...group];
    const [moved] = updatedGroup.splice(fromIndex, 1);
    updatedGroup.splice(toIndex, 0, moved);
    persistDoctorsGroupOrder(updatedGroup);
  };

  const exportColumns = [
    { key: 'nome', label: 'Médico', accessor: (r) => `${r.nome}${r.isSocio ? ' (Sócio)' : ''}` },
    { key: 'honorarios', label: 'Honorários', accessor: (r) => formatCurrency(r.honorarios) },
    { key: 'creditos', label: 'Créditos', accessor: (r) => formatCurrency(r.creditos) },
    { key: 'debitos', label: 'Débitos', accessor: (r) => (r.debitos > 0 ? `-${formatCurrency(r.debitos)}` : 'R$ 0,00') },
    { key: 'compensacaoConvenios', label: 'Compensações', accessor: (r) => (r.compensacaoConvenios > 0 ? `-${formatCurrency(r.compensacaoConvenios)}` : 'R$ 0,00') },
    { key: 'bnb', label: 'BNB', accessor: (r) => (r.bnb > 0 ? `-${formatCurrency(r.bnb)}` : 'R$ 0,00') },
    { key: 'cotaClinica', label: 'Cota Clínica', accessor: (r) => (r.cotaClinica > 0 ? `-${formatCurrency(r.cotaClinica)}` : 'R$ 0,00') },
    { key: 'total', label: 'Total Repasse', accessor: (r) => (r.total >= 0 ? formatCurrency(r.total) : `-${formatCurrency(Math.abs(r.total))}`) },
    { key: 'obs', label: 'OBS' },
  ];

  return {
    period,
    setPeriod,
    currentPeriod,
    isCurrentPeriod,
    deficitClinica,
    countSocios,
    cotaPorSocio,
    allDoctors,
    repasseRows,
    totalHonorariosRepassados,
    totalCreditos,
    totalDebitos,
    totalCompensacoesGeral,
    totalBNB,
    totalCotaClinica,
    totalLiquidoGeral,
    exportColumns,
    editAjusteModal,
    setEditAjusteModal,
    selectedMedico,
    selectedRow,
    ajusteForm,
    setAjusteForm,
    openEditAjuste,
    handleSaveAjuste,
    viewingObs,
    setViewingObs,
    viewingCompensacao,
    setViewingCompensacao,
    manageMedicosModal,
    setManageMedicosModal,
    newMedicoNome,
    setNewMedicoNome,
    newMedicoSocio,
    setNewMedicoSocio,
    deleteMedicoId,
    setDeleteMedicoId,
    handleAddMedico,
    handleDeleteMedico,
    toggleMedicoSocio,
    toggleMedicoAtivo,
    moveMedico,
    reorderMedicos,
  };
}

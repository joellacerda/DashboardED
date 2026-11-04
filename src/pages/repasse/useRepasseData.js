import { useState, useMemo, useEffect } from 'react';
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
    syncAllConveniosToDetalhes,
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

  useEffect(() => {
    syncAllConveniosToDetalhes();
  }, [syncAllConveniosToDetalhes]);

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

  // Summary Totals
  const totalHonorariosRepassados = repasseRows.reduce((s, r) => s + r.honorarios, 0);
  const totalCreditos = repasseRows.reduce((s, r) => s + r.creditos, 0);
  const totalDebitos = repasseRows.reduce((s, r) => s + r.debitos, 0);
  const totalCompensacoesGeral = repasseRows.reduce((s, r) => s + r.compensacaoConvenios, 0);
  const totalBNB = repasseRows.reduce((s, r) => s + r.bnb, 0);
  const totalCotaClinica = repasseRows.reduce((s, r) => s + r.cotaClinica, 0);
  const totalLiquidoGeral = repasseRows.reduce((s, r) => s + r.total, 0);

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
    e.preventDefault();
    if (!selectedMedico) return;

    const existingMedico = (medicosList || []).find(
      (m) => m.nome && m.nome.trim().toLowerCase() === selectedMedico.nome.trim().toLowerCase()
    );

    if (existingMedico) {
      if (Boolean(existingMedico.socio !== false) !== Boolean(ajusteForm.isSocio)) {
        updateItem(MODULES.medicos, existingMedico.id, { socio: ajusteForm.isSocio });
      }
    } else {
      addItem(MODULES.medicos, {
        nome: selectedMedico.nome.trim().toUpperCase(),
        socio: ajusteForm.isSocio,
        ativo: true,
      });
    }

    const key = `${selectedMedico.nome.trim().toLowerCase()}_${period.start}`;
    const existingAjuste = (ajustesList || []).find((a) => a.key === key);

    const ajusteData = {
      key,
      medicoNome: selectedMedico.nome.trim().toUpperCase(),
      periodStart: period.start,
      periodEnd: period.end,
      creditos: ajusteForm.creditos,
      debitos: ajusteForm.debitos,
      bnb: ajusteForm.bnb,
      obs: ajusteForm.obs,
    };

    if (existingAjuste) {
      updateItem(MODULES.repassesAjustes, existingAjuste.id, ajusteData);
    } else {
      addItem(MODULES.repassesAjustes, ajusteData);
    }

    setEditAjusteModal(false);
    toast.success('Ajustes de repasse salvos com sucesso!');
  };

  const handleAddMedico = (e) => {
    e.preventDefault();
    if (!newMedicoNome.trim()) return;

    const currentMedicos = medicosList || [];
    const nomeUpper = newMedicoNome.trim().toUpperCase();
    const existing = currentMedicos.find((m) => m.nome.trim().toUpperCase() === nomeUpper);
    if (existing) {
      if (existing.ativo === false) {
        updateItem(MODULES.medicos, existing.id, { ativo: true, socio: newMedicoSocio });
        setNewMedicoNome('');
        toast.success('Médico reativado com sucesso!');
        return;
      }
      toast.warning('Médico já cadastrado!');
      return;
    }

    addItem(MODULES.medicos, { nome: nomeUpper, socio: newMedicoSocio, ativo: true });
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
      updateItem(MODULES.medicos, currentMedicos[index].id, { socio: !currentMedicos[index].socio });
    } else {
      addItem(MODULES.medicos, {
        nome: medico.nome.trim().toUpperCase(),
        socio: !medico.socio,
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
    if (index !== -1) {
      updateItem(MODULES.medicos, currentMedicos[index].id, { ativo: !isCurrentlyActive });
    } else {
      addItem(MODULES.medicos, {
        nome: medico.nome.trim().toUpperCase(),
        socio: medico.socio !== false,
        ativo: !isCurrentlyActive,
      });
    }
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
  };
}

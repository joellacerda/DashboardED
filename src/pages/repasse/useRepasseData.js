import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import {
  formatCurrency,
  getAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioMedicoInPeriod,
  getDoctorCompensacaoInPeriod,
} from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';
import { MODULES } from '../../utils/storage';

export function useRepasseData() {
  const toast = useToast();
  const {
    medicos: medicosList = [],
    repassesAjustes: ajustesList = [],
    detalhesExames = [],
    examesConvenio = [],
    fluxoCaixa = [],
    addItem,
    updateItem,
    deleteItem,
    setData,
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

  // Calculate Clinic Deficit for current period
  const periodFluxo = useMemo(
    () => fluxoCaixa.filter((f) => isDateInPeriod(f.data, period)),
    [fluxoCaixa, period]
  );

  const totalEntradasFluxo = useMemo(
    () => periodFluxo.filter((f) => f.tipo === 'entrada').reduce((s, f) => s + Number(f.valor || 0), 0),
    [periodFluxo]
  );

  const totalSaidasFluxo = useMemo(
    () => periodFluxo.filter((f) => f.tipo === 'saida').reduce((s, f) => s + Number(f.valor || 0), 0),
    [periodFluxo]
  );

  const deficitClinica = Math.max(0, totalSaidasFluxo - totalEntradasFluxo);

  // Merge registered doctors with doctors found in exam records
  const allDoctors = useMemo(() => {
    const list = medicosList.map((m) => ({
      ...m,
      nome: m.nome.trim().toUpperCase(),
      ativo: m.ativo !== false,
    }));
    const registeredNames = new Set(list.map((m) => m.nome.trim().toUpperCase()));

    detalhesExames.forEach((e) => {
      if (e.medico && !registeredNames.has(e.medico.trim().toUpperCase())) {
        registeredNames.add(e.medico.trim().toUpperCase());
        list.push({ id: `auto_${e.medico.trim().toUpperCase()}`, nome: e.medico.trim().toUpperCase(), socio: true, auto: true, ativo: true });
      }
      if (e.medico2 && !registeredNames.has(e.medico2.trim().toUpperCase())) {
        registeredNames.add(e.medico2.trim().toUpperCase());
        list.push({ id: `auto_${e.medico2.trim().toUpperCase()}`, nome: e.medico2.trim().toUpperCase(), socio: true, auto: true, ativo: true });
      }
    });

    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [medicosList, detalhesExames]);

  // Count active partner doctors (sócios)
  const countSocios = useMemo(
    () => allDoctors.filter((m) => m.socio !== false && m.ativo !== false).length,
    [allDoctors]
  );

  const cotaPorSocio = countSocios > 0 && deficitClinica > 0 ? deficitClinica / countSocios : 0;

  // Build Repasse Table Row Items
  const repasseRows = useMemo(() => {
    return allDoctors
      .map((medico) => {
        const isSocio = medico.socio !== false;
        const isActive = medico.ativo !== false;

        const honorarios = detalhesExames.reduce((sum, exam) => {
          return sum + getHonorarioMedicoInPeriod(exam, medico.nome, period);
        }, 0);

        const compensacaoInfo = getDoctorCompensacaoInPeriod(medico.nome, period, examesConvenio);
        const compensacaoConvenios = compensacaoInfo.total;

        const key = `${medico.nome.trim().toLowerCase()}_${period.start}`;
        const ajuste = ajustesList.find((a) => a.key === key) || {};

        const creditos = Number(ajuste.creditos) || 0;
        const debitos = Number(ajuste.debitos) || 0;
        const bnb = Number(ajuste.bnb) || 0;
        const obs = ajuste.obs || '';

        const cotaClinica = isSocio && isActive ? cotaPorSocio : 0;
        const total = honorarios + creditos - debitos - compensacaoConvenios - bnb - cotaClinica;

        return {
          medico,
          nome: medico.nome,
          isSocio,
          isActive,
          honorarios,
          creditos,
          debitos,
          compensacaoConvenios,
          compensacaoCount: compensacaoInfo.count,
          compensacaoItems: compensacaoInfo.items,
          bnb,
          cotaClinica,
          total,
          obs,
          ajusteId: ajuste.id,
          key,
        };
      })
      .filter((row) => (row.isSocio && row.isActive) || row.honorarios > 0 || row.creditos > 0 || row.debitos > 0 || row.compensacaoConvenios > 0 || row.bnb > 0 || row.obs);
  }, [allDoctors, detalhesExames, examesConvenio, period, ajustesList, cotaPorSocio]);

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

    const currentMedicos = [...medicosList];
    const existingIndex = currentMedicos.findIndex(
      (m) => m.nome.trim().toLowerCase() === selectedMedico.nome.trim().toLowerCase()
    );

    if (existingIndex !== -1) {
      currentMedicos[existingIndex] = { ...currentMedicos[existingIndex], socio: ajusteForm.isSocio };
      setData(MODULES.medicos, currentMedicos);
    } else {
      currentMedicos.push({
        id: crypto.randomUUID(),
        nome: selectedMedico.nome,
        socio: ajusteForm.isSocio,
      });
      setData(MODULES.medicos, currentMedicos);
    }

    const key = `${selectedMedico.nome.trim().toLowerCase()}_${period.start}`;
    const currentAjustes = [...ajustesList];
    const ajusteIndex = currentAjustes.findIndex((a) => a.key === key);

    const ajusteData = {
      key,
      medicoNome: selectedMedico.nome,
      periodStart: period.start,
      periodEnd: period.end,
      creditos: ajusteForm.creditos,
      debitos: ajusteForm.debitos,
      bnb: ajusteForm.bnb,
      obs: ajusteForm.obs,
    };

    if (ajusteIndex !== -1) {
      currentAjustes[ajusteIndex] = { ...currentAjustes[ajusteIndex], ...ajusteData };
    } else {
      currentAjustes.push({ id: crypto.randomUUID(), ...ajusteData });
    }

    setData(MODULES.repassesAjustes, currentAjustes);
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

import PeriodSelector from '../components/PeriodSelector';
import { useRepasseData } from './repasse/useRepasseData';
import RepasseSummaryCards from './repasse/RepasseSummaryCards';
import RepasseTable from './repasse/RepasseTable';
import RepasseObsModal from './repasse/RepasseObsModal';
import RepasseCompensacaoModal from './repasse/RepasseCompensacaoModal';
import RepasseAjusteModal from './repasse/RepasseAjusteModal';
import ManageMedicosModal from './repasse/ManageMedicosModal';

export default function RepassePage({ onNavigateToDoctor = null }) {
  const {
    period,
    setPeriod,
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
  } = useRepasseData();

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Repasses Médicos</h1>
        <div className="header-actions">
          <PeriodSelector period={period} onChange={setPeriod} isCurrentPeriod={isCurrentPeriod} />
          <button className="btn btn-secondary" onClick={() => setManageMedicosModal(true)}>
            ⚙️ Gerenciar Médicos & Sócios
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* KPI Summary Cards */}
        <RepasseSummaryCards
          totalHonorariosRepassados={totalHonorariosRepassados}
          deficitClinica={deficitClinica}
          cotaPorSocio={cotaPorSocio}
          countSocios={countSocios}
          totalLiquidoGeral={totalLiquidoGeral}
          repasseRowsCount={repasseRows.length}
        />

        {/* Repasses Data Table */}
        <RepasseTable
          repasseRows={repasseRows}
          onNavigateToDoctor={onNavigateToDoctor}
          setViewingCompensacao={setViewingCompensacao}
          setViewingObs={setViewingObs}
          openEditAjuste={openEditAjuste}
          totalHonorariosRepassados={totalHonorariosRepassados}
          totalCreditos={totalCreditos}
          totalDebitos={totalDebitos}
          totalCompensacoesGeral={totalCompensacoesGeral}
          totalBNB={totalBNB}
          totalCotaClinica={totalCotaClinica}
          totalLiquidoGeral={totalLiquidoGeral}
          cotaPorSocio={cotaPorSocio}
          exportColumns={exportColumns}
          period={period}
        />
      </div>

      {/* Modal: Visualizar Observações */}
      <RepasseObsModal
        viewingObs={viewingObs}
        onClose={() => setViewingObs(null)}
        openEditAjuste={openEditAjuste}
      />

      {/* Modal: Detalhes de Compensações de Materiais/Convênios */}
      <RepasseCompensacaoModal
        viewingCompensacao={viewingCompensacao}
        onClose={() => setViewingCompensacao(null)}
      />

      {/* Modal: Editar Ajustes do Repasse (Créditos, Débitos, BNB, Sócio, OBS) */}
      <RepasseAjusteModal
        isOpen={editAjusteModal}
        onClose={() => setEditAjusteModal(false)}
        selectedMedico={selectedMedico}
        selectedRow={selectedRow}
        ajusteForm={ajusteForm}
        setAjusteForm={setAjusteForm}
        handleSaveAjuste={handleSaveAjuste}
      />

      {/* Modal: Gerenciar Médicos e Sócios */}
      <ManageMedicosModal
        isOpen={manageMedicosModal}
        onClose={() => setManageMedicosModal(false)}
        allDoctors={allDoctors}
        newMedicoNome={newMedicoNome}
        setNewMedicoNome={setNewMedicoNome}
        newMedicoSocio={newMedicoSocio}
        setNewMedicoSocio={setNewMedicoSocio}
        handleAddMedico={handleAddMedico}
        toggleMedicoSocio={toggleMedicoSocio}
        toggleMedicoAtivo={toggleMedicoAtivo}
        moveMedico={moveMedico}
        reorderMedicos={reorderMedicos}
        deleteMedicoId={deleteMedicoId}
        setDeleteMedicoId={setDeleteMedicoId}
        handleDeleteMedico={handleDeleteMedico}
      />
    </>
  );
}

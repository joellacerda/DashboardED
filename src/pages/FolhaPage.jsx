import { navigateAcquisitionPeriod } from '../utils/helpers';
import ConfirmDialog from '../components/ConfirmDialog';
import PeriodSelector from '../components/PeriodSelector';
import { useFolhaData } from './folha/useFolhaData';
import FolhaSummaryCards from './folha/FolhaSummaryCards';
import FolhaTable from './folha/FolhaTable';
import FolhaModal from './folha/FolhaModal';

export default function FolhaPage() {
  const {
    period,
    setPeriod,
    isCurrentPeriod,
    search,
    setSearch,
    filtered,
    paginatedItems,
    pageSize,
    setPageSize,
    safeCurrentPage,
    setCurrentPage,
    totalFolha,
    totalBase,
    totalBeneficios,
    totalVariaveis,
    totalDescontos,
    totalVA,
    totalVT,
    totalExtras,
    totalProdutividade,
    folhaLancamentoNoCaixa,
    handleLancarFluxo,
    handleCopyFromPrevious,
    requestCopyFromPrevious,
    confirmCopyOpen,
    setConfirmCopyOpen,
    modalOpen,
    setModalOpen,
    editId,
    form,
    updateField,
    markTouched,
    validationErrors,
    hasError,
    openNew,
    openEdit,
    handleSave,
    deleteId,
    setDeleteId,
    handleDelete,
  } = useFolhaData();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Folha de Pagamento</h1>
        </div>
        <div className="header-actions">
          {/* Period selector */}
          <PeriodSelector period={period} onChange={setPeriod} isCurrentPeriod={isCurrentPeriod} />

          {/* Action to copy from previous period */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={requestCopyFromPrevious}
            title={`Copiar lançamentos do período anterior (${navigateAcquisitionPeriod(period, -1).label})`}
          >
            📋 Copiar Mês Anterior
          </button>

          {/* Action to launch into Fluxo de Caixa */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleLancarFluxo}
            style={
              folhaLancamentoNoCaixa
                ? { borderColor: 'var(--color-emerald)', color: 'var(--color-emerald)' }
                : {}
            }
            title={
              folhaLancamentoNoCaixa
                ? 'Atualizar valor da folha no Fluxo de Caixa'
                : 'Lançar saída da folha no Fluxo de Caixa'
            }
          >
            💵 {folhaLancamentoNoCaixa ? 'Atualizar no Caixa' : 'Lançar no Caixa'}
          </button>

          <button type="button" className="btn btn-primary" onClick={openNew}>
            + Novo Funcionário
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* 5 KPI Summary Cards for the Period */}
        <FolhaSummaryCards
          totalFolha={totalFolha}
          totalBase={totalBase}
          totalBeneficios={totalBeneficios}
          totalVariaveis={totalVariaveis}
          totalDescontos={totalDescontos}
        />

        <FolhaTable
          filtered={filtered}
          paginatedItems={paginatedItems}
          search={search}
          setSearch={setSearch}
          period={period}
          folhaLancamentoNoCaixa={folhaLancamentoNoCaixa}
          openEdit={openEdit}
          setDeleteId={setDeleteId}
          totalBase={totalBase}
          totalDescontos={totalDescontos}
          totalFolha={totalFolha}
          totalVA={totalVA}
          totalVT={totalVT}
          totalExtras={totalExtras}
          totalProdutividade={totalProdutividade}
          safeCurrentPage={safeCurrentPage}
          pageSize={pageSize}
          setCurrentPage={setCurrentPage}
          setPageSize={setPageSize}
        />
      </div>

      {/* Modal: Cadastro / Edição por Período */}
      <FolhaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editId={editId}
        form={form}
        updateField={updateField}
        period={period}
        hasError={hasError}
        markTouched={markTouched}
        validationErrors={validationErrors}
        handleSave={handleSave}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Tem certeza que deseja remover/inativar este colaborador? Se houver histórico em períodos anteriores, ele será preservado."
      />

      <ConfirmDialog
        isOpen={confirmCopyOpen}
        onClose={() => setConfirmCopyOpen(false)}
        onConfirm={handleCopyFromPrevious}
        title="Sobrescrever lançamentos do período?"
        confirmLabel="Sim, copiar mês anterior"
        message="Já existem lançamentos gravados neste período. Copiar do mês anterior irá sobrescrever horas extras, descontos e produtividade já informados. Deseja continuar?"
      />
    </>
  );
}

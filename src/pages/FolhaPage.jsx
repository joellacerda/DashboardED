import {
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
} from '../utils/helpers';
import ConfirmDialog from '../components/ConfirmDialog';
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
    folhaLancamentoNoCaixa,
    handleLancarFluxo,
    handleCopyFromPrevious,
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

          {/* Action to copy from previous period */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopyFromPrevious}
            title={`Copiar lançamentos do período anterior (${navigateAcquisitionPeriod(period, -1).label})`}
          >
            📋 Copiar Mês Anterior
          </button>

          {/* Action to launch into Fluxo de Caixa */}
          <button
            type="button"
            className={`btn btn-sm ${folhaLancamentoNoCaixa ? 'btn-secondary' : 'btn-secondary'}`}
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
        message="Tem certeza que deseja excluir este colaborador?"
      />
    </>
  );
}

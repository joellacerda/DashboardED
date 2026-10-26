import Modal from './Modal';
import AutoCompleteInput from './AutoCompleteInput';
import {
  examePermiteComplementar,
  PROCEDIMENTOS_COMPLEMENTARES,
  normalizeProcedimentosComplementares,
  formatProcedimentosComplementares,
} from '../utils/helpers';
import { useDetalhesForm } from './detalhes/useDetalhesForm';
import ConvenioOverrideBanner from './detalhes/ConvenioOverrideBanner';
import DivisaoMedicosSection from './detalhes/DivisaoMedicosSection';
import PagamentosSection from './detalhes/PagamentosSection';
import DeducoesSection from './detalhes/DeducoesSection';
import HonorariosPreviewSection from './detalhes/HonorariosPreviewSection';

export default function DetalhesFormModal({
  isOpen,
  editItem,
  prefillData,
  onClose,
  onSuccess,
}) {
  const {
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
  } = useDetalhesForm({
    isOpen,
    editItem,
    prefillData,
    onClose,
    onSuccess,
  });

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? 'Editar Detalhe' : 'Novo Detalhe de Exame'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {editItem ? 'Salvar' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSave} noValidate autoComplete="off">
        {/* Banner de Sincronização / Personalização do Convênio */}
        <ConvenioOverrideBanner
          isConvenio={Boolean(form.isConvenio || editItem?.origemConvenioId)}
          manualOverride={form.manualOverride}
          convenio={form.convenio}
          editItemId={editItem?.id}
          onRevertConvenio={handleRevertConvenio}
        />

        <div className="modal-form-grid">
          {/* Data do Exame */}
          <div className="input-group">
            <label className="input-label">Data <span className="required">*</span></label>
            <input
              type="date"
              className={`input-field ${hasError('data') ? 'is-invalid' : ''}`}
              value={form.data}
              onChange={(e) => updateField('data', e.target.value)}
              onBlur={() => markTouched('data')}
            />
            {hasError('data') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.data}
              </div>
            )}
          </div>

          {/* Médico Principal */}
          <div className="input-group">
            <label className="input-label">Médico Principal <span className="required">*</span></label>
            <AutoCompleteInput
              options={medicosOptions}
              className={`input-field ${hasError('medico') ? 'is-invalid' : ''}`}
              placeholder="Selecione ou digite o médico"
              value={form.medico}
              onChange={(val) => updateField('medico', val.toUpperCase())}
              onBlur={() => markTouched('medico')}
            />
            {hasError('medico') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.medico}
              </div>
            )}
          </div>

          {/* Divisão com Co-médico */}
          <DivisaoMedicosSection
            form={form}
            setForm={setForm}
            updateField={updateField}
            markTouched={markTouched}
            hasError={hasError}
            validationErrors={validationErrors}
            medicosOptions={medicosOptions}
          />

          {/* Nome do Paciente */}
          <div className="input-group full-width">
            <label className="input-label">Paciente <span className="required">*</span></label>
            <input
              type="text"
              className={`input-field ${hasError('paciente') ? 'is-invalid' : ''}`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Nome do paciente"
              value={form.paciente}
              onChange={(e) => updateField('paciente', e.target.value.toUpperCase())}
              onBlur={() => markTouched('paciente')}
            />
            {hasError('paciente') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.paciente}
              </div>
            )}
          </div>

          {/* Tipo de Exame */}
          <div className="input-group full-width">
            <label className="input-label">Tipo de Exame <span className="required">*</span></label>
            <AutoCompleteInput
              options={examesOptions}
              className={`input-field ${hasError('tipoExame') ? 'is-invalid' : ''}`}
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
              onBlur={() => markTouched('tipoExame')}
            />
            {hasError('tipoExame') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.tipoExame}
              </div>
            )}
          </div>

          {/* Procedimentos Complementares (se permitidos para o exame) */}
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

          {/* Seção Dinâmica de Pagamentos */}
          <PagamentosSection
            form={form}
            updatePagamento={updatePagamento}
            addPagamento={addPagamento}
            removePagamento={removePagamento}
            hasError={hasError}
            validationErrors={validationErrors}
            submitted={submitted}
            totalPagamentos={totalPagamentos}
          />

          {/* Seção de Deduções, Taxas e Honorários */}
          <DeducoesSection
            form={form}
            updateField={updateField}
            totalPagamentos={totalPagamentos}
          />
        </div>

        {/* Prévia da Distribuição de Honorários e Divisão */}
        <HonorariosPreviewSection
          form={form}
          totalParcelasForm={totalParcelasForm}
          honorarioSchedule={honorarioSchedule}
          honDoc1Total={honDoc1Total}
          honDoc2Total={honDoc2Total}
        />
      </form>
    </Modal>
  );
}

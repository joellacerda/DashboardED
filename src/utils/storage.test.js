import { describe, it, expect, beforeEach } from 'vitest';
import {
  getData,
  setData,
  addItem,
  updateItem,
  deleteItem,
  clearMemoryCache,
  MODULES,
  migrate,
  runDataMigrations,
  resetMigrationStatus,
  SCHEMA_VERSION_KEY,
  CURRENT_SCHEMA_VERSION,
  syncConvenioToDetalhes,
  removeConvenioFromDetalhes,
  getAuditLogs,
  getStorageUsageInfo,
  previewArchiveData,
} from './storage';
import { calcLiquido } from '../pages/folha/useFolhaData';

describe('Storage Layer — Fase 4', () => {
  beforeEach(() => {
    localStorage.clear();
    clearMemoryCache();
    resetMigrationStatus();
  });

  describe('4.2 — Cache em Memória', () => {
    it('armazena dados lidos em cache e evita releituras do localStorage', () => {
      const initial = [{ id: '1', nome: 'Dr. Teste' }];
      localStorage.setItem('endodiagnose_medicos', JSON.stringify(initial));

      // 1ª leitura popula o cache
      const first = getData(MODULES.medicos);
      expect(first).toEqual(initial);

      // Altera o localStorage por fora (sem passar pelo setData)
      localStorage.setItem('endodiagnose_medicos', JSON.stringify([{ id: '2', nome: 'Outro' }]));

      // Como o cache está ativo, deve retornar o valor em cache
      const cached = getData(MODULES.medicos);
      expect(cached).toEqual(initial);

      // Ao invalidar o cache, a próxima leitura pega o valor fresco
      clearMemoryCache(MODULES.medicos);
      const refreshed = getData(MODULES.medicos);
      expect(refreshed).toEqual([{ id: '2', nome: 'Outro' }]);
    });

    it('setData atualiza o cache e o localStorage simultaneamente', () => {
      const list = [{ id: 'item_1', valor: 100 }];
      setData(MODULES.exames, list);

      expect(getData(MODULES.exames)).toEqual(list);
      expect(JSON.parse(localStorage.getItem('endodiagnose_exames'))).toEqual(list);
    });
  });

  describe('4.3 — Migrações Versionadas', () => {
    it('executa a função genérica migrate(module, fn) e salva apenas se houver alterações', () => {
      const doctors = [
        { id: '1', nome: 'dr. joao' },
        { id: '2', nome: 'DRA. MARIA' },
      ];
      setData(MODULES.medicos, doctors);

      const result = migrate(MODULES.medicos, (doc) => {
        if (doc.nome !== doc.nome.toUpperCase()) {
          return { ...doc, nome: doc.nome.toUpperCase() };
        }
        return doc;
      });

      expect(result.changed).toBe(true);
      expect(result.updatedCount).toBe(1);

      const updated = getData(MODULES.medicos);
      expect(updated).toEqual([
        { id: '1', nome: 'DR. JOAO' },
        { id: '2', nome: 'DRA. MARIA' },
      ]);
    });

    it('não modifica nada se a função de migração não gerar diferenças', () => {
      const doctors = [{ id: '1', nome: 'DR. JOAO' }];
      setData(MODULES.medicos, doctors);

      const result = migrate(MODULES.medicos, (doc) => doc);
      expect(result.changed).toBe(false);
      expect(result.updatedCount).toBe(0);
    });

    it('runDataMigrations atualiza SCHEMA_VERSION no localStorage', () => {
      runDataMigrations();
      expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe(String(CURRENT_SCHEMA_VERSION));
    });
  });

  describe('4.5 — Proteção de Ajuste Manual (manualOverride)', () => {
    it('não apaga o detalhe de exame quando hasDivisao é falso se houver manualOverride', () => {
      // Exame de convênio sem valores preenchidos (hasDivisao = false)
      const convItem = { id: 'conv_123', convenio: 'UNIMED', paciente: 'PACIENTE TESTE' };

      // Registro existente em detalhesExames com manualOverride ativado pelo usuário
      const manualDetalhe = {
        id: 'conv_conv_123',
        origemConvenioId: 'conv_123',
        paciente: 'PACIENTE TESTE',
        manualOverride: true,
        honorariosMedicos: 500,
        taxaClinica: 200,
      };
      setData(MODULES.detalhesExames, [manualDetalhe]);

      // syncConvenioToDetalhes sem forçar
      const result = syncConvenioToDetalhes(convItem, false);

      // Deve preservar o detalhe e NÃO apagá-lo
      expect(result).not.toBeNull();
      expect(result.id).toBe(manualDetalhe.id);

      const currentDetalhes = getData(MODULES.detalhesExames);
      expect(currentDetalhes.length).toBe(1);
      expect(currentDetalhes[0].honorariosMedicos).toBe(500);
    });

    it('removeConvenioFromDetalhes desvincula e preserva detalhe se houver manualOverride', () => {
      const manualDetalhe = {
        id: 'conv_conv_999',
        origemConvenioId: 'conv_999',
        paciente: 'PACIENTE MANUAL',
        manualOverride: true,
        honorariosMedicos: 350,
      };
      setData(MODULES.detalhesExames, [manualDetalhe]);

      // Chamada de remoção sem force
      removeConvenioFromDetalhes('conv_999', false);

      // O detalhe deve permanecer mas desvinculado (origemConvenioId = null)
      const current = getData(MODULES.detalhesExames);
      expect(current.length).toBe(1);
      expect(current[0].origemConvenioId).toBeNull();
      expect(current[0].honorariosMedicos).toBe(350);
    });
  });

  describe('CRUD e Logs de Auditoria', () => {
    it('registra log de auditoria ao adicionar, atualizar e excluir itens', () => {
      const item = addItem(MODULES.exames, { paciente: 'TESTE AUDIT', valor: 200 });
      expect(item.id).toBeDefined();

      updateItem(MODULES.exames, item.id, { valor: 250 });
      deleteItem(MODULES.exames, item.id);

      const logs = getAuditLogs();
      expect(logs.length).toBeGreaterThanOrEqual(3);

      const acoes = logs.map((l) => l.acao);
      expect(acoes).toContain('CRIAR');
      expect(acoes).toContain('EDITAR');
      expect(acoes).toContain('EXCLUIR');
    });
  });

  describe('Monitoramento de Storage, Prévia de Arquivamento e Folha', () => {
    it('getStorageUsageInfo contabiliza registros a partir do cache sem re-parsear JSON', () => {
      setData(MODULES.exames, [
        { id: 'e1', data: '2025-01-10', paciente: 'ANA' },
        { id: 'e2', data: '2026-03-10', paciente: 'BRUNO' },
      ]);
      setData(MODULES.medicos, [{ id: 'm1', nome: 'DR. TESTE' }]);

      const info = getStorageUsageInfo();
      expect(info.totalRecords).toBe(3);
      expect(info.totalBytes).toBeGreaterThan(0);
      const examesCol = info.collections.find((c) => c.module === MODULES.exames);
      expect(examesCol.count).toBe(2);
    });

    it('previewArchiveData separa registros anteriores à data de corte', () => {
      setData(MODULES.exames, [
        { id: 'old1', data: '2024-06-15', paciente: 'ANTIGO' },
        { id: 'new1', data: '2026-02-20', paciente: 'RECENTE' },
      ]);
      setData(MODULES.fluxoCaixa, [
        { id: 'f_old', data: '2024-11-01', tipo: 'entrada', valor: 300 },
        { id: 'f_new', data: '2026-03-01', tipo: 'saida', valor: 100 },
      ]);

      const preview = previewArchiveData('2025-01-01');
      expect(preview.totalArchived).toBe(2);
      expect(preview.totalRemaining).toBe(2);
      expect(preview.modules.exames.archiveCount).toBe(1);
      expect(preview.modules.exames.keepCount).toBe(1);
      expect(preview.modules.fluxoCaixa.archiveCount).toBe(1);
      expect(preview.modules.fluxoCaixa.keepCount).toBe(1);
    });

    it('calcLiquido calcula salário líquido somando proventos e subtraindo descontos', () => {
      expect(
        calcLiquido({
          salarioBase: 2500,
          valeAlimentacao: 400,
          valeTransporte: 200,
          extras: 150,
          produtividade: 300,
          descontos: 250,
        })
      ).toBe(3300);
    });
  });
});

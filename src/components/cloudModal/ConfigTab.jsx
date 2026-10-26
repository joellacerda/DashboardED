export default function ConfigTab({
  config,
  setConfig,
  pasteSnippet,
  handleParseSnippet,
  handleSaveConfig,
  handleDisconnect,
  configured,
  isLoading,
}) {
  return (
    <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div className="input-group full-width">
        <label className="input-label">
          Colar snippet de código do Firebase (Preenchimento Automático):
        </label>
        <textarea
          className="input-field"
          rows={3}
          placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "seu-projeto",\n  ...\n};`}
          value={pasteSnippet}
          onChange={(e) => handleParseSnippet(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '12px' }}
        />
      </div>

      <div className="modal-form-grid">
        <div className="input-group">
          <label className="input-label">API Key <span className="required">*</span></label>
          <input
            type="text"
            className="input-field"
            required
            placeholder="AIzaSy..."
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Project ID <span className="required">*</span></label>
          <input
            type="text"
            className="input-field"
            required
            placeholder="endodiagnose-12345"
            value={config.projectId}
            onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Auth Domain</label>
          <input
            type="text"
            className="input-field"
            placeholder="projeto.firebaseapp.com"
            value={config.authDomain}
            onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Storage Bucket</label>
          <input
            type="text"
            className="input-field"
            placeholder="projeto.appspot.com"
            value={config.storageBucket}
            onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Messaging Sender ID</label>
          <input
            type="text"
            className="input-field"
            placeholder="1234567890"
            value={config.messagingSenderId}
            onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">App ID</label>
          <input
            type="text"
            className="input-field"
            placeholder="1:12345:web:67890"
            value={config.appId}
            onChange={(e) => setConfig({ ...config, appId: e.target.value })}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
        {configured && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDisconnect}
            style={{ marginRight: 'auto' }}
          >
            Desconectar Nuvem
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Testando Conexão...' : 'Testar e Conectar Firebase'}
        </button>
      </div>
    </form>
  );
}

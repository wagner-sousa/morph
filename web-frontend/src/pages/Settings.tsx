import { useEffect, useState } from 'react';
import { api, type MCPConfig } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { useDropzone } from 'react-dropzone';

export function Settings() {
  const [config, setConfig] = useState<{ mcps: MCPConfig[] }>({ mcps: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.updateConfig(config);
      setMsg('Configuration saved.');
    } catch {
      setMsg('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const onDrop = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.mcps) {
          setConfig(parsed);
          setMsg('Configuration imported from file.');
        } else {
          setMsg('Invalid config file — missing "mcps" array.');
        }
      } catch {
        setMsg('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1,
  });

  if (loading) {
    return <div className="text-morph-muted">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-morph-accent bg-morph-accent/10'
                : 'border-morph-border hover:border-morph-muted'
            }`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-morph-accent">Drop file here...</p>
            ) : (
              <div>
                <p className="text-morph-muted">Drop a morph.json file here</p>
                <p className="text-xs text-morph-muted mt-1">or click to browse</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-text">Raw JSON</Label>
            <textarea
              id="config-text"
              className="flex min-h-[200px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
              value={JSON.stringify(config, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value) as { mcps: MCPConfig[] };
                  setConfig(parsed);
                  setMsg('');
                } catch {
                  /* invalid JSON while typing — ignore */
                }
              }}
            />
          </div>

          {msg && (
            <p
              className={`text-sm ${
                msg.startsWith('Failed') || msg.startsWith('Invalid')
                  ? 'text-red-400'
                  : 'text-green-400'
              }`}
            >
              {msg}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

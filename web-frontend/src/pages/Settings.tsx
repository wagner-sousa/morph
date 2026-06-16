import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useDropzone } from 'react-dropzone';

interface FullConfig {
  morph: { version: string; logLevel: string; allowConflicts: boolean; toolPrefix: string };
  mcpServers: unknown[];
  toon: { autoConvert: boolean; delimiter: string; indent: number; flattenDepth: number; threshold: number };
  webUi: { enabled: boolean; host: string; port: number; publicUrl?: string };
  health: { intervalMs: number; timeoutMs: number; maxRetries: number };
}

const defaults: FullConfig = {
  morph: { version: '1.0', logLevel: 'info', allowConflicts: false, toolPrefix: '' },
  mcpServers: [],
  toon: { autoConvert: true, delimiter: 'comma', indent: 2, flattenDepth: 4, threshold: 100 },
  webUi: { enabled: true, host: '0.0.0.0', port: 3101 },
  health: { intervalMs: 30000, timeoutMs: 5000, maxRetries: 3 },
};

export function Settings() {
  const [config, setConfig] = useState<FullConfig>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.config().then((raw) => {
      const c = raw as unknown as FullConfig;
      setConfig({
        morph: { ...defaults.morph, ...c.morph },
        mcpServers: c.mcpServers ?? [],
        toon: { ...defaults.toon, ...c.toon },
        webUi: { ...defaults.webUi, ...c.webUi },
        health: { ...defaults.health, ...c.health },
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const patch = <K extends keyof FullConfig>(section: K, value: Partial<FullConfig[K]>) => {
    setConfig((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.updateConfig(config as unknown as Record<string, unknown>);
      setMsg('Configuration saved.');
    } catch { setMsg('Failed to save configuration.'); }
    finally { setSaving(false); }
  };

  const onDrop = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        setConfig({ ...defaults, ...parsed });
        setMsg('Configuration imported from file.');
      } catch { setMsg('Invalid JSON file.'); }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/json': ['.json'] }, maxFiles: 1,
  });

  if (loading) return <div className="text-morph-muted">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logLevel">Log Level</Label>
              <Select
              id="logLevel"
              value={config.morph.logLevel}
              onChange={(e) => patch('morph', { logLevel: e.target.value })}
              options={[
                { value: 'debug', label: 'Debug' },
                { value: 'info', label: 'Info' },
                { value: 'warn', label: 'Warn' },
                { value: 'error', label: 'Error' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="allowConflicts"
              checked={config.morph.allowConflicts}
              onCheckedChange={(v) => patch('morph', { allowConflicts: v })}
            />
            <Label htmlFor="allowConflicts">Allow tool name conflicts (last MCP wins)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="toolPrefix">Tool Prefix Template</Label>
            <Input
              id="toolPrefix"
              value={config.morph.toolPrefix}
              onChange={(e) => patch('morph', { toolPrefix: e.target.value })}
              placeholder='{name}_  (ex: stripe_get_balance)'
            />
            <p className="text-xs text-morph-muted">
              Use <code>{'{name}'}</code> as placeholder for the MCP name.
              Empty = prefix only on conflicts (default). Examples: <code>{'{name}上帝'}</code>, <code>{'{name}:'}</code>, <code>{'{name}-'}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>TOON Conversion</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="autoConvert"
              checked={config.toon.autoConvert}
              onCheckedChange={(v) => patch('toon', { autoConvert: v })}
            />
            <Label htmlFor="autoConvert">Auto-convert JSON to TOON</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delimiter">Delimiter</Label>
              <Select
                id="delimiter"
                value={config.toon.delimiter}
                onChange={(e) => patch('toon', { delimiter: e.target.value })}
                options={[
                  { value: 'comma', label: 'Comma' },
                  { value: 'tab', label: 'Tab' },
                  { value: 'pipe', label: 'Pipe' },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="indent">Indent (spaces)</Label>
              <Input id="indent" type="number" value={config.toon.indent} onChange={(e) => patch('toon', { indent: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flattenDepth">Flatten Depth</Label>
              <Input id="flattenDepth" type="number" value={config.toon.flattenDepth} onChange={(e) => patch('toon', { flattenDepth: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold (chars)</Label>
              <Input id="threshold" type="number" value={config.toon.threshold} onChange={(e) => patch('toon', { threshold: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Web UI</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              id="webEnabled"
              checked={config.webUi.enabled}
              onCheckedChange={(v) => patch('webUi', { enabled: v })}
            />
            <Label htmlFor="webEnabled">Enabled</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" value={config.webUi.host} onChange={(e) => patch('webUi', { host: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" value={config.webUi.port} onChange={(e) => patch('webUi', { port: Number(e.target.value) })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="publicUrl">Public URL</Label>
              <Input id="publicUrl" value={config.webUi.publicUrl ?? ''} onChange={(e) => patch('webUi', { publicUrl: e.target.value || undefined })} placeholder="https://morph.example.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Health Check</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="intervalMs">Interval (ms)</Label>
              <Input id="intervalMs" type="number" value={config.health.intervalMs} onChange={(e) => patch('health', { intervalMs: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeoutMs">Timeout (ms)</Label>
              <Input id="timeoutMs" type="number" value={config.health.timeoutMs} onChange={(e) => patch('health', { timeoutMs: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRetries">Max Retries</Label>
              <Input id="maxRetries" type="number" value={config.health.maxRetries} onChange={(e) => patch('health', { maxRetries: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Raw Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-morph-accent bg-morph-accent/10' : 'border-morph-border hover:border-morph-muted'}`}>
            <input {...getInputProps()} />
            {isDragActive ? <p className="text-morph-accent">Drop file here...</p> : <div><p className="text-morph-muted">Drop a morph.json file here</p><p className="text-xs text-morph-muted mt-1">or click to browse</p></div>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="config-text">Raw JSON</Label>
            <textarea id="config-text" className="flex min-h-[200px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent" value={JSON.stringify(config, null, 2)} onChange={(e) => { try { setConfig(JSON.parse(e.target.value)); setMsg(''); } catch { /* ignore during typing */ } }} />
          </div>
        </CardContent>
      </Card>

      {msg && <p className={`text-sm ${msg.startsWith('Failed') || msg.startsWith('Invalid') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</Button>
    </div>
  );
}

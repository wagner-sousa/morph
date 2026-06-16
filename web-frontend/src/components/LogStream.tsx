import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { type LogEntry } from '../lib/api';
import { type WsMessage, useWebSocket } from '../lib/ws';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface LogStreamProps {
  initial: LogEntry[];
}

const levelVariant = (lvl: string) => {
  switch (lvl) {
    case 'error': return 'destructive' as const;
    case 'warn': return 'warning' as const;
    default: return 'secondary' as const;
  }
};

export function LogStream({ initial }: LogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initial.slice(0, 50));

  useEffect(() => {
    setLogs(initial.slice(0, 50));
  }, [initial]);

  const onWs = (msg: WsMessage) => {
    if (msg.channel === 'logs') {
      setLogs((prev) => [msg.data as LogEntry, ...prev].slice(0, 50));
    }
  };
  useWebSocket(onWs);

  return (
    <div className="rounded-md border border-morph-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>MCP</TableHead>
            <TableHead>Tool</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Saved</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id} className="cursor-pointer hover:bg-morph-bg-alt/50">
              <Link to="/logs/$id" params={{ id: String(l.id) }} className="contents">
                <TableCell className="text-morph-muted text-xs">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </TableCell>
                <TableCell>{l.mcpName}</TableCell>
                <TableCell className="font-mono text-xs">{l.toolName}</TableCell>
                <TableCell>
                  <Badge variant={levelVariant(l.level)}>{l.level}</Badge>
                </TableCell>
                <TableCell>{l.durationMs != null ? `${l.durationMs}ms` : '—'}</TableCell>
                <TableCell>{l.tokensSaved ? `${l.tokensSaved}` : '—'}</TableCell>
              </Link>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-morph-muted">
                No calls yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

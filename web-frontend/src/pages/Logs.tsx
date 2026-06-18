import { useState } from "react";
import { useLogs } from "../hooks/useLogs";
import { LogStream } from "../components/LogStream";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

export function Logs() {
  const { data: logs, isLoading } = useLogs(200);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");

  const filtered = (logs ?? []).filter((l) => {
    if (levelFilter !== "all" && l.level !== levelFilter) return false;
    if (formatFilter !== "all" && (l.outputFormat ?? "json") !== formatFilter)
      return false;
    if (
      search &&
      !l.toolName.toLowerCase().includes(search.toLowerCase()) &&
      !l.mcpName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Logs</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Search by MCP or tool..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
          }}
          options={[
            { value: "all", label: "All Levels" },
            { value: "info", label: "Info" },
            { value: "warn", label: "Warn" },
            { value: "error", label: "Error" },
          ]}
          className="w-36"
        />
        <Select
          value={formatFilter}
          onChange={(e) => {
            setFormatFilter(e.target.value);
          }}
          options={[
            { value: "all", label: "All Formats" },
            { value: "json", label: "JSON" },
            { value: "toon", label: "TOON" },
          ]}
          className="w-36"
        />
        <div className="text-sm text-morph-muted self-center">
          {filtered.length} entries
        </div>
      </div>

      {isLoading ? (
        <div className="text-morph-muted">Loading...</div>
      ) : (
        <LogStream initial={filtered} />
      )}
    </div>
  );
}

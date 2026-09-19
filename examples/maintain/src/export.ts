// The weekly report written out as a CSV file. The day format and the quoting rule are decided in
// accord/product/business-rules.md, so they are read from there rather than argued again here.
export interface ReportLine {
  day: string;
  member: string;
  hours: number;
}

const NEEDS_QUOTING = /["\n\r,]/;

function field(value: string): string {
  return NEEDS_QUOTING.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

export function exportCsv(lines: readonly ReportLine[]): string {
  const rows = lines.map((line) => [field(line.day), field(line.member), line.hours.toFixed(2)].join(','));
  return ['day,member,hours', ...rows].join('\n') + '\n';
}

import { FilterDropdown } from "./FilterDropdown";
export function SortDropdown({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return <FilterDropdown label="Sort" options={options} value={value} onChange={onChange} />;
}
export default SortDropdown;

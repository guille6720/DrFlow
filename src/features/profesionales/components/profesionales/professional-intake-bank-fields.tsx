import type { ProfessionalIntakeDetail } from "@/features/profesionales/components/profesionales/professional-intake-types";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PROFESSIONAL_BANK_ACCOUNT_TYPE_OPTIONS,
  PROFESSIONAL_IVA_STATUS_OPTIONS,
} from "@/lib/constants/professional-bank";

type Props = {
  selected: ProfessionalIntakeDetail;
};

export function ProfessionalIntakeBankFields({ selected }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        name="taxId"
        label="CUIL / CUIT"
        defaultValue={selected.tax_id ?? ""}
        placeholder="20-12345678-9"
        inputMode="numeric"
      />
      <Select
        name="ivaStatus"
        label="IVA responsable"
        placeholder="Seleccionar condición"
        defaultValue={selected.iva_status ?? ""}
        options={[...PROFESSIONAL_IVA_STATUS_OPTIONS]}
      />
      <Input
        name="bankName"
        label="Banco cuenta"
        defaultValue={selected.bank_name ?? ""}
        placeholder="Ej: Banco Nación"
      />
      <Select
        name="bankAccountType"
        label="Tipo cuenta"
        placeholder="Seleccionar tipo"
        defaultValue={selected.bank_account_type ?? ""}
        options={[...PROFESSIONAL_BANK_ACCOUNT_TYPE_OPTIONS]}
      />
      <Input
        name="bankAccountNumber"
        label="Nº cuenta"
        defaultValue={selected.bank_account_number ?? ""}
        placeholder="1234567890"
        inputMode="numeric"
      />
      <Input
        name="bankCbu"
        label="C.B.U."
        defaultValue={selected.bank_cbu ?? ""}
        placeholder="22 dígitos"
        inputMode="numeric"
        maxLength={22}
      />
      <div className="sm:col-span-2">
        <Input
          name="bankAlias"
          label="Alias"
          defaultValue={selected.bank_alias ?? ""}
          placeholder="medico.consultorio"
        />
      </div>
    </div>
  );
}

/**
 * labParameterConfig.js
 * Central configuration for Daily Lab Record parameters.
 * Frequency codes: D=daily, 2W=twice weekly, W=weekly, M=monthly
 * ⚠️ NEMA thresholds: confirm against KICOWASCO operating licence before go-live.
 */

export const NEMA_LIMITS = {
    effluent_bod:        30.0,   // mg/L — ⚠️ confirm
    effluent_tss:        30.0,   // mg/L — ⚠️ confirm
    effluent_turbidity:  30.0,   // NTU  — ⚠️ confirm
    effluent_ph_min:      6.0,
    effluent_ph_max:      9.0,
    effluent_do_min:      4.0,   // mg/L minimum
    effluent_fc:       1000.0,   // MPN/100mL
    effluent_ecoli:     100.0,   // CFU/100mL
    effluent_total_coliforms: 10000.0, // MPN/100mL
};

export const REMOVAL_EFFICIENCY_TARGET = 80.0; // % — regulatory minimum

export const INFLOW_PARAMS = [
    { key: 'inflow_ph',          label: 'pH',              unit: '',             freq: 'D'  },
    { key: 'inflow_temperature', label: 'Temp',            unit: '°C',           freq: 'D'  },
    { key: 'inflow_tss',         label: 'TSS',             unit: 'mg/L',         freq: 'D'  },
    { key: 'inflow_bod',         label: 'BOD',             unit: 'mg/L',         freq: '2W' },
    { key: 'inflow_cod',         label: 'COD',             unit: 'mg/L',         freq: 'W'  },
    { key: 'inflow_tn',          label: 'Tot. Nitrogen',   unit: 'mg/L',         freq: 'M'  },
    { key: 'inflow_tp',          label: 'Tot. Phosphorus', unit: 'mg/L',         freq: 'M'  },
    { key: 'inflow_fc',          label: 'Fecal Coliforms', unit: 'CFU/100mL',    freq: 'W'  },
];

export const EFFLUENT_PARAMS = [
    { key: 'effluent_ph',          label: 'pH',              unit: '',             freq: 'D',  nemaMin: NEMA_LIMITS.effluent_ph_min,  nemaMax: NEMA_LIMITS.effluent_ph_max  },
    { key: 'effluent_temperature', label: 'Temp',            unit: '°C',           freq: 'D'  },
    { key: 'effluent_tss',         label: 'TSS',             unit: 'mg/L',         freq: 'D',  nemaMax: NEMA_LIMITS.effluent_tss        },
    { key: 'effluent_bod',         label: 'BOD',             unit: 'mg/L',         freq: '2W', nemaMax: NEMA_LIMITS.effluent_bod        },
    { key: 'effluent_cod',         label: 'COD',             unit: 'mg/L',         freq: 'W'  },
    { key: 'effluent_tn',          label: 'Tot. Nitrogen',   unit: 'mg/L',         freq: 'M'  },
    { key: 'effluent_tp',          label: 'Tot. Phosphorus', unit: 'mg/L',         freq: 'M'  },
    { key: 'effluent_fc',          label: 'Fecal Coliforms', unit: 'MPN/100mL',    freq: 'W', nemaMax: NEMA_LIMITS.effluent_fc  },
    { key: 'effluent_ecoli',       label: 'E.coli',          unit: 'CFU/100mL',    freq: 'W', nemaMax: NEMA_LIMITS.effluent_ecoli },
    { key: 'effluent_total_coliforms', label: 'Total Coliforms', unit: 'MPN/100mL', freq: 'W', nemaMax: NEMA_LIMITS.effluent_total_coliforms },
    { key: 'effluent_turbidity',   label: 'Turbidity',       unit: 'NTU',          freq: 'D',  nemaMax: NEMA_LIMITS.effluent_turbidity  },
    { key: 'effluent_chlorine',    label: 'Chlorine',        unit: 'mg/L',         freq: 'D'  },
    { key: 'effluent_do',          label: 'DO',              unit: 'mg/L',         freq: 'D',  nemaMin: NEMA_LIMITS.effluent_do_min     },
];

export const OPS_PARAMS = [
    { key: 'volume_treated_m3', label: 'Vol. Treated', unit: 'm³', freq: 'D' },
    { key: 'sludge_volume_m3',  label: 'Sludge Vol.',  unit: 'm³', freq: 'D' },
];

export const ALL_PARAMS = [...INFLOW_PARAMS, ...EFFLUENT_PARAMS, ...OPS_PARAMS];

/** Keys of numeric fields used in PATCH partial-entry */
export const LAB_PARAM_KEYS = ALL_PARAMS.map(p => p.key);

/** Summary table columns shown in the monthly overview grid */
export const SUMMARY_TABLE_COLS = [
    { key: 'inflow_bod',          label: 'IN-BOD',   unit: 'mg/L' },
    { key: 'effluent_bod',        label: 'EFF-BOD',  unit: 'mg/L' },
    { key: 'bod_removal_efficiency', label: 'BOD Eff%', unit: '%'  },
    { key: 'inflow_tss',          label: 'IN-TSS',   unit: 'mg/L' },
    { key: 'effluent_tss',        label: 'EFF-TSS',  unit: 'mg/L' },
    { key: 'effluent_do',         label: 'DO',       unit: 'mg/L' },
    { key: 'effluent_turbidity',  label: 'Turbidity', unit: 'NTU' },
    { key: 'effluent_ecoli',      label: 'E.coli',   unit: 'CFU/100mL' },
];

/** Returns true if a value exceeds the NEMA max limit for that parameter */
export const isExceedance = (paramKey, value) => {
    if (value === null || value === undefined) return false;
    const param = ALL_PARAMS.find(p => p.key === paramKey);
    if (!param) return false;
    if (param.nemaMax !== undefined && Number(value) > param.nemaMax) return true;
    if (param.nemaMin !== undefined && Number(value) < param.nemaMin) return true;
    return false;
};

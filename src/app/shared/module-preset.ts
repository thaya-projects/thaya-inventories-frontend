import { CompanySettings } from '../core/models/company-profile.model';

// Onboarding consultora: el Admin ya no elige módulos sueltos — el SuperAdmin
// elige uno de estos 3 paquetes al crear/editar una empresa, y ese paquete
// define los 6 toggles de CompanySettings de una sola vez.
export const ModulePreset = {
  inventory: 'inventory',
  production: 'production',
  plant: 'plant',
} as const;

export type ModulePresetValue = (typeof ModulePreset)[keyof typeof ModulePreset];

type PresetSettings = Pick<
  CompanySettings,
  'usesProduction' | 'usesLots' | 'usesWeight' | 'usesLoaders' | 'usesMultiWarehouse' | 'usesVariants'
>;

interface ModulePresetDef {
  label: string;
  hint: string;
  settings: PresetSettings;
}

export const MODULE_PRESETS: Record<ModulePresetValue, ModulePresetDef> = {
  inventory: {
    label: 'Compran y venden',
    hint: 'Inventario, compras, ventas, caja y gastos.',
    settings: {
      usesProduction: false,
      usesLots: false,
      usesWeight: false,
      usesLoaders: false,
      usesMultiWarehouse: false,
      usesVariants: false,
    },
  },
  production: {
    label: 'Fabrican o procesan',
    hint: 'Lo anterior + producción, lotes y peso.',
    settings: {
      usesProduction: true,
      usesLots: true,
      usesWeight: true,
      usesLoaders: false,
      usesMultiWarehouse: false,
      usesVariants: false,
    },
  },
  plant: {
    label: 'Fabrican y pagan estiba',
    hint: 'Lo anterior + cargadores / jornal.',
    settings: {
      usesProduction: true,
      usesLots: true,
      usesWeight: true,
      usesLoaders: true,
      usesMultiWarehouse: false,
      usesVariants: false,
    },
  },
};

export const MODULE_PRESET_OPTIONS: ModulePresetValue[] = [
  ModulePreset.inventory,
  ModulePreset.production,
  ModulePreset.plant,
];

// A qué paquete corresponde un CompanySettings ya guardado — para mostrarlo
// de solo lectura sin tener que guardar el preset como un campo aparte.
export function inferPreset(settings: Partial<CompanySettings> | undefined | null): ModulePresetValue {
  if (settings?.usesLoaders === true && settings?.usesProduction === true) return ModulePreset.plant;
  if (settings?.usesProduction === true) return ModulePreset.production;
  return ModulePreset.inventory;
}

// Traduce el preset a las keys cortas que usa el "features" libre de un plan
// (mismo naming que CompanySubscriptionFeatures: production, multiWarehouse,
// loaders — acá se suman lots/weight/variants con el mismo criterio).
export function presetToFeatureFlags(preset: ModulePresetValue): Record<string, boolean> {
  const s = MODULE_PRESETS[preset].settings;
  return {
    production: s.usesProduction,
    lots: s.usesLots,
    weight: s.usesWeight,
    loaders: s.usesLoaders,
    multiWarehouse: s.usesMultiWarehouse,
    variants: s.usesVariants,
  };
}

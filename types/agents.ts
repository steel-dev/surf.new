export interface SettingConfig {
  type: "integer" | "float" | "text" | "textarea";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  description?: string;
}

export interface SupportedModel {
  provider: string;
  models: string[];
}

export interface Agent {
  name: string;
  description: string;
  supported_models: SupportedModel[];
  model_settings: Record<string, SettingConfig>;
  agent_settings: Record<string, SettingConfig>;
}

export interface AvailableAgents {
  [key: string]: Agent;
}

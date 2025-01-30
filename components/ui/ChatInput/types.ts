export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent, textValue: string, files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  onStop?: () => void;
  ref?: React.Ref<HTMLTextAreaElement>;
}

export interface SendButtonProps {
  disabled: boolean;
  isLoading: boolean | undefined;
  onStop?: () => void;
}

export interface SettingsButtonProps {
  className?: string;
}

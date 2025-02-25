'use client';
import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

import { useSettings } from '@/app/contexts/SettingsContext';

interface AuthModalProps {
  provider: string;
  isOpen: boolean;
  onSubmit: (key: string) => void;
}

export function AuthModal({ provider, isOpen, onSubmit }: AuthModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (apiKey.length < 32) {
      setError('API key must be at least 32 characters long');
      return;
    }
    onSubmit(apiKey);
    setApiKey('');
    setError('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className={cn(
          'flex w-[400px] shrink-0 flex-col',
          'rounded-[20px] border border-[--gray-3] bg-[--gray-1]',
          'p-6 text-[--gray-12] shadow-[0_16px_32px_-12px_rgba(14,18,27,0.10)]'
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[--gray-12]">
            {provider} API Key Required
          </DialogTitle>
          <DialogDescription className="text-sm text-[--gray-11]">
            Please enter your {provider} API key to continue. Your API key will be stored locally
            and never shared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[--gray-12]">API Key</label>
            <div className="relative">
              <Input
                placeholder="Enter your API key"
                type="password"
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSubmit();
                  }
                }}
                className="settings-input"
              />
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
          </div>

          <button
            onClick={handleSubmit}
            className={[
              'w-full h-8 px-2 py-1 bg-[--gray-12] rounded-full',
              'justify-center items-center inline-flex',
              'overflow-hidden cursor-pointer transition-colors',
              'hover:bg-[--gray-11]',
            ].join(' ')}
          >
            <span className="font-['Geist'] text-sm font-medium leading-normal text-[--gray-1]">
              Submit
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { createContext, useContext, useState } from 'react';
import { Icon } from '@iconify/react';

interface ModalContextType {
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
  showPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    message: string;
    defaultValue: string;
    promptValue: string;
    resolve: ((value: any) => void) | null;
  }>({
    isOpen: false,
    type: 'alert',
    message: '',
    defaultValue: '',
    promptValue: '',
    resolve: null
  });

  const showAlert = (message: string) => {
    return new Promise<void>((resolve) => {
      setModal({
        isOpen: true,
        type: 'alert',
        message,
        defaultValue: '',
        promptValue: '',
        resolve: () => {
          setModal((prev) => ({ ...prev, isOpen: false }));
          resolve();
        }
      });
    });
  };

  const showConfirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setModal({
        isOpen: true,
        type: 'confirm',
        message,
        defaultValue: '',
        promptValue: '',
        resolve: (result: boolean) => {
          setModal((prev) => ({ ...prev, isOpen: false }));
          resolve(result);
        }
      });
    });
  };

  const showPrompt = (message: string, defaultValue = '') => {
    return new Promise<string | null>((resolve) => {
      setModal({
        isOpen: true,
        type: 'prompt',
        message,
        defaultValue,
        promptValue: defaultValue,
        resolve: (result: string | null) => {
          setModal((prev) => ({ ...prev, isOpen: false }));
          resolve(result);
        }
      });
    });
  };

  const handleClose = (value: any) => {
    if (modal.resolve) {
      modal.resolve(value);
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      {modal.isOpen && (
        <div className={`custom-modal-backdrop`}>
          <div className="custom-modal-container">
            <div className={`custom-modal-header ${modal.type}`}>
              <div className={`custom-modal-icon ${modal.type}`}>
                <Icon
                  icon={
                    modal.type === 'alert'
                      ? 'solar:info-circle-bold-duotone'
                      : modal.type === 'confirm'
                        ? 'solar:question-square-bold-duotone'
                        : 'solar:pen-new-round-bold-duotone'
                  }
                  width="22"
                  height="22"
                />
              </div>
              <h3>
                {modal.type === 'alert'
                  ? 'Notification'
                  : modal.type === 'confirm'
                    ? 'Confirm Action'
                    : 'Input Required'}
              </h3>
            </div>
            <div className="custom-modal-body">
              {modal.message.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '4px 0' }}>{line}</p>
              ))}
              {modal.type === 'prompt' && (
                <input
                  type="text"
                  value={modal.promptValue}
                  onChange={(e) => setModal((prev) => ({ ...prev, promptValue: e.target.value }))}
                  className="custom-modal-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleClose(modal.promptValue);
                    if (e.key === 'Escape') handleClose(null);
                  }}
                />
              )}
            </div>
            <div className="custom-modal-footer">
              {modal.type === 'alert' && (
                <button type="button" className="btn primary" onClick={() => handleClose(undefined)}>
                  OK
                </button>
              )}
              {modal.type === 'confirm' && (
                <>
                  <button type="button" className="btn secondary" onClick={() => handleClose(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn danger" onClick={() => handleClose(true)}>
                    Confirm
                  </button>
                </>
              )}
              {modal.type === 'prompt' && (
                <>
                  <button type="button" className="btn secondary" onClick={() => handleClose(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn primary" onClick={() => handleClose(modal.promptValue)}>
                    Submit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

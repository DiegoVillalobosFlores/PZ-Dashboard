import { createContext, useContext, useState, type ReactNode } from 'react';

interface ModalContextValue {
  isModalOpen: boolean;
  registerModal: () => () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalCount, setModalCount] = useState(0);

  const registerModal = () => {
    setModalCount((c) => c + 1);
    return () => setModalCount((c) => c - 1);
  };

  return (
    <ModalContext.Provider value={{ isModalOpen: modalCount > 0, registerModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModalContext must be used within ModalProvider');
  return ctx;
}
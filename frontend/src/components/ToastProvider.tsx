import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";
import { Toast, type ToastMessage } from "primereact/toast";

type Show = (message: ToastMessage) => void;
const ToastContext = createContext<Show>(() => undefined);

/** One app-wide PrimeReact Toast so pages can show feedback after navigating. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Toast>(null);
  const show = useCallback<Show>((m) => ref.current?.show({ life: 4000, ...m }), []);
  return (
    <ToastContext.Provider value={show}>
      <Toast ref={ref} position="top-right" />
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  return useContext(ToastContext);
}

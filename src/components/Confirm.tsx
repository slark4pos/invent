import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Options = { okLabel?: string; danger?: boolean };
type ConfirmFn = (message: string, options?: Options) => Promise<boolean>;

const Ctx = createContext<ConfirmFn>(() => Promise.resolve(false));

/**
 * Подтверждение своим окном вместо window.confirm: системные диалоги не везде
 * показываются (встроенные браузеры, WebView) и тогда молча отвечают «нет».
 */
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; options: Options; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (message, options = {}) => new Promise<boolean>((resolve) => setState({ message, options, resolve })),
    [],
  );

  const close = (answer: boolean) => {
    state?.resolve(answer);
    setState(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && (
        <div className="modal-backdrop" onClick={() => close(false)}>
          <div className="modal card col" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div>{state.message}</div>
            <div className="row">
              <button className="btn ghost grow" onClick={() => close(false)}>Отмена</button>
              <button
                className={`btn grow ${state.options.danger === false ? 'primary' : 'danger'}`}
                autoFocus
                onClick={() => close(true)}
              >
                {state.options.okLabel ?? 'Да'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

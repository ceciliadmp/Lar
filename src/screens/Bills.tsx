import { useCallback, useRef, useState } from 'react';
import type { Actions } from '../App';
import { Button, Icon, IconButton, TextField } from '../components/ui';
import { ConfirmDialog, Modal } from '../components/Dialog';
import { RowMenu } from '../components/Menu';
import { useSubmit } from '../useSubmit';
import {
  billInMonth,
  formatMoney,
  monthKey,
  monthLabel,
  nameOf,
  parseMoney,
  shiftMonthKey,
  type Bill,
  type HouseView,
} from '../state';

/** Mês escolhido na tela; fica guardado enquanto o app estiver aberto (trocar de aba não perde). */
let lastMonth: string | null = null;

/** Aba Contas: contas da casa por mês, com pagamento separado mês a mês. */
export function Bills({ view: s, actions }: { view: HouseView; actions: Actions }) {
  const current = monthKey(new Date());
  const [month, setMonthState] = useState(lastMonth ?? current);
  const [adding, setAdding] = useState(false);
  const closeAdd = useCallback(() => setAdding(false), []);
  const setMonth = (m: string) => {
    lastMonth = m;
    setMonthState(m);
  };

  const list = s.bills
    .filter((b) => billInMonth(b, month))
    // Pendentes primeiro; dentro de cada grupo, por nome.
    .sort((a, b) => Number(!!a.paid[month]) - Number(!!b.paid[month]) || a.name.localeCompare(b.name, 'pt-BR'));
  const total = list.reduce((n, b) => n + b.amount, 0);
  const paid = list.filter((b) => b.paid[month]).reduce((n, b) => n + b.amount, 0);

  return (
    <div className="screen tab-screen">
      <div className="tasks__title">
        <div className="tasks__heading">
          <h1 className="title-l">Contas</h1>
          <p className="tasks__subtitle">{s.house.name}</p>
        </div>
        <div className="tasks__actions">
          <Button className="new-task-btn square-btn" aria-label="Adicionar conta" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} strokeWidth={2.4} />
          </Button>
        </div>
      </div>

      <div className="month-nav" role="group" aria-label="Mês">
        <IconButton label="Mês anterior" className="month-nav__btn" onClick={() => setMonth(shiftMonthKey(month, -1))}>
          <Icon name="back" size={16} />
        </IconButton>
        <span className="month-nav__label" aria-live="polite">
          {monthLabel(month)}
        </span>
        <IconButton label="Próximo mês" className="month-nav__btn" onClick={() => setMonth(shiftMonthKey(month, 1))}>
          <Icon name="chevron" size={16} />
        </IconButton>
      </div>
      {month !== current && (
        <button type="button" className="link-btn month-nav__today" onClick={() => setMonth(current)}>
          Voltar para {monthLabel(current).toLowerCase()}
        </button>
      )}

      {list.length > 0 && (
        <div className="bill-summary" aria-label="Resumo do mês">
          <div>
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div>
            <span>Pago</span>
            <strong>{formatMoney(paid)}</strong>
          </div>
          <div>
            <span>Falta pagar</span>
            <strong>{formatMoney(total - paid)}</strong>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty bills-empty">
          <strong>Nenhuma conta em {monthLabel(month).toLowerCase()}</strong>
          <span>Toque em + para adicionar luz, internet, aluguel…</span>
        </div>
      ) : (
        <ul className="list bills-list">
          {list.map((b) => (
            <BillRow key={b.id} bill={b} month={month} view={s} actions={actions} />
          ))}
        </ul>
      )}

      {adding && <BillForm month={month} onClose={closeAdd} onSaved={setMonth} actions={actions} />}
    </div>
  );
}

function BillRow({ bill: b, month, view: s, actions }: { bill: Bill; month: string; view: HouseView; actions: Actions }) {
  const paidBy = b.paid[month];
  const [confirming, setConfirming] = useState(false);
  const close = useCallback(() => setConfirming(false), []);
  const meta = [b.recurring ? 'Todo mês' : 'Só neste mês', paidBy ? `paga por ${nameOf(s, paidBy).replace('Você', 'você')}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={paidBy ? 'task bill bill--paid' : 'task bill'}>
      <button
        type="button"
        className="task__check"
        aria-label={(paidBy ? 'Marcar como pendente: ' : 'Marcar como paga: ') + b.name}
        aria-pressed={!!paidBy}
        onClick={() => actions.toggleBill(b.id, month)}
      >
        <span className="task__box">{paidBy && <Icon name="check" size={16} strokeWidth={2.6} min="larger" />}</span>
      </button>
      <div className="task__text">
        <span className="task__title">{b.name}</span>
        <span className="caption">{meta}</span>
      </div>
      <span className="bill__amount">{formatMoney(b.amount)}</span>
      <RowMenu label={`Opções: ${b.name}`} items={[{ label: 'Excluir', danger: true, onSelect: () => setConfirming(true) }]} />
      {confirming &&
        (b.recurring ? (
          <ConfirmDialog
            title="Excluir conta que se repete?"
            onCancel={close}
            actions={[
              {
                label: `Excluir só de ${monthLabel(month).toLowerCase()}`,
                variant: 'secondary',
                onClick: () => {
                  close();
                  actions.deleteBill(b.id, month, 'month');
                },
              },
              {
                label: 'Excluir deste mês em diante',
                variant: 'danger',
                onClick: () => {
                  close();
                  actions.deleteBill(b.id, month, 'future');
                },
              },
            ]}
          >
            “{b.name}” se repete todo mês. Os meses anteriores e os pagamentos deles continuam guardados.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog
            title="Excluir conta?"
            onCancel={close}
            actions={[
              {
                label: 'Excluir',
                variant: 'danger',
                onClick: () => {
                  close();
                  actions.deleteBill(b.id, month, 'month');
                },
              },
            ]}
          >
            “{b.name}” ({formatMoney(b.amount)}) vai sumir para todo mundo da casa.
          </ConfirmDialog>
        ))}
    </li>
  );
}

/** Janela para adicionar uma conta. O mês começa no que está aberto na tela. */
function BillForm({
  month,
  onClose,
  onSaved,
  actions,
}: {
  month: string;
  onClose: () => void;
  /** Depois de salvar, a tela vai para o mês da conta nova. */
  onSaved: (month: string) => void;
  actions: Actions;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [ref, setRef] = useState(month);
  const [recurring, setRecurring] = useState(true);
  const [touchedAmount, setTouchedAmount] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const amount = parseMoney(amountText);
  const amountError = touchedAmount && amountText.trim() && amount === null ? 'Digite um valor como 150 ou 89,90.' : null;

  // Meses para escolher: 12 antes e 12 depois do mês aberto na tela.
  const months = Array.from({ length: 25 }, (_, i) => shiftMonthKey(month, i - 12));

  const { busy, error, onSubmit } = useSubmit(async () => {
    if (amount === null) return 'Digite um valor como 150 ou 89,90.';
    const err = await actions.addBill(name.trim(), amount, ref, recurring);
    if (!err) {
      onSaved(ref);
      onClose();
    }
    return err;
  });

  return (
    <Modal labelledBy="bill-title" onClose={onClose} initialFocus={titleRef}>
      <form className="bill-form" onSubmit={onSubmit} noValidate>
        <h2 id="bill-title" className="dialog__title" ref={titleRef} tabIndex={-1}>
          Adicionar conta
        </h2>
        <TextField
          id="f-bill-name"
          label="Nome da conta"
          placeholder="Ex.: Luz, Internet, Aluguel"
          maxLength={60}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field">
          <label htmlFor="f-bill-amount">Valor</label>
          <div className="money">
            <span className="money__prefix" aria-hidden="true">
              R$
            </span>
            <input
              id="f-bill-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              required
              aria-invalid={!!amountError}
              aria-describedby={amountError ? 'f-bill-amount-err' : undefined}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              onBlur={() => setTouchedAmount(true)}
            />
          </div>
          {amountError && (
            <span id="f-bill-amount-err" className="form-error" style={{ fontSize: 13 }}>
              {amountError}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-bill-month">Mês de referência</label>
          <select id="f-bill-month" className="select" value={ref} onChange={(e) => setRef(e.target.value)}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gap: 10 }}>
          <span className="field-label" id="f-bill-kind">
            Repete?
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="f-bill-kind">
            <button type="button" role="radio" aria-checked={recurring} onClick={() => setRecurring(true)}>
              Todo mês
            </button>
            <button type="button" role="radio" aria-checked={!recurring} onClick={() => setRecurring(false)}>
              Só neste mês
            </button>
          </div>
          <span className="caption">
            {recurring
              ? `Aparece de ${monthLabel(ref).toLowerCase()} em diante. O pagamento é marcado mês a mês.`
              : `Aparece só em ${monthLabel(ref).toLowerCase()}.`}
          </span>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog__actions">
          <Button type="submit" disabled={!name.trim() || amount === null || busy}>
            {busy ? 'Adicionando…' : 'Adicionar conta'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

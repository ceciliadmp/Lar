import { useEffect, useReducer } from 'react';
import { initialState, reducer, type State } from './state';
import { CreateHouse, JoinHouse, Welcome } from './screens/Onboarding';
import { Tasks } from './screens/Tasks';
import { Members } from './screens/Members';
import { NewTaskSheet } from './screens/NewTaskSheet';

const STORAGE_KEY = 'lar:state:v1';

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw), sheetOpen: false };
  } catch {
    /* sem armazenamento: começa do zero */
  }
  return initialState;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignora */
    }
  }, [state]);

  return (
    <main className="app">
      {state.screen === 'welcome' && <Welcome dispatch={dispatch} />}
      {state.screen === 'create' && <CreateHouse dispatch={dispatch} />}
      {state.screen === 'join' && <JoinHouse dispatch={dispatch} />}
      {state.screen === 'tasks' && <Tasks state={state} dispatch={dispatch} />}
      {state.screen === 'members' && <Members state={state} dispatch={dispatch} />}
      {state.screen === 'tasks' && state.sheetOpen && <NewTaskSheet state={state} dispatch={dispatch} />}
    </main>
  );
}

import { useMemo, useState } from 'react';
import { Play, RefreshCw, RotateCcw } from 'lucide-react';
import {
  CausalGraphQuestion,
  GraphEnding,
  NodeOption,
  RouteCondition,
} from '../../types/causalGraph';

type GraphState = Record<string, unknown>;
type ScoreState = Record<string, number>;

interface HistoryEntry {
  nodeId: string;
  state: GraphState;
  scores: ScoreState;
}

const conditionsMatch = (conditions: RouteCondition[], values: GraphState): boolean =>
  conditions.every((condition) => {
    const current = values[condition.variableId];
    const expected = condition.value;
    const scalar = Array.isArray(current) ? null : String(current ?? '');
    const set = Array.isArray(current) ? current.map(String) : [];
    const leftNumber = Number(scalar);
    const rightNumber = Number(expected);

    switch (condition.operator) {
      case 'EQUALS': return scalar === expected;
      case 'NOT_EQUALS': return scalar !== expected;
      case 'GREATER_THAN': return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber > rightNumber;
      case 'GREATER_OR_EQUAL': return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber >= rightNumber;
      case 'LESS_THAN': return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber < rightNumber;
      case 'LESS_OR_EQUAL': return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber <= rightNumber;
      case 'CONTAINS': return set.includes(expected);
      case 'NOT_CONTAINS': return !set.includes(expected);
    }
  });

const initialState = (graph: CausalGraphQuestion): GraphState =>
  Object.fromEntries(graph.stateVariables.map((variable) => [variable.id, variable.defaultValue]));

const initialScores = (graph: CausalGraphQuestion): ScoreState =>
  Object.fromEntries(graph.scoreDimensions.map((dimension) => [dimension.id, 0]));

const copyState = <T,>(value: T): T => structuredClone(value);

export function GraphSimulator({ graphData }: { graphData: CausalGraphQuestion }) {
  const [currentNodeId, setCurrentNodeId] = useState(graphData.startNodeId || 'N1');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [state, setState] = useState<GraphState>(() => initialState(graphData));
  const [scores, setScores] = useState<ScoreState>(() => initialScores(graphData));
  const [ending, setEnding] = useState<GraphEnding | null>(null);

  const currentNode = useMemo(
    () => graphData.nodes.find((node) => node.id === currentNodeId) ?? null,
    [currentNodeId, graphData.nodes],
  );

  const restart = () => {
    setCurrentNodeId(graphData.startNodeId || 'N1');
    setHistory([]);
    setState(initialState(graphData));
    setScores(initialScores(graphData));
    setEnding(null);
  };

  const goBack = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((entries) => entries.slice(0, -1));
    setCurrentNodeId(previous.nodeId);
    setState(previous.state);
    setScores(previous.scores);
    setEnding(null);
  };

  const finish = (endingId: string) => {
    setEnding(
      graphData.endings.find((item) => item.id === endingId) ?? {
        id: endingId,
        title: 'Завершено',
        summary: '',
        explanation: '',
        resultTags: [],
      },
    );
  };

  const resolveTarget = (targetNodeId: string, nextState: GraphState) => {
    let target = targetNodeId;
    for (let step = 0; step < 64; step += 1) {
      const node = graphData.nodes.find((item) => item.id === target);
      if (!node) return;

      if (node.nodeType === 'ROUTER') {
        const route = [...(node.routes ?? [])]
          .sort((left, right) => left.priority - right.priority)
          .find((rule) => rule.always || conditionsMatch(rule.all, nextState));
        if (!route) return;
        target = route.targetNodeId;
      } else if (node.nodeType === 'RESULT_GATE') {
        const rule = [...(node.endingRules ?? [])]
          .sort((left, right) => left.priority - right.priority)
          .find((item) => item.always || conditionsMatch(item.all, nextState));
        if (rule) finish(rule.endingId);
        return;
      } else if (node.nodeType === 'MERGE') {
        if (!node.autoTransition?.targetNodeId) return;
        target = node.autoTransition.targetNodeId;
      } else if (node.nodeType === 'END') {
        finish(node.id);
        return;
      } else {
        setCurrentNodeId(target);
        return;
      }
    }
  };

  const selectOption = (option: NodeOption) => {
    if (!currentNode) return;
    setHistory((entries) => [
      ...entries,
      { nodeId: currentNodeId, state: copyState(state), scores: copyState(scores) },
    ]);

    const nextState = { ...state };
    option.effects?.forEach((effect) => {
      const current = nextState[effect.variableId];
      switch (effect.operation) {
        case 'SET': nextState[effect.variableId] = effect.value; break;
        case 'INCREMENT': nextState[effect.variableId] = String((Number(current) || 0) + (Number(effect.value) || 1)); break;
        case 'DECREMENT': nextState[effect.variableId] = String((Number(current) || 0) - (Number(effect.value) || 1)); break;
        case 'ADD': nextState[effect.variableId] = [...new Set([...(Array.isArray(current) ? current.map(String) : []), effect.value])]; break;
        case 'REMOVE': nextState[effect.variableId] = (Array.isArray(current) ? current.map(String) : []).filter((value) => value !== effect.value); break;
      }
    });

    const nextScores = { ...scores };
    Object.entries(option.scoreDelta ?? {}).forEach(([key, delta]) => {
      nextScores[key] = (nextScores[key] || 0) + Number(delta);
    });
    setState(nextState);
    setScores(nextScores);

    const transition = option.transition;
    if (transition?.type === 'GO_TO_NODE' && transition.targetNodeId) resolveTarget(transition.targetNodeId, nextState);
    if (transition?.type === 'GO_TO_RESULT_GATE' && transition.targetNodeId) resolveTarget(transition.targetNodeId, nextState);
    if (transition?.type === 'FINISH' && transition.endingId) finish(transition.endingId);
  };

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Інтерактивна локальна симуляція графа</h3>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold hover:bg-slate-700">
              <RotateCcw className="h-3.5 w-3.5" /> Крок назад
            </button>
          )}
          <button type="button" onClick={restart} className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-600">
            <RefreshCw className="h-3.5 w-3.5" /> Перезапустити
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex min-h-[360px] flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-950 p-6 lg:col-span-8">
          {ending ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/20 p-4 text-emerald-300">
                <span className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">ФІНАЛЬНИЙ РЕЗУЛЬТАТ</span>
                <h4 className="mt-2 text-lg font-bold text-white">{ending.title}</h4>
                <p className="mt-1 text-xs text-emerald-200">{ending.summary}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
                <strong className="text-white">Наукове пояснення:</strong>
                <p className="mt-1">{ending.explanation}</p>
              </div>
            </div>
          ) : currentNode ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="rounded-lg border border-amber-500/30 bg-amber-500/20 px-2.5 py-1 font-mono text-xs font-bold text-amber-400">Вузол {currentNode.id} ({currentNode.nodeType})</span>
                <span className="font-mono text-xs text-slate-400">Крок {history.length + 1}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{currentNode.title}</h3>
                <p className="mt-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-xs leading-relaxed text-slate-300">{currentNode.text}</p>
                {currentNode.prompt && <p className="mt-2 text-xs font-semibold text-amber-400">{currentNode.prompt}</p>}
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {currentNode.options?.map((option, index) => (
                  <button key={option.id} type="button" onClick={() => selectOption(option)} className="group flex w-full flex-col gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-4 text-left hover:border-amber-500/50 hover:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-amber-400">Варіант {index + 1} ({option.id})</span>
                      <span className="font-mono text-[10px] text-slate-400">→ {option.transition?.type}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-100 group-hover:text-amber-300">{option.text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : <p className="p-4 text-xs text-slate-500">Вузол не знайдено.</p>}
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <Monitor title="Змінні стану" values={state} valueClass="text-amber-400" />
          <Monitor title="Бали шкал" values={scores} valueClass="text-emerald-400" />
        </aside>
      </div>
    </section>
  );
}

function Monitor({ title, values, valueClass }: { title: string; values: Record<string, unknown>; valueClass: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h4 className="border-b border-slate-800 pb-2 text-xs font-bold text-slate-200">{title}</h4>
      <div className="flex flex-col gap-1.5">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-2 font-mono text-xs">
            <span className="text-slate-400">{key}:</span>
            <span className={`font-bold ${valueClass}`}>{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coins,
  Database,
  Gauge,
  Medal,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGameQuestions, Question, Track, trackMeta } from "@/lib/questions";

type Result = {
  id: number;
  playerName: string;
  track: Track;
  score: number;
  questionReached: number;
  durationSeconds: number;
};

type Phase = "lobby" | "playing" | "feedback" | "finished";
const prizes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 250, 400, 600, 1000];
const letters = ["A", "B", "C", "D"];
const trackIcons = { business: BriefcaseBusiness, system: Gauge, data: Database, ml: Bot };

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function AnalystGame() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [name, setName] = useState("");
  const [track, setTrack] = useState<Track>("business");
  const [gameQuestions, setGameQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [lifelines, setLifelines] = useState({ fifty: true, audience: true, friend: true });
  const [audience, setAudience] = useState<number[] | null>(null);
  const [friendTip, setFriendTip] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Result[]>([]);
  const [finishScore, setFinishScore] = useState(0);
  const [finishReason, setFinishReason] = useState("");
  const submitted = useRef(false);

  const current = gameQuestions[index];
  const currentScore = index > 0 ? prizes[index - 1] : 0;

  const loadLeaderboard = useCallback(async () => {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      setLeaderboard(await response.json());
    } catch {
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => void loadLeaderboard(), [loadLeaderboard]);

  const completeGame = useCallback(
    async (score: number, reason: string, reached: number) => {
      setFinishScore(score);
      setFinishReason(reason);
      setPhase("finished");
      if (submitted.current) return;
      submitted.current = true;
      try {
        await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerName: name.trim(), track, score, questionReached: reached, durationSeconds: elapsed }),
        });
        await loadLeaderboard();
      } catch {
        // The result screen remains usable if the network is unavailable.
      }
    },
    [elapsed, loadLeaderboard, name, track],
  );

  const loseGame = useCallback(
    (reason: string) => {
      const safeScore = index >= 10 ? 100 : index >= 5 ? 50 : 0;
      void completeGame(safeScore, reason, Math.min(index + 1, 15));
    },
    [completeGame, index],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => loseGame("Время на ответ истекло"), 0);
          return 0;
        }
        return value - 1;
      });
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, index, loseGame]);

  const startGame = () => {
    if (name.trim().length < 2) return;
    setGameQuestions(createGameQuestions(track));
    setIndex(0);
    setTimeLeft(60);
    setElapsed(0);
    setSelected(null);
    setHidden([]);
    setAudience(null);
    setFriendTip(false);
    setLifelines({ fifty: true, audience: true, friend: true });
    submitted.current = false;
    setPhase("playing");
  };

  const answer = (choice: number) => {
    if (phase !== "playing" || hidden.includes(choice)) return;
    setSelected(choice);
    setPhase("feedback");
  };

  const nextQuestion = () => {
    if (!current || selected !== current.correct) return;
    if (index === 14) {
      void completeGame(1000, "Все 15 вопросов пройдены!", 15);
      return;
    }
    setIndex((value) => value + 1);
    setTimeLeft(60);
    setSelected(null);
    setHidden([]);
    setAudience(null);
    setFriendTip(false);
    setPhase("playing");
  };

  const useFifty = () => {
    if (!current || !lifelines.fifty || phase !== "playing") return;
    const wrong = [0, 1, 2, 3].filter((value) => value !== current.correct).sort(() => Math.random() - 0.5);
    setHidden(wrong.slice(0, 2));
    setLifelines((value) => ({ ...value, fifty: false }));
  };

  const useAudience = () => {
    if (!current || !lifelines.audience || phase !== "playing") return;
    const correctShare = index < 5 ? 67 : index < 10 ? 54 : 43;
    const remaining = 100 - correctShare;
    const splits = [Math.floor(remaining * 0.46), Math.floor(remaining * 0.31)];
    splits.push(remaining - splits[0] - splits[1]);
    const stats = [0, 0, 0, 0];
    stats[current.correct] = correctShare;
    let cursor = 0;
    stats.forEach((_, answerIndex) => {
      if (answerIndex !== current.correct) stats[answerIndex] = splits[cursor++];
    });
    setAudience(stats);
    setLifelines((value) => ({ ...value, audience: false }));
  };

  const useFriend = () => {
    if (!current || !lifelines.friend || phase !== "playing") return;
    setFriendTip(true);
    setLifelines((value) => ({ ...value, friend: false }));
  };

  if (phase === "lobby") {
    return <Lobby name={name} setName={setName} track={track} setTrack={setTrack} startGame={startGame} leaderboard={leaderboard} />;
  }

  if (phase === "finished") {
    return (
      <FinishScreen
        name={name}
        track={track}
        score={finishScore}
        reason={finishReason}
        elapsed={elapsed}
        leaderboard={leaderboard}
        onAgain={() => setPhase("lobby")}
      />
    );
  }

  if (!current) return null;
  const isCorrect = selected === current.correct;

  return (
    <main className="game-shell">
      <Header compact score={currentScore} />
      <div className="game-grid">
        <section className="question-panel">
          <div className="game-meta">
            <div>
              <span className="eyebrow">ВОПРОС {index + 1} ИЗ 15</span>
              <span className={`difficulty ${current.difficulty}`}>{current.difficulty === "easy" ? "РАЗОГРЕВ" : current.difficulty === "medium" ? "БАЗОВЫЙ УРОВЕНЬ" : "ЭКСПЕРТ"}</span>
            </div>
            <div className={`timer ${timeLeft <= 10 ? "danger" : ""}`} style={{ "--timer": `${timeLeft * 6}deg` } as React.CSSProperties}>
              <span><Clock3 size={16} />{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div className="progress-track"><span style={{ width: `${((index + 1) / 15) * 100}%` }} /></div>

          <div className="question-copy">
            <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
            <h1>{current.text}</h1>
          </div>

          {friendTip && <div className="tip-message"><Sparkles size={18} /><span>Друг уверен: правильный ответ — <b>{letters[current.correct]}</b></span></div>}

          <div className="answers-grid">
            {current.answers.map((option, answerIndex) => {
              const gone = hidden.includes(answerIndex);
              const answerState = phase === "feedback"
                ? answerIndex === current.correct
                  ? "correct"
                  : answerIndex === selected
                    ? "wrong"
                    : ""
                : "";
              return (
                <button key={option} disabled={gone || phase === "feedback"} className={`answer ${gone ? "hidden-answer" : ""} ${answerState}`} onClick={() => answer(answerIndex)}>
                  <span className="answer-letter">{letters[answerIndex]}</span>
                  <span className="answer-text">{gone ? "—" : option}</span>
                  {audience && !gone && <span className="audience-result"><i style={{ height: `${audience[answerIndex]}%` }} />{audience[answerIndex]}%</span>}
                  {answerState === "correct" && <Check size={20} />}
                  {answerState === "wrong" && <X size={20} />}
                </button>
              );
            })}
          </div>

          {phase === "feedback" && (
            <div className={`feedback-bar ${isCorrect ? "success" : "failure"}`}>
              <div>{isCorrect ? <Check /> : <X />}<span><b>{isCorrect ? "Верно!" : "Неверный ответ"}</b><small>{isCorrect ? `На вашем счету ${prizes[index]} коинов` : `Правильный ответ: ${letters[current.correct]}`}</small></span></div>
              {isCorrect ? <button onClick={nextQuestion}>{index === 14 ? "Забрать 1000" : "Следующий вопрос"}<ChevronRight size={18} /></button> : <button onClick={() => loseGame("Игра завершена на сложном вопросе")}>Узнать результат<ChevronRight size={18} /></button>}
            </div>
          )}

          <div className="lifeline-row">
            <span>ПОДСКАЗКИ</span>
            <Lifeline active={lifelines.fifty} onClick={useFifty} icon={<CircleHelp size={19} />} title="50 / 50" text="Убрать 2 ответа" />
            <Lifeline active={lifelines.audience} onClick={useAudience} icon={<Users size={19} />} title="Помощь зала" text="Мнение игроков" />
            <Lifeline active={lifelines.friend} onClick={useFriend} icon={<Sparkles size={19} />} title="Помощь друга" text="Верный вариант" />
          </div>
        </section>

        <aside className="ladder-panel">
          <div className="ladder-head"><span>ЛЕСТНИЦА</span><b><Coins size={16} />{currentScore}</b></div>
          <div className="ladder-list">
            {[...prizes].reverse().map((prize, reverseIndex) => {
              const questionNumber = 15 - reverseIndex;
              const active = questionNumber === index + 1;
              const passed = questionNumber <= index;
              const safe = questionNumber === 5 || questionNumber === 10;
              return <div key={prize} className={`${active ? "active" : ""} ${passed ? "passed" : ""} ${safe ? "safe" : ""}`}><span>{questionNumber}</span><i />{safe && <ShieldCheck size={14} />}<b>{prize.toLocaleString("ru-RU")}</b></div>;
            })}
          </div>
          <div className="pilot-card"><div>{trackMeta[track].short}</div><span><small>ИГРОК</small><b>{name}</b><em>{trackMeta[track].name}</em></span></div>
        </aside>
      </div>
    </main>
  );
}

function Header({ compact = false, score = 0 }: { compact?: boolean; score?: number }) {
  return <header className={`site-header ${compact ? "compact" : ""}`}><div className="brand"><span>S7</span><div><b>ANALYST</b><small>CHALLENGE</small></div></div><div className="flight-line"><i />2026 SEASON<i /></div>{compact ? <div className="header-score"><Coins size={18} />{score}<small>COINS</small></div> : <div className="live"><i />LIVE&nbsp; ARENA</div>}</header>;
}

function Lobby({ name, setName, track, setTrack, startGame, leaderboard }: { name: string; setName: (value: string) => void; track: Track; setTrack: (value: Track) => void; startGame: () => void; leaderboard: Result[] }) {
  const topRows = leaderboard.slice(0, 5);
  return (
    <main className="lobby-shell">
      <Header />
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-kicker"><Zap size={14} fill="currentColor" />ИНТЕЛЛЕКТУАЛЬНЫЙ ЧЕЛЛЕНДЖ ДЛЯ АНАЛИТИКОВ</div>
          <h1>КТО ХОЧЕТ СТАТЬ<br /><span>МИЛЛИОНЕРОМ</span><em>?</em></h1>
          <p>15 вопросов. 60 секунд на решение.<br />Докажи, что твои решения стоят <b>1 000 коинов.</b></p>

          <div className="join-card">
            <label><span>КАК ВАС ЗОВУТ?</span><input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Имя аналитика" /></label>
            <div className="track-picker"><span>ВЫБЕРИТЕ СПЕЦИАЛИЗАЦИЮ</span><div>{(Object.keys(trackMeta) as Track[]).map((item) => { const Icon = trackIcons[item]; return <button key={item} className={track === item ? "active" : ""} onClick={() => setTrack(item)}><Icon size={19} /><b>{trackMeta[item].short}</b><small>{trackMeta[item].name.replace("-аналитик", "")}</small></button>; })}</div></div>
            <button className="start-button" disabled={name.trim().length < 2} onClick={startGame}><Play size={19} fill="currentColor" />НАЧАТЬ ИГРУ<span>15 вопросов · до 15 минут</span><ChevronRight /></button>
          </div>
        </div>

        <div className="leaderboard-card">
          <div className="board-title"><div><span><Trophy size={15} />ЛИДЕРБОРД</span><h2>ТОП АНАЛИТИКОВ</h2></div><small><i />ОБНОВЛЕНО</small></div>
          <div className="board-tabs"><button className="active">ОБЩИЙ</button><button>ЭТОТ СЕЗОН</button></div>
          <div className="board-list">
            {topRows.length ? topRows.map((row, rowIndex) => <div key={row.id} className={rowIndex < 3 ? `place-${rowIndex + 1}` : ""}><span className="rank">{rowIndex === 0 ? <Medal size={20} /> : String(rowIndex + 1).padStart(2, "0")}</span><span className="avatar">{row.playerName.slice(0, 2).toUpperCase()}</span><span className="player"><b>{row.playerName}</b><small>{trackMeta[row.track]?.name ?? row.track}</small></span><span className="coins"><b>{row.score.toLocaleString("ru-RU")}</b><small>COINS</small></span></div>) : <div className="empty-board"><Trophy size={28} /><b>Рейтинг ждёт первого чемпиона</b><span>Начните игру и займите верхнюю строчку</span></div>}
          </div>
          <div className="board-footer"><span>ВАША ЦЕЛЬ</span><b>1 000 <Coins size={16} /></b><i>Пройди все 15 вопросов</i></div>
        </div>
      </section>

      <section className="rules-strip">
        <div className="rules-intro"><span>КАК ЭТО РАБОТАЕТ</span><h2>ФОРМАТ ИГРЫ</h2><p>Сложность растёт вместе с наградой</p></div>
        <Rule number="01—05" label="РАЗОГРЕВ" title="Лёгкий уровень" icon={<Zap />} />
        <Rule number="06—10" label="БАЗА" title="Средняя сложность" icon={<BarChart3 />} safe="50" />
        <Rule number="11—15" label="ЭКСПЕРТ" title="Хард-вопросы" icon={<Gauge />} safe="100" />
        <div className="grand-prize"><Trophy /><span><small>ГЛАВНЫЙ ПРИЗ</small><b>1 000</b><em>COINS</em></span></div>
      </section>
      <footer className="site-footer">S7 ANALYST CHALLENGE <span>•</span> THINK. DECIDE. FLY. <small>© 2026</small></footer>
    </main>
  );
}

function Rule({ number, label, title, icon, safe }: { number: string; label: string; title: string; icon: React.ReactNode; safe?: string }) {
  return <div className="rule"><div className="rule-icon">{icon}</div><span>{number}</span><b>{label}</b><p>{title}</p>{safe && <small><ShieldCheck size={13} />НЕСГОРАЕМАЯ · {safe}</small>}</div>;
}

function Lifeline({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return <button disabled={!active} onClick={onClick} className={active ? "" : "used"}><i>{icon}</i><span><b>{title}</b><small>{active ? text : "Использовано"}</small></span></button>;
}

function FinishScreen({ name, track, score, reason, elapsed, leaderboard, onAgain }: { name: string; track: Track; score: number; reason: string; elapsed: number; leaderboard: Result[]; onAgain: () => void }) {
  const rank = leaderboard.findIndex((row) => row.playerName === name && row.score === score) + 1;
  return <main className="finish-shell"><Header compact score={score} /><section className="finish-card"><div className={`finish-icon ${score === 1000 ? "winner" : ""}`}>{score === 1000 ? <Trophy /> : <BarChart3 />}</div><span className="eyebrow">ИГРА ЗАВЕРШЕНА</span><h1>{score === 1000 ? "ВЫ — ЧЕМПИОН!" : "ОТЛИЧНЫЙ ПОЛЁТ"}</h1><p>{reason}</p><div className="result-score"><small>ВАШ РЕЗУЛЬТАТ</small><b>{score.toLocaleString("ru-RU")} <Coins /></b><span>{trackMeta[track].name} · {formatTime(elapsed)}</span></div><div className="result-stats"><span><b>{rank || "—"}</b><small>МЕСТО В РЕЙТИНГЕ</small></span><span><b>{name}</b><small>ИГРОК</small></span></div><button className="start-button" onClick={onAgain}><RefreshCcw size={18} />СЫГРАТЬ ЕЩЁ РАЗ<ChevronRight /></button></section></main>;
}

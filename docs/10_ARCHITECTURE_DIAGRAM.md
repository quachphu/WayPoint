# Waypoint — Architecture Diagram

Presentation-ready diagrams of the system as it actually runs today (verified
2026-07-18). Rendered with Mermaid — GitHub, Cursor, Notion, and most slide
tools (via [mermaid.live](https://mermaid.live) export to PNG/SVG) render
these natively.

## 1. System overview

```mermaid
flowchart TB
    Voice["🎤 Voice"]
    Chat["⌨️ Chat"]
    VocalBridge["Vocal Bridge<br/>AI Agent mode · continuous conversation<br/>bring-your-own-agent (onAIAgentQuery)"]
    Converse["converse.ts<br/>single entry point for voice + chat"]
    Orchestrator["Orchestrator — common/agent.ts<br/>Claude Sonnet · hand-rolled tool loop · 12-turn memory"]
    Tools["Tools<br/>searchFlights · searchHotels · suggestActivities<br/>proposeNode · proposeBooking · reportDisruption"]
    TripState["Event-sourced Trip State<br/>append → pure fold (tripState.ts)"]

    subgraph EXT["External APIs"]
        direction LR
        Sabre["Sabre Cert v1<br/>Flight Shop · Hotels Search · Booking<br/>(live, verified)"]
        Free["Nominatim · OSRM · Wikipedia<br/>(geocode · transit · photos)"]
        Simulated["Simulated inventory<br/>(fallback only)"]
    end

    subgraph DB["Postgres (MindStudio-managed)"]
        direction LR
        Events[("trip_events<br/>append-only log")]
        Trips["trips<br/>materialized nodes/edges"]
    end

    subgraph FE["Frontend — React + Vite"]
        direction LR
        Store["Zustand Store<br/>(SSE-driven)"]
        Board["Planning Board<br/>(day-by-day swimlanes)"]
        ConfirmGate["Confirm-Gate<br/>(approval cards — booking/calls<br/>only fire on an explicit tap here)"]
    end

    Voice --> VocalBridge --> Converse
    Chat --> Converse
    Converse --> Orchestrator
    Orchestrator --> Tools
    Orchestrator --> TripState
    Tools --> Sabre
    Tools -.->|"on any error"| Simulated
    Tools --> Free
    TripState --> Events --> Trips
    Trips ==>|"SSE stream"| Store
    Store --> Board
    Store --> ConfirmGate

    classDef ext fill:#2d2d3a,stroke:#7c7cff,color:#fff
    classDef data fill:#1f2937,stroke:#38bdf8,color:#fff
    classDef fe fill:#312e81,stroke:#a78bfa,color:#fff
    classDef be fill:#1e293b,stroke:#34d399,color:#fff
    classDef voice fill:#4c1d95,stroke:#c4b5fd,color:#fff
    class Sabre,Free,Simulated ext
    class Events,Trips data
    class Board,ConfirmGate,Store fe
    class Converse,Orchestrator,Tools,TripState be
    class VocalBridge,Voice,Chat voice
```

*A confirmed booking or call re-enters through the same Voice/Chat path (the traveler's tap is just another turn) — not drawn as a separate edge above, to keep this a clean one-way flow. xAI TTS (mascot one-shot narration) and the Web Speech API fallback are also omitted for clarity — see `docs/03_API_INTEGRATION.md` for the full voice fallback chain.*

**Key properties this diagram is meant to communicate:**

- **One orchestrator, two input paths.** Voice (Vocal Bridge) and chat both funnel into the same `converse.ts` → `agent.ts` orchestrator — no separate "voice logic" to keep in sync.
- **Confirm-gate is structural, not a prompt instruction.** Anything that spends money (`proposeBooking`) or places a real call renders a `ConfirmGate` card the orchestrator cannot bypass; only an explicit tap fires the booking tool.
- **Never blocks on a free/best-effort dependency.** Sabre, Nominatim, OSRM, and Wikipedia calls are all wrapped in try/catch with a graceful fallback (simulated inventory, heuristic transit label, or no photo) — a third-party outage degrades quality, never availability.
- **Trip state is event-sourced.** Every mutation appends to `trip_events`; `trips.nodes/edges` is a pure fold of that log (`deriveTripState`), re-computed on every write and safe under concurrent turns (version-checked retry).

## 2. One voice turn, end to end (sequence)

```mermaid
sequenceDiagram
    actor T as Traveler
    participant VB as Vocal Bridge
    participant FE as Frontend (store.ts)
    participant BE as converse.ts
    participant AG as Orchestrator (agent.ts)
    participant SB as Sabre v1 API
    participant DB as Postgres (events + projection)

    T->>VB: speaks ("Book the Delta flight")
    VB->>FE: onAIAgentQuery(text)
    FE->>BE: POST /converse {text, source:"voice"}
    BE->>DB: load last 12 messages (memory)
    BE->>AG: runConversation(text, priorMessages, board)
    AG->>AG: 1 tool call per turn (max 10 turns/reply)
    AG->>SB: searchFlights / proposeBooking
    SB-->>AG: live offers (or graceful fallback)
    AG->>DB: recordEvents([...]) → refold projection
    DB-->>FE: SSE stream (node/edge/pending_action updates)
    AG-->>BE: { reply }
    BE-->>FE: reply text
    FE-->>VB: return string (spoken verbatim, ai_agent.verbatim=true)
    VB->>T: "Got it — that's $132.40, want me to book it?"
    Note over FE,T: ConfirmGate card renders from the pending_action — booking only fires on explicit tap, never from voice alone
    T->>FE: taps "Book it"
    FE->>BE: bookFlightFromChat (idempotency-guarded)
    BE->>DB: mark offer bookedRef, record node_confirmed
```

## 3. Data model — event sourcing

```mermaid
flowchart TB
    subgraph SEQ["Conversation turns, in order"]
        direction LR
        E1["trip_created"] --> E2["node_proposed<br/>(flight)"] --> E3["node_proposed<br/>(hotel)"] --> E4["node_updated<br/>(slot replace)"] --> E5["node_confirmed<br/>(booking)"] --> E6["node_proposed<br/>(activity, day 1)"]
    end

    Log[("trip_events<br/>append-only log")]
    Proj["trips.nodes / trips.edges<br/>materialized, versioned"]
    Lanes["Day-by-day swimlanes<br/>self-healing: effectiveDayIndex(node, trip.startDate)<br/>recomputed fresh on every read, never trusts a<br/>stale stored value once dates get backfilled"]

    SEQ ==>|"every turn appends"| Log
    Log ==>|"deriveTripState() — pure fold, every write"| Proj
    Proj ==>|"rendered"| Lanes

    classDef ev fill:#312e81,stroke:#a78bfa,color:#fff
    classDef data fill:#1f2937,stroke:#38bdf8,color:#fff
    class E1,E2,E3,E4,E5,E6 ev
    class Log,Proj data
```

## How to export a slide-ready image

1. Paste any block above into [mermaid.live](https://mermaid.live) → **Actions → Export PNG/SVG**.
2. Or, in Cursor/VS Code with a Mermaid preview extension, right-click the rendered diagram → **Save as image**.

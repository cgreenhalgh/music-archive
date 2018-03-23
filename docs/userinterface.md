# Archive user interface notes

## Use cases

Various use cases...

### Browsable record

Initially a browsable web-based archive, potentially hosting multiple works, but current being driven entirely by Climb! Consequently the explorer interface is both the most developed and the most specific to Climb!, e.g. including the mountain visualisation.

### Demo

Specifically used to demo Climb! 

Questions:
- presenter in control, kiosk (constrained) or unconstrained?
- single screen, multiple screens, additional devices (phone, tablet, disklavier)?
- show recording vs recreate: effects, projection, app, score, disklavier

Various options:

- use standard version to show/navigate recordings of past performances, point out codes triggered (listed/indexed) and explain the structure of the piece (map view).
- big-screen (presentation) demo
- attended demo "stand", e.g. for public presentations
- unattended demo stand

### Adapt(ed) listening experience

Specify device(s), view(s), mode (e.g. linear, user guided), performance(s)/part(s). 
Then "generate" e.g. template or "experience".
Then "play" / listen.

Implies:
- (something like) accounts, or at least sessions
- (something like) playlist
- flexible playback options
- authoring vs delivery/playback modes

## Mobile app view

Mobile app UI should repond to:
- current performance -> bio(s), "past" performances
- current part -> stage in performance map, second performance?
- app events (code approaching, success) -> notification

Archive app should not log.

### implmentation ideas

WebRTC?! Needs bootstrapping via bi-directional channel. E.g. window messages (same machine), socket.io, ... So i'll just start with those for now.

muzivisual app (mvapp) served from separate URL (same server for initial same origin tests on single machine).

mvapp connects to archive via data channel (via archive opening mvapp (same machine) or via other server coordination TBC).

mvapp sends hello to archive.

archive sends set performance (performance config JSON) to mvapp. Mvapp has to cope with change of performance, e.g. by reload.

archive sends part history updates to mvapp (either next stage (next) or list of all stages (back/change)). Mvapp has to cope with restart/rewind, e.g. by reload.

archive sends app events on normal play only. Note, these are not currently included in archive logs?!

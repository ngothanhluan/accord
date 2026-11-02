# Round r2-scout benchmark: accord-scout

Samples 1, 2, 4, 5; 3 runs per arm and sample. Cost per run is weighted tokens (fresh input 1, cache read 0.1, cache write 1.25, output 5) times the model's price factor from 2026-11-02. Suggestions only: this report changes no agent definition.

## Arms

| model | effort | runs | scout check passes: mean (range of pass means) | contradicted Absent rows: mean (range of pass means) | wiring recall: mean (range of pass means) | mean cost per run |
| --- | --- | ---: | --- | --- | --- | ---: |
| haiku | low | 12 | 0 (0 to 0) | 2 (1.25 to 2.75) | 0.264 (0.235 to 0.288) | 363950 |
| haiku | medium | 12 | 0 (0 to 0) | 2 (2 to 2) | 0.28 (0.258 to 0.294) | 528183 |
| haiku | high | 12 | 0 (0 to 0) | 2.083 (1.5 to 2.5) | 0.317 (0.259 to 0.364) | 888365 |
| sonnet | low | 12 | 0 (0 to 0) | 1.333 (1 to 1.75) | 0.318 (0.303 to 0.334) | 2464565 |
| sonnet | medium | 12 | 0 (0 to 0) | 1.083 (0.75 to 1.25) | 0.356 (0.342 to 0.363) | 2465264 |
| sonnet | high | 12 | 0 (0 to 0) | 1.333 (1 to 2) | 0.363 (0.244 to 0.437) | 4610765 |

## Best arm per measure

- scout check passes (highest is best): haiku low
- contradicted Absent rows (lowest is best): sonnet medium
- wiring recall (highest is best): sonnet high

## Winner

Winner: sonnet medium, the cheapest arm whose mean on every measure lies within the pass-mean range of the best arm on that measure.

## Samples left out

- sample 3: no merge of t/ST-LN-33

## Rows with no counted run

None.
